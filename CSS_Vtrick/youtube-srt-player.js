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
    const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const entries = normalizedContent.trim().split('\n\n');

    return entries.map(entry => {
        const lines = entry.trim().split('\n');
        if (lines.length < 3) return null;

        const timeCode = lines[1].trim();
        const [startTime, endTime] = timeCode.split(' --> ').map(timeStr => {
            const [time, ms] = timeStr.trim().split(',');
            const [hours, minutes, seconds] = time.split(':').map(Number);
            return (
                hours * 3600000 +
                minutes * 60000 +
                seconds * 1000 +
                parseInt(ms)
            );
        });

        const text = lines.slice(2).join('\n').trim();

        return {
            index: parseInt(lines[0], 10),
            startTime,
            endTime,
            text
        };
    }).filter(entry => entry !== null);
};

// 전역 변수 선언
let player;
let subtitles = [];
let isPlaying = false;

/**
 * SRT 자막 파일을 로드하고 파싱하는 함수
 * @param {string} subtitleUrl - 자막 파일의 URL
 * @returns {Promise<Array>} 파싱된 자막 데이터
 */
async function loadSubtitles(subtitleUrl) {
    try {
        const response = await fetch(subtitleUrl);
        const srtContent = await response.text();
        return parseSRT(srtContent);
    } catch (error) {
        console.error('자막을 불러오는데 실패했습니다:', error);
    }
}

// YouTube IFrame API 스크립트 로드
document.addEventListener('DOMContentLoaded', function() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
});

/**
 * YouTube IFrame API 준비 완료 시 호출되는 함수
 * 플레이어 인스턴스 생성
 */
function onYouTubeIframeAPIReady() {
    const playerContainer = document.getElementById('player-container');
    const videoId = playerContainer?.getAttribute('data-video-id');

    if (!videoId) {
        console.error('비디오 ID가 제공되지 않았습니다.');
        return;
    }

    player = new YT.Player('player', {
        videoId: videoId,
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

/**
 * 플레이어 준비 완료 시 호출되는 함수
 * 자막 로드 및 업데이트 타이머 시작
 */
function onPlayerReady(event) {
    const playerContainer = document.getElementById('player-container');
    const subtitleUrl = playerContainer?.getAttribute('data-subtitle-url');

    if (!subtitleUrl) {
        console.error('자막 URL이 제공되지 않았습니다.');
        return;
    }

    loadSubtitles(subtitleUrl).then(loadedSubtitles => {
        subtitles = loadedSubtitles;
        setInterval(updateSubtitle, 100);
    });
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

    const time = player.getCurrentTime() * 1000;
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

    if (!wrapper || !videoContainer) {
        console.error("필요한 요소가 누락되었습니다. wrapper 또는 videoContainer를 확인하세요.");
        return;
    }

    const rect = wrapper.getBoundingClientRect();

    if (rect.top <= 0 && isPlaying) {
        videoContainer.style.position = 'fixed';
        videoContainer.style.top = '0';
        videoContainer.style.width = wrapper.offsetWidth + 'px';
        wrapper.style.height = videoContainer.offsetHeight + 'px';
    } else {
        videoContainer.style.position = 'relative';
        videoContainer.style.top = 'auto';
        videoContainer.style.width = '100%';
        wrapper.style.height = 'auto';
    }
});
