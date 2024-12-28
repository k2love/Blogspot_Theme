class YouTubeSRTPlayer {
    constructor() {
        this.player = null;
        this.isPlaying = false;
        this.subtitles = [];
        
        // YouTube API 로드
        this.loadYouTubeAPI();
        
        // 스크롤 이벤트 리스너 추가
        window.addEventListener('scroll', () => this.handleScroll());
    }

    loadYouTubeAPI() {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // YouTube API 로드 완료 후 호출될 전역 함수
        window.onYouTubeIframeAPIReady = () => {
            this.setupPlayer();
        };
    }

    setupPlayer(videoId = null, srtUrl = null) {
        // videoId와 srtUrl을 인자로 받거나 기본값 사용
        const playerConfig = {
            videoId: videoId || this.getVideoIdFromConfig(),
            events: {
                'onReady': (event) => this.onPlayerReady(event, srtUrl),
                'onStateChange': (event) => this.onPlayerStateChange(event),
                'onError': (error) => this.handlePlayerError(error)
            }
        };

        const playerElement = document.getElementById('player');
        if (!playerElement) {
            console.error('Player element not found');
            return;
        }

        this.player = new YT.Player(playerElement, playerConfig);
    }

    getVideoIdFromConfig() {
        // 전역 설정에서 비디오 ID 가져오기 (선택적)
        return window.YOUTUBE_CONFIG && window.YOUTUBE_CONFIG.videoId 
            ? window.YOUTUBE_CONFIG.videoId 
            : null;
    }

    onPlayerReady(event, srtUrl = null) {
        console.log('Player is ready');
        // SRT URL을 제공받았거나 설정에서 가져오기
        const subtitleUrl = srtUrl || (window.YOUTUBE_CONFIG && window.YOUTUBE_CONFIG.srtUrl);
        if (subtitleUrl) {
            this.loadSubtitles(subtitleUrl);
        }
    }

    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
        this.handleScroll();
    }

    handlePlayerError(error) {
        console.error('YouTube Player Error:', error);
    }

    handleScroll() {
        const videoContainer = document.querySelector('.video-container');
        const wrapper = document.querySelector('.sticky-wrapper');
        
        if (!videoContainer || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        
        if (rect.top <= 0 && this.isPlaying) {
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
    }

    async loadSubtitles(srtUrl) {
        try {
            const response = await fetch(srtUrl);
            const srtContent = await response.text();
            this.subtitles = this.parseSRT(srtContent);
            
            // 자막 업데이트 인터벌 설정
            if (this.subtitleInterval) {
                clearInterval(this.subtitleInterval);
            }
            this.subtitleInterval = setInterval(() => this.updateSubtitle(), 100);
        } catch (error) {
            console.error('자막 로드 실패:', error);
        }
    }

    parseSRT(srtContent) {
        const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const entries = normalizedContent.trim().split('\n\n');
        
        return entries.map(entry => {
            const lines = entry.trim().split('\n');
            if (lines.length < 3) return null;

            const timeCode = lines[1].trim();
            const [startTime, endTime] = timeCode.split(' --> ').map(timeStr => {
                const [time, ms] = timeStr.trim().split(',');
                const [hours, minutes, seconds] = time.split(':').map(Number);
                return (hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(ms || 0));
            });

            return {
                index: parseInt(lines[0], 10),
                startTime,
                endTime,
                text: lines.slice(2).join('\n').trim()
            };
        }).filter(entry => entry !== null);
    }

    updateSubtitle() {
        if (!this.player || !this.player.getCurrentTime) return;

        const time = this.player.getCurrentTime() * 1000;
        const currentSubtitle = this.subtitles.find(subtitle => 
            time >= subtitle.startTime && time <= subtitle.endTime
        );

        const subtitleText = document.getElementById('subtitle-text');
        if (subtitleText) {
            subtitleText.textContent = currentSubtitle ? currentSubtitle.text : '';
        }
    }
}

// DOMContentLoaded 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
    // 전역 객체로 인스턴스 노출
    window.youtubeSRTPlayer = new YouTubeSRTPlayer();
});
