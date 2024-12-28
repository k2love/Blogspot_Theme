/**
 * YouTube SRT Player Library
 * 유튜브 영상과 SRT 자막을 동기화하여 표시하는 플레이어
 * 영상 재생 시 스크롤에 따라 화면 상단에 고정되는 기능 포함
 */

class YouTubeSRTPlayer {
    constructor() {
        this.player = null;
        this.isPlaying = false;
        this.subtitles = [];
        this.subtitleUpdateInterval = null;
        
        // YouTube API 로드
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // 이벤트 바인딩
        this.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        
        // 스크롤 이벤트 리스너 등록
        window.addEventListener('scroll', this.handleScroll);
        
        // YouTube API 준비 완료 시 호출될 전역 함수 설정
        window.onYouTubeIframeAPIReady = () => this.onYouTubeIframeAPIReady();
    }

    /**
     * 플레이어 초기화
     * @param {string} videoId - YouTube 비디오 ID
     * @param {string} srtUrl - 자막 파일 URL
     */
    initialize(videoId, srtUrl) {
        if (typeof YT !== 'undefined' && YT.Player) {
            this.createPlayer(videoId, srtUrl);
        } else {
            setTimeout(() => this.initialize(videoId, srtUrl), 100);
        }
    }

    /**
     * YouTube 플레이어 생성
     */
    createPlayer(videoId, srtUrl) {
        this.player = new YT.Player('player', {
            videoId: videoId,
            playerVars: {
                'host': 'https://www.youtube.com',
                'origin': window.location.origin,
                'enablejsapi': 1,
                'autoplay': 0,
                'controls': 1
            },
            events: {
                'onReady': () => this.onPlayerReady(srtUrl),
                'onStateChange': (event) => this.onPlayerStateChange(event)
            }
        });
    }

    /**
     * SRT 파일 파싱
     */
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
                return (hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(ms));
            });

            return {
                index: parseInt(lines[0], 10),
                startTime,
                endTime,
                text: lines.slice(2).join('\n').trim()
            };
        }).filter(entry => entry !== null);
    }

    /**
     * 자막 로드 및 파싱
     */
    async loadSubtitles(srtUrl) {
        try {
            const response = await fetch(srtUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const srtContent = await response.text();
            this.subtitles = this.parseSRT(srtContent);
            return this.subtitles;
        } catch (error) {
            console.error('자막 로드 에러:', error);
            throw error;
        }
    }

    /**
     * 플레이어 준비 완료 핸들러
     */
    onPlayerReady(srtUrl) {
        this.loadSubtitles(srtUrl).then(() => {
            if (this.subtitleUpdateInterval) {
                clearInterval(this.subtitleUpdateInterval);
            }
            this.subtitleUpdateInterval = setInterval(() => this.updateSubtitle(), 100);
        });
    }

    /**
     * 플레이어 상태 변경 핸들러
     */
    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
        window.dispatchEvent(new Event('scroll'));
    }

    /**
     * 자막 업데이트
     */
    updateSubtitle() {
        if (!this.player || !this.player.getCurrentTime) return;

        const currentTime = this.player.getCurrentTime() * 1000;
        const currentSubtitle = this.subtitles.find(subtitle =>
            currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
        );

        const subtitleText = document.getElementById('subtitle-text');
        if (subtitleText) {
            subtitleText.textContent = currentSubtitle ? currentSubtitle.text : '';
        }
    }

    /**
     * 스크롤 이벤트 핸들러
     */
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

    /**
     * YouTube API 준비 완료 핸들러
     */
    onYouTubeIframeAPIReady() {
        // YouTubePlayer가 이미 초기화되어 있다면 실행
        if (window.YOUTUBE_CONFIG) {
            this.initialize(
                window.YOUTUBE_CONFIG.videoId,
                window.YOUTUBE_CONFIG.srtUrl
            );
        }
    }
}

// 플레이어 인스턴스 생성
window.youtubeSRTPlayer = new YouTubeSRTPlayer();
