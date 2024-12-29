class YouTubeSRTPlayer {
    constructor(config) {
        this.config = {
            playerContainerId: 'player-container',
            subtitleTextId: 'subtitle-text',
            ...config
        };

        this.player = null;
        this.subtitles = [];
        this.isPlaying = false;
        this.subtitleTimer = null;

        this.initializePlayer();
        this.setupScrollListener();
    }

    // YouTube IFrame API 스크립트 동적 로드
    loadYouTubeAPI() {
        return new Promise((resolve, reject) => {
            if (window.YT && window.YT.Player) {
                resolve();
                return;
            }

            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            tag.onload = resolve;
            tag.onerror = reject;
            document.head.appendChild(tag);

            window.onYouTubeIframeAPIReady = resolve;
        });
    }

    // SRT 파일 파싱 메서드
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
    }

    // 자막 로드 메서드
    async loadSubtitles(subtitleUrl) {
        try {
            const response = await fetch(subtitleUrl);
            const srtContent = await response.text();
            this.subtitles = this.parseSRT(srtContent);
            return this.subtitles;
        } catch (error) {
            console.error('자막을 불러오는데 실패했습니다:', error);
            return [];
        }
    }

    // 플레이어 초기화 메서드
    async initializePlayer() {
        try {
            await this.loadYouTubeAPI();

            const playerContainer = document.getElementById(this.config.playerContainerId);
            const videoId = playerContainer?.getAttribute('data-video-id');
            const subtitleUrl = playerContainer?.getAttribute('data-subtitle-url');

            if (!videoId) {
                throw new Error('비디오 ID가 제공되지 않았습니다.');
            }

            this.player = new YT.Player('player', {
                videoId: videoId,
                events: {
                    'onReady': (event) => this.onPlayerReady(event, subtitleUrl),
                    'onStateChange': (event) => this.onPlayerStateChange(event)
                }
            });
        } catch (error) {
            console.error('플레이어 초기화 중 오류:', error);
        }
    }

    // 플레이어 준비 완료 시 호출
    async onPlayerReady(event, subtitleUrl) {
        console.log("플레이어 준비 완료");

        if (subtitleUrl) {
            await this.loadSubtitles(subtitleUrl);
            this.startSubtitleTimer();
        }
    }

    // 플레이어 상태 변경 처리
    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
        console.log("Player state changed:", event.data);
    }

    // 자막 타이머 시작
    startSubtitleTimer() {
        if (this.subtitleTimer) {
            clearInterval(this.subtitleTimer);
        }
        this.subtitleTimer = setInterval(() => this.updateSubtitle(), 100);
    }

    // 현재 자막 업데이트
    updateSubtitle() {
        if (!this.player || !this.player.getCurrentTime) return;

        const time = this.player.getCurrentTime() * 1000;
        const currentSubtitle = this.subtitles.find(subtitle => 
            time >= subtitle.startTime && time <= subtitle.endTime
        );

        const subtitleText = document.getElementById(this.config.subtitleTextId);
        if (currentSubtitle && subtitleText) {
            subtitleText.textContent = currentSubtitle.text;
        } else if (subtitleText) {
            subtitleText.textContent = '';
        }
    }

    // 스크롤 이벤트 리스너 설정
    setupScrollListener() {
        window.addEventListener('scroll', () => {
            const videoContainer = document.querySelector('.video-container');
            const wrapper = document.querySelector('.sticky-wrapper');

            if (!wrapper || !videoContainer) {
                console.error("필요한 요소가 누락되었습니다. wrapper 또는 videoContainer를 확인하세요.");
                return;
            }

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
        });
    }

    // 외부에서 자막 URL 업데이트 가능한 메서드
    async updateSubtitleUrl(newSubtitleUrl) {
        try {
            await this.loadSubtitles(newSubtitleUrl);
            this.startSubtitleTimer();
        } catch (error) {
            console.error('자막 업데이트 실패:', error);
        }
    }

    // 플레이어 제거 메서드
    destroy() {
        if (this.subtitleTimer) {
            clearInterval(this.subtitleTimer);
        }
        if (this.player) {
            this.player.destroy();
        }
    }
}

// 사용 예시
document.addEventListener('DOMContentLoaded', () => {
    const player = new YouTubeSRTPlayer();
});
