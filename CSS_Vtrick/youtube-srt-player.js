/**
 * YouTube SRT Player
 * 유튜브 영상과 SRT 자막을 동기화하여 표시하는 플레이어
 * 재생 시 스크롤에 따라 영상이 고정되는 기능 포함
 */

class YouTubeSRTPlayer {
    constructor(config = {}) {
        // 설정 기본값
        this.config = {
            videoId: config.videoId || '',
            srtUrl: config.srtUrl || '',
            playerElementId: config.playerElementId || 'player',
            subtitleElementId: config.subtitleElementId || 'subtitle-text'
        };

        this.player = null;
        this.subtitles = [];
        this.isPlaying = false;

        // YouTube API 스크립트 로드
        this.loadYouTubeAPI();

        // 스크롤 이벤트 리스너 추가
        window.addEventListener('scroll', () => this.handleScroll());
    }

    /**
     * YouTube IFrame API 스크립트 로드
     */
    loadYouTubeAPI() {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        // YouTube API 로드 완료 후 호출될 전역 함수
        window.onYouTubeIframeAPIReady = () => {
            this.initializePlayer();
        };
    }

    /**
     * 플레이어 초기화
     */
    initializePlayer() {
        this.player = new YT.Player(this.config.playerElementId, {
            videoId: this.config.videoId,
            events: {
                'onReady': () => this.onPlayerReady(),
                'onStateChange': (event) => this.onPlayerStateChange(event)
            }
        });
    }

    /**
     * 자막 파싱 함수
     * @param {string} srtContent - SRT 파일의 텍스트 내용 
     * @returns {Array} 파싱된 자막 데이터
     */
    parseSRT(srtContent) {
        // 줄바꿈 문자 정규화
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
                    hours * 3600000 +    // 시간 → 밀리초
                    minutes * 60000 +    // 분 → 밀리초
                    seconds * 1000 +     // 초 → 밀리초
                    parseInt(ms)         // 밀리초
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
    }

    /**
     * SRT 자막 파일 로드
     * @returns {Promise<Array>} 파싱된 자막 데이터
     */
    async loadSubtitles() {
        try {
            const response = await fetch(this.config.srtUrl);
            const srtContent = await response.text();
            return this.parseSRT(srtContent);
        } catch (error) {
            console.error('자막을 불러오는데 실패했습니다:', error);
            return [];
        }
    }

    /**
     * 플레이어 준비 완료 시 호출되는 함수
     */
    async onPlayerReady() {
        this.subtitles = await this.loadSubtitles();
        
        // 자막 업데이트 인터벌 설정
        setInterval(() => this.updateSubtitle(), 100);
    }

    /**
     * 플레이어 상태 변경 시 호출되는 함수
     * @param {Object} event - YouTube 플레이어 이벤트 객체
     */
    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
    }

    /**
     * 현재 재생 시간에 맞는 자막을 화면에 표시하는 함수
     */
    updateSubtitle() {
        if (!this.player || !this.player.getCurrentTime) return;

        const time = this.player.getCurrentTime() * 1000;  // 초를 밀리초로 변환
        const currentSubtitle = this.subtitles.find(subtitle => 
            time >= subtitle.startTime && time <= subtitle.endTime
        );

        const subtitleText = document.getElementById(this.config.subtitleElementId);
        if (subtitleText) {
            subtitleText.textContent = currentSubtitle ? currentSubtitle.text : '';
        }
    }

    /**
     * 스크롤 이벤트 처리
     */
    handleScroll() {
        const videoContainer = document.querySelector('.video-container');
        const wrapper = document.querySelector('.sticky-wrapper');
        
        // 요소가 없으면 처리하지 않음
        if (!videoContainer || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        
        // 재생 중이고 스크롤이 비디오 위치를 넘어갔을 때
        if (rect.top <= 0 && this.isPlaying) {
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
    }
}

// 외부에서 쉽게 사용할 수 있도록 전역 객체에 할당
window.YouTubeSRTPlayer = YouTubeSRTPlayer;
