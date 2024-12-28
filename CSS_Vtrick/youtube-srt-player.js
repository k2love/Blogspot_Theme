/**
 * YouTube SRT Player Library
 * 유튜브 영상과 자막을 동기화하여 표시하는 플레이어
 * 스크롤 시 영상 고정 기능 포함
 */

class YouTubeSRTPlayer {
    constructor() {
        // 클래스 속성 초기화
        this.player = null;
        this.isPlaying = false;
        this.subtitles = [];
        this.subtitleUpdateInterval = null;
        this.initialized = false;

        // 메서드 바인딩
        this.handleScroll = this.handleScroll.bind(this);
        this.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(this);

        // 스크롤 이벤트 리스너 등록
        window.addEventListener('scroll', this.handleScroll);

        // YouTube API 준비 완료 시 호출될 전역 함수 설정
        window.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady;

        // API 로드 시작
        this.loadYouTubeAPI();
    }

    /**
     * YouTube IFrame API 스크립트 로드
     */
    loadYouTubeAPI() {
        if (document.querySelector('script[src*="iframe_api"]')) {
            return; // 이미 로드된 경우 스킵
        }

        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    /**
     * 플레이어 초기화
     */
    initialize(videoId, srtUrl) {
        if (this.initialized) {
            console.warn('Player already initialized');
            return;
        }

        if (!videoId || !srtUrl) {
            console.error('Missing required parameters:', { videoId, srtUrl });
            return;
        }

        // YT API 준비 확인
        if (typeof YT !== 'undefined' && YT.Player) {
            this.setupPlayer(videoId, srtUrl);
        } else {
            setTimeout(() => this.initialize(videoId, srtUrl), 100);
        }
    }

    /**
     * 플레이어 설정
     */
    setupPlayer(videoId, srtUrl) {
        const playerElement = document.getElementById('player');
        if (!playerElement) {
            console.error('Player element not found');
            return;
        }

        // iframe이 이미 존재하는 경우
        if (playerElement.tagName === 'IFRAME') {
            this.player = new YT.Player(playerElement);
            this.onPlayerReady(srtUrl);
            return;
        }

        // 새 플레이어 생성
        this.player = new YT.Player('player', {
            videoId: videoId,
            playerVars: {
                enablejsapi: 1,
                origin: window.location.origin,
                autoplay: 0,
                controls: 1,
                playsinline: 1,
                modestbranding: 1,
                rel: 0
            },
            events: {
                onReady: () => this.onPlayerReady(srtUrl),
                onStateChange: this.onPlayerStateChange.bind(this),
                onError: (event) => {
                    const errors = {
                        2: '매개변수가 유효하지 않습니다',
                        5: 'HTML5 플레이어 오류',
                        100: '요청한 비디오를 찾을 수 없습니다',
                        101: '동영상 소유자가 웹사이트에서의 재생을 허용하지 않습니다',
                        150: '동영상 소유자가 웹사이트에서의 재생을 허용하지 않습니다'
                    };
                    console.error('Player Error:', errors[event.data] || '알 수 없는 오류');
                }
            }
        });
    }

    /**
     * SRT 파싱
     */
    parseSRT(content) {
        if (!content) return [];

        const entries = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n\n');
        return entries.map(entry => {
            const lines = entry.trim().split('\n');
            if (lines.length < 3) return null;

            const [time, ms] = lines[1].split(' --> ').map(timeStr => {
                const [t, m] = timeStr.trim().split(',');
                const [h, mm, s] = t.split(':').map(Number);
                return h * 3600000 + mm * 60000 + s * 1000 + parseInt(m);
            });

            return {
                index: parseInt(lines[0], 10),
                startTime: time,
                endTime: ms,
                text: lines.slice(2).join('\n').trim()
            };
        }).filter(Boolean);
    }

    /**
     * 자막 로드
     */
    async loadSubtitles(srtUrl) {
        try {
            const response = await fetch(srtUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const content = await response.text();
            this.subtitles = this.parseSRT(content);
            
            if (this.subtitleUpdateInterval) {
                clearInterval(this.subtitleUpdateInterval);
            }
            this.subtitleUpdateInterval = setInterval(() => this.updateSubtitle(), 100);
        } catch (error) {
            console.error('Failed to load subtitles:', error);
        }
    }

    /**
     * 자막 업데이트
     */
    updateSubtitle() {
        if (!this.player?.getCurrentTime) return;

        const time = this.player.getCurrentTime() * 1000;
        const current = this.subtitles.find(sub => 
            time >= sub.startTime && time <= sub.endTime
        );

        const element = document.getElementById('subtitle-text');
        if (element) {
            element.textContent = current ? current.text : '';
        }
    }

    /**
     * 플레이어 준비 완료 핸들러
     */
    onPlayerReady(srtUrl) {
        this.loadSubtitles(srtUrl);
        this.initialized = true;
    }

    /**
     * 플레이어 상태 변경 핸들러
     */
    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
        window.dispatchEvent(new Event('scroll'));
    }

    /**
     * 스크롤 핸들러
     */
    handleScroll() {
        const container = document.querySelector('.video-container');
        const wrapper = document.querySelector('.sticky-wrapper');
        if (!container || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        
        if (rect.top <= 0 && this.isPlaying) {
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.width = `${wrapper.offsetWidth}px`;
            wrapper.style.height = `${container.offsetHeight}px`;
        } else {
            container.style.position = 'relative';
            container.style.top = 'auto';
            container.style.width = '100%';
            wrapper.style.height = 'auto';
        }
    }

    /**
     * YouTube API 준비 완료 핸들러
     */
    onYouTubeIframeAPIReady() {
        if (window.YOUTUBE_CONFIG) {
            this.initialize(
                window.YOUTUBE_CONFIG.videoId,
                window.YOUTUBE_CONFIG.srtUrl
            );
        }
    }
}

// DOM 로드 완료 시 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeSRTPlayer = new YouTubeSRTPlayer();
});
