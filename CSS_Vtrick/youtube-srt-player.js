/**
 * YouTube SRT Player
 * 유튜브 영상과 SRT 자막을 동기화하여 표시하는 플레이어
 * 재생 시 스크롤에 따라 영상이 고정되는 기능 포함
 */

/**
 * SRT 파일을 파싱하는 함수
 * @param {string} srtContent - SRT 파일의 텍스트 내용
 * @returns {Array<{index: number, startTime: number, endTime: number, text: string}>}
 */
const parseSRT = (srtContent) => {
    // 줄바꿈 문자 정규화 (\r\n, \r 를 \n으로 통일)
    const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // 빈 줄을 기준으로 자막 항목들을 분리
    const entries = normalizedContent.trim().split('\n\n');

    return entries.map(entry => {
        // 각 항목을 줄 단위로 분리
        const lines = entry.trim().split('\n');
        if (lines.length < 3) return null;  // 유효하지 않은 항목 제외

        // 시간 정보 파싱 (예: "00:00:01,000 --> 00:00:04,000")
        const timeCode = lines[1].trim();
        const [startTime, endTime] = timeCode.split(' --> ').map(timeStr => {
            const [time, ms] = timeStr.trim().split(',');
            const [hours, minutes, seconds] = time.split(':').map(Number);
            
            // 모든 시간을 밀리초 단위로 변환
            return (
                hours * 3600000 +    // 시간 → 밀리초
                minutes * 60000 +    // 분 → 밀리초
                seconds * 1000 +     // 초 → 밀리초
                parseInt(ms)         // 밀리초
            );
        });

        // 자막 텍스트 추출 (여러 줄일 수 있음)
        const text = lines.slice(2).join('\n').trim();

        return {
            index: parseInt(lines[0], 10),
            startTime,
            endTime,
            text
        };
    }).filter(entry => entry !== null);  // null 항목 제거
};

// 전역 변수 선언
let player;          // YouTube 플레이어 인스턴스
let subtitles = [];  // 파싱된 자막 데이터
let isPlaying = false; // 재생 상태
let subtitleUpdateInterval; // 자막 업데이트 인터벌 ID

/**
 * SRT 자막 파일을 로드하고 파싱하는 함수
 * @param {string} srtUrl - SRT 파일의 URL
 * @param {string} videoId - YouTube 비디오 ID
 * @returns {Promise<Array>} 파싱된 자막 데이터
 */
async function loadSubtitles(srtUrl, videoId) {
    try {
        // 기존 자막 업데이트 인터벌 제거
        if (subtitleUpdateInterval) {
            clearInterval(subtitleUpdateInterval);
        }

        // 비디오 ID가 제공된 경우 플레이어 소스 변경
        if (videoId && player.loadVideoById) {
            player.loadVideoById(videoId);
        }

        const response = await fetch(srtUrl);
        const srtContent = await response.text();
        subtitles = parseSRT(srtContent);
        
        // 새로운 자막 업데이트 인터벌 설정
        subtitleUpdateInterval = setInterval(updateSubtitle, 100);
        
        return subtitles;
    } catch (error) {
        console.error('자막을 불러오는데 실패했습니다:', error);
        return [];
    }
}

// YouTube IFrame API 스크립트 로드
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);

/**
 * YouTube IFrame API 준비 완료 시 호출되는 함수
 * 플레이어 인스턴스 생성
 * @param {string} initialVideoId - 초기 비디오 ID
 */
function onYouTubeIframeAPIReady(initialVideoId) {
    player = new YT.Player('player', {
        videoId: initialVideoId,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

/**
 * 플레이어 준비 완료 시 호출되는 함수
 */
function onPlayerReady(event) {
    // 플레이어가 준비되면 초기 자막을 로드할 수 있음
    // loadSubtitles() 함수는 외부에서 필요할 때 호출
}

/**
 * 플레이어 상태 변경 시 호출되는 함수
 * @param {Object} event - YouTube 플레이어 이벤트 객체
 */
function onPlayerStateChange(event) {
    isPlaying = (event.data === YT.PlayerState.PLAYING);
}

/**
 * 현재 재생 시간에 맞는 자막을 화면에 표시하는 함수
 */
function updateSubtitle() {
    if (!player || !player.getCurrentTime) return;

    const time = player.getCurrentTime() * 1000;  // 초를 밀리초로 변환
    const currentSubtitle = subtitles.find(subtitle => 
        time >= subtitle.startTime && time <= subtitle.endTime
    );

    const subtitleText = document.getElementById('subtitle-text');
    if (currentSubtitle) {
        subtitleText.textContent = currentSubtitle.text;
    } else {
        subtitleText.textContent = '';
    }
}

/**
 * 스크롤 이벤트 처리
 * 재생 중일 때만 영상을 화면 상단에 고정
 */
window.addEventListener('scroll', function() {
    const videoContainer = document.querySelector('.video-container');
    const wrapper = document.querySelector('.sticky-wrapper');
    const rect = wrapper.getBoundingClientRect();
    
    // 재생 중이고 스크롤이 비디오 위치를 넘어갔을 때
    if (rect.top <= 0 && isPlaying) {
        videoContainer.style.position = 'fixed';
        videoContainer.style.top = '0';
        videoContainer.style.width = wrapper.offsetWidth + 'px';
        wrapper.style.height = videoContainer.offsetHeight + 'px';
    } else {
        // 그 외의 경우 기본 위치로
        videoContainer.style.position = 'relative';
        videoContainer.style.top = 'auto';
        videoContainer.style.width = '100%';
        wrapper.style.height = 'auto';
    }
});
