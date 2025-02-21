class YouTubeSRTPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`컨테이너 요소를 찾을 수 없음: ${containerId}`);
            return;
        }
        this.playerId = this.container.querySelector('.video-player').id || 'player'; // 기본 ID 설정
        this.isPlaying = false;
        this.previousTime = 0;
        this.isTimeSeek = false;
        this.player = null;
        this.currentCorner = 'corner-bottom-right'; // 기본 위치: 우측 하단
        this.isMiniMode = false;
        this.isFullScreen = false;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.initialize();
    }

    safeQuerySelector(selector) {
        const element = this.container.querySelector(selector);
        if (!element) {
            console.warn(`요소를 찾을 수 없음: ${selector}`);
        }
        return element;
    }

    initialize() {
        this.loadYouTubeAPI().then(() => {
            this.player = new YT.Player(this.playerId, {
                events: {
                    onReady: this.onPlayerReady.bind(this),
                    onStateChange: this.onPlayerStateChange.bind(this),
                },
            });

            const expandButton = this.safeQuerySelector('[data-target="video-expand"]');
            const miniPlayerBtn = this.safeQuerySelector('[data-target="mini-player"]');
            const fullscreenBtn = this.safeQuerySelector('[data-target="fullscreen"]');

            if (expandButton) {
                expandButton.addEventListener('click', this.toggleVideoExpand.bind(this));
            }
            if (miniPlayerBtn) {
                miniPlayerBtn.addEventListener('click', this.toggleMiniPlayer.bind(this));
            }
            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', this.toggleFullScreen.bind(this));
            }

            const videoContainer = this.safeQuerySelector('.video-container');
            if (videoContainer) {
                // 드래그 앤 드롭 이벤트
                videoContainer.addEventListener('mousedown', this.startDrag.bind(this));
                document.addEventListener('mousemove', this.drag.bind(this));
                document.addEventListener('mouseup', this.stopDrag.bind(this));
            }

            window.addEventListener('resize', this.handleResize.bind(this));
        });
    }

    loadYouTubeAPI() {
        return new Promise((resolve, reject) => {
            if (window.YT) {
                resolve(window.YT);
                return;
            }
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onload = () => {
                window.onYouTubeIframeAPIReady = () => resolve(window.YT);
            };
            tag.onerror = reject;
            document.head.appendChild(tag);
        });
    }

    onPlayerReady() {
        console.log('플레이어 준비 완료');
    }

    onPlayerStateChange(event) {
        if (!this.player || !this.player.getCurrentTime) return;
        const currentTime = this.player.getCurrentTime();
        const timeDiff = Math.abs(currentTime - this.previousTime);
        this.isTimeSeek = timeDiff >= 0.5;

        const wasPlaying = this.isPlaying;
        if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.isPlaying = false;
        }
        this.previousTime = currentTime;
    }

    toggleVideoExpand() {
        const videoContainer = this.safeQuerySelector('.video-container');
        const expandButton = this.safeQuerySelector('[data-target="video-expand"]');
        if (!videoContainer || !expandButton) return;

        if (videoContainer.classList.contains('expanded')) {
            videoContainer.classList.remove('expanded');
            videoContainer.style.maxWidth = '100%'; // 본문 크기로 축소
            expandButton.innerHTML = '<i class="fas fa-expand"></i>';
        } else {
            videoContainer.classList.add('expanded');
            videoContainer.style.maxWidth = '100vw'; // 브라우저 최대 가로폭으로 확장
            expandButton.innerHTML = '<i class="fas fa-compress"></i>';
        }
        this.handleResize();
    }

    toggleMiniPlayer() {
        const videoContainer = this.safeQuerySelector('.video-container');
        const miniPlayerBtn = this.safeQuerySelector('[data-target="mini-player"]');
        if (!videoContainer || !miniPlayerBtn) return;

        if (this.isMiniMode) {
            // 소형 모드 비활성화 (원래 크기로 복원)
            videoContainer.classList.remove('mini-mode', 'corner-bottom-right', 'corner-top-right', 'corner-top-left', 'corner-bottom-left');
            videoContainer.style.position = 'relative';
            videoContainer.style.width = '';
            videoContainer.style.height = '';
            videoContainer.style.maxWidth = '100%';
            miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
            miniPlayerBtn.classList.remove('active');
        } else {
            // 소형 모드 활성화 (우측 하단으로 이동)
            videoContainer.classList.add('mini-mode', this.currentCorner);
            videoContainer.style.width = '350px';
            videoContainer.style.height = 'auto';
            miniPlayerBtn.innerHTML = '<i class="fas fa-expand"></i>';
            miniPlayerBtn.classList.add('active');
        }
        this.isMiniMode = !this.isMiniMode;
        this.handleResize();
    }

    toggleFullScreen() {
        const videoContainer = this.safeQuerySelector('.video-container');
        const fullscreenBtn = this.safeQuerySelector('[data-target="fullscreen"]');
        if (!videoContainer || !fullscreenBtn) return;

        if (!this.isFullScreen) {
            if (videoContainer.requestFullscreen) {
                videoContainer.requestFullscreen();
            } else if (videoContainer.mozRequestFullScreen) { // Firefox
                videoContainer.mozRequestFullScreen();
            } else if (videoContainer.webkitRequestFullscreen) { // Chrome, Safari
                videoContainer.webkitRequestFullscreen();
            } else if (videoContainer.msRequestFullscreen) { // IE/Edge
                videoContainer.msRequestFullscreen();
            }
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>';
        }
        this.isFullScreen = !this.isFullScreen;
    }

    startDrag(e) {
        if (!this.isMiniMode) return;
        this.isDragging = true;
        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;
        const rect = videoContainer.getBoundingClientRect();
        this.dragStartX = e.clientX - rect.left;
        this.dragStartY = e.clientY - rect.top;
        videoContainer.style.transition = 'none'; // 드래그 중 부드러운 전환 비활성화
    }

    drag(e) {
        if (!this.isDragging || !this.isMiniMode) return;
        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const containerWidth = 350; // 소형 플레이어 너비
        const containerHeight = videoContainer.offsetHeight;

        let newX = e.clientX - this.dragStartX;
        let newY = e.clientY - this.dragStartY;

        // 경계 체크
        newX = Math.max(20, Math.min(newX, windowWidth - containerWidth - 20));
        newY = Math.max(20, Math.min(newY, windowHeight - containerHeight - 20));

        // 네 귀퉁이로 스냅 (20px 내에서 자동 고정)
        const corners = {
            'corner-top-right': { x: windowWidth - containerWidth - 20, y: 20 },
            'corner-top-left': { x: 20, y: 20 },
            'corner-bottom-left': { x: 20, y: windowHeight - containerHeight - 20 },
            'corner-bottom-right': { x: windowWidth - containerWidth - 20, y: windowHeight - containerHeight - 20 }
        };

        let closestCorner = 'corner-bottom-right'; // 기본값
        let minDistance = Infinity;

        for (const [corner, pos] of Object.entries(corners)) {
            const dx = newX - pos.x;
            const dy = newY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistance && distance < 20) { // 20px 이내로 스냅
                minDistance = distance;
                closestCorner = corner;
            }
        }

        if (minDistance < 20) {
            newX = corners[closestCorner].x;
            newY = corners[closestCorner].y;
            this.currentCorner = closestCorner;
        }

        videoContainer.style.left = `${newX}px`;
        videoContainer.style.top = `${newY}px`;
    }

    stopDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;
        videoContainer.style.transition = 'all 0.3s ease'; // 드래그 후 부드러운 전환 활성화
    }

    handleResize() {
        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;

        if (this.isMiniMode) {
            videoContainer.style.width = '350px';
            videoContainer.style.height = 'auto';
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const containerWidth = 350;
            const containerHeight = videoContainer.offsetHeight;

            const corners = {
                'corner-top-right': { x: windowWidth - containerWidth - 20, y: 20 },
                'corner-top-left': { x: 20, y: 20 },
                'corner-bottom-left': { x: 20, y: windowHeight - containerHeight - 20 },
                'corner-bottom-right': { x: windowWidth - containerWidth - 20, y: windowHeight - containerHeight - 20 }
            };

            if (corners[this.currentCorner]) {
                videoContainer.style.left = `${corners[this.currentCorner].x}px`;
                videoContainer.style.top = `${corners[this.currentCorner].y}px`;
            }
        } else if (videoContainer.classList.contains('expanded')) {
            videoContainer.style.maxWidth = '100vw';
        } else {
            videoContainer.style.maxWidth = '100%';
            videoContainer.style.position = 'relative';
            videoContainer.style.left = '';
            videoContainer.style.top = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const playerContainers = document.querySelectorAll('.youtube-srt-player');
    playerContainers.forEach(container => {
        new YouTubeSRTPlayer(container.id);
    });
});