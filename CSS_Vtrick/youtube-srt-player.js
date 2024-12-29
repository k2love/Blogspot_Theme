// 전역 변수 선언
let player;
let subtitles = [];
let isPlaying = false;
let videoContainer;
let placeholder;

// 초기화 함수
function initializeElements() {
    videoContainer = document.querySelector('.video-container');
    placeholder = document.querySelector('.placeholder');
    
    if (!videoContainer || !placeholder) {
        console.error('필수 요소를 찾을 수 없습니다.');
        return false;
    }
    return true;
}

// SRT 파일 파싱 함수
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
            return hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(ms);
        });

        return {
            index: parseInt(lines[0], 10),
            startTime,
            endTime,
            text: lines.slice(2).join('\n').trim()
        };
    }).filter(entry => entry !== null);
};

// 자막 업데이트 함수
function updateSubtitle() {
    if (!player || !player.getCurrentTime) return;

    const time = player.getCurrentTime() * 1000;
    const currentSubtitle = subtitles.find(subtitle => 
        time >= subtitle.startTime && time <= subtitle.endTime
    );

    const subtitleText = document.getElementById('subtitle-text');
    if (subtitleText) {
        subtitleText.textContent = currentSubtitle ? currentSubtitle.text : '';
    }
}

// 비디오 위치 업데이트 함수
function updateVideoPosition() {
    if (!videoContainer || !placeholder) return;

    const rect = videoContainer.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const videoHeight = videoContainer.offsetHeight;
    
    if (!isPlaying) {
        videoContainer.classList.remove('fixed');
        videoContainer.classList.remove('fixed-bottom');
        videoContainer.style.maxWidth = '';
        placeholder.style.height = '0';
        return;
    }

    if (rect.top < 0) {
        videoContainer.classList.add('fixed');
        videoContainer.classList.remove('fixed-bottom');
        videoContainer.style.maxWidth = `${videoContainer.offsetWidth}px`;
        placeholder.style.height = `${videoHeight}px`;
    } else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
        videoContainer.classList.remove('fixed');
        videoContainer.classList.add('fixed-bottom');
        videoContainer.style.maxWidth = `${videoContainer.offsetWidth}px`;
        placeholder.style.height = `${videoHeight}px`;
    } else {
        videoContainer.classList.remove('fixed');
        videoContainer.classList.remove('fixed-bottom');
        videoContainer.style.maxWidth = '';
        placeholder.style.height = '0';
    }
}

// YouTube API 콜백
function onYouTubeIframeAPIReady() {
    console.log('YouTube API Ready');
    const videoId = document.getElementById('player').getAttribute('data-video-id');
    if (!videoId) {
        console.error('Video ID not found');
        return;
    }

    player = new YT.Player('player', {
        videoId: videoId,
        playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// 플레이어 준비 콜백
function onPlayerReady(event) {
    console.log('Player Ready');
    const srtUrl = document.getElementById('player').getAttribute('data-srt-url');
    if (srtUrl) {
        fetch(srtUrl)
            .then(response => response.text())
            .then(srtContent => {
                subtitles = parseSRT(srtContent);
                setInterval(updateSubtitle, 100);
            })
            .catch(error => console.error('Failed to load subtitles:', error));
    }
}

// 플레이어 상태 변경 콜백
function onPlayerStateChange(event) {
    isPlaying = event.data === YT.PlayerState.PLAYING;
    updateVideoPosition();
}

// 스크롤 및 리사이즈 이벤트 리스너
window.addEventListener('scroll', updateVideoPosition);
window.addEventListener('resize', updateVideoPosition);

// YouTube API 로드
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
