class YouTubeSRTPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`컨테이너 요소를 찾을 수 없음: ${containerId}`);
            return;
        }
        this.playerId = this.container.querySelector('.video-player').id;
        this.subtitles = {
            ko: [],
            en: [],
            extra: [],
        };
        this.isPlaying = false;
        this.previousTime = 0;
        this.isTimeSeek = false;
        this.player = null; // player 객체 초기화
        this.currentCorner = 'corner-top-right'; // 현재 모서리 위치
        this.isMiniMode = false; // 소형 플레이어 모드 상태

        this.initialize();
    }

    safeQuerySelector(selector) {
        const element = this.container.querySelector(selector);
        if (!element) {
            console.warn(`요소를 찾을 수 없음: ${selector}`);
        }
        return element;
    }

    createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.style.height = '0px';
        const videoContainer = this.safeQuerySelector('.video-container');
        if (videoContainer) {
            videoContainer.parentNode.insertBefore(placeholder, videoContainer.nextSibling);
        }
        return placeholder;
    }

    parseSRT(srtContent) {
         try {
            const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const entries = normalizedContent.trim().split('\n\n');

            return entries
                .map((entry) => {
                    const lines = entry.trim().split('\n');
                    if (lines.length < 3) return null;

                    const timeCode = lines[1].trim();
                    const [startTime, endTime] = timeCode.split(' --> ').map((timeStr) => {
                        const [time, ms] = timeStr.trim().split(',');
                        const [hours, minutes, seconds] = time.split(':').map(Number);
                        return hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(ms || '0');
                    });

                    const text = lines.slice(2).join('\n').trim();

                    return {
                        index: parseInt(lines[0], 10),
                        startTime,
                        endTime,
                        text,
                    };
                })
                .filter((entry) => entry !== null);
        } catch (error) {
            console.error('SRT 파싱 중 오류 발생:', error);
            return [];
        }
    }

    async loadSubtitles() {
        const subtitleLoaders = [
            {
                elementId: 'subtitle-url-ko',
                subtitlesArray: this.subtitles.ko,
                logName: '한국어',
            },
            {
                elementId: 'subtitle-url-en',
                subtitlesArray: this.subtitles.en,
                logName: '영어',
            },
            {
                elementId: 'subtitle-url-extra',
                subtitlesArray: this.subtitles.extra,
                logName: '추가',
            },
        ];

        for (const loader of subtitleLoaders) {
            const subtitleElement = this.container.querySelector(`#${loader.elementId}`);
              if (!subtitleElement) {
                console.warn(`${loader.logName} 자막 요소를 찾을 수 없음`);
                continue;
            }
            const srtUrl = subtitleElement.dataset.url;
            if (!srtUrl) {
                console.warn(`${loader.logName} 자막 URL이 제공되지 않음`);
                continue;
            }
            try {
                const response = await fetch(srtUrl);
                if (!response.ok) {
                    throw new Error(`HTTP 오류! 상태: ${response.status}`);
                }
                const srtContent = await response.text();
                loader.subtitlesArray.splice(0, loader.subtitlesArray.length, ...this.parseSRT(srtContent));
                console.log(`${loader.logName} 자막 로드 성공:`, loader.subtitlesArray.length);
            } catch (error) {
                console.error(`${loader.logName} 자막 로드 실패:`, error);
            }
        }
    }

    updateSubtitles() {
         if (!this.player || !this.player.getCurrentTime) return;
        const time = this.player.getCurrentTime() * 1000;

        [
            { element: 'subtitle-text-ko', subtitles: this.subtitles.ko },
            { element: 'subtitle-text-en', subtitles: this.subtitles.en },
            { element: 'subtitle-text-extra', subtitles: this.subtitles.extra },
        ].forEach(({ element, subtitles }) => {
             const container = this.container.querySelector(`#${element}`);
            if (!container || container.classList.contains('hidden')) return;
            const contentDiv = container.querySelector('.subtitle-content');
            if (!contentDiv) return;
            const currentSubtitle = subtitles.find(
                (subtitle) => time >= subtitle.startTime && time <= subtitle.endTime
            );
            contentDiv.innerHTML = currentSubtitle
                ? `<span>${currentSubtitle.text.replace(/\n/g, '<br>')}</span>`
                : '';
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
                window.onYouTubeIframeAPIReady = () => {
                    resolve(window.YT);
                };
            };
            tag.onerror = reject;
            document.head.appendChild(tag);
        });
    }

    initialize() {
        const elements = this.initializeElements();
        if (!elements) return;

        this.loadYouTubeAPI().then(() => {
            this.player = new YT.Player(this.playerId, {
                events: {
                    onReady: this.onPlayerReady.bind(this),
                    onStateChange: this.onPlayerStateChange.bind(this),
                },
            });

            // 소형 플레이어 버튼 이벤트
            const { miniPlayerBtn } = elements;
            if (miniPlayerBtn) {
                miniPlayerBtn.addEventListener('click', this.toggleMiniPlayer.bind(this));
            }

            // 소형 플레이어 모드에서 더블클릭으로 모서리 변경
            const videoContainer = this.safeQuerySelector('.video-container');
            if (videoContainer) {
                videoContainer.addEventListener('dblclick', (e) => {
                    if (this.isMiniMode) {
                        e.preventDefault();
                        this.cycleCorner();
                    }
                });
            }

        const expandButton = this.safeQuerySelector('[data-target="video-expand"]');
        if (expandButton) {
            expandButton.addEventListener('click', this.toggleVideoExpand.bind(this));
        }

         window.addEventListener('scroll', this.updateVideoPosition.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }


    toggleMiniPlayer() {
        const videoContainer = this.safeQuerySelector('.video-container');
        const miniPlayerBtn = this.safeQuerySelector('[data-target="mini-player"]');


        if (this.isMiniMode) {
            // 소형 플레이어 모드 활성화
            videoContainer.classList.add('mini-mode', this.currentCorner);
            miniPlayerBtn.innerHTML = '<i class="fas fa-expand"></i>';
            miniPlayerBtn.classList.add('active');
        } else {
            // 소형 플레이어 모드 비활성화
            videoContainer.classList.remove('mini-mode', 'corner-top-right', 'corner-top-left', 'corner-bottom-right', 'corner-bottom-left');
            miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
            miniPlayerBtn.classList.remove('active');
        }

        this.handleResize();
    }

    cycleCorner() {
        if (!this.isMiniMode) return;

        const corners = [
            'corner-top-right',
            'corner-top-left',
            'corner-bottom-left',
            'corner-bottom-right'
        ];

        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;

        // 현재 모서리 클래스 제거
        videoContainer.classList.remove(...corners);
        
        // 다음 모서리 선택
        const currentIndex = corners.indexOf(this.currentCorner);
        this.currentCorner = corners[(currentIndex + 1) % corners.length];
        
        // 새로운 모서리 클래스 추가
        videoContainer.classList.add(this.currentCorner);
    }

    onPlayerReady() {
       try {
            this.loadSubtitles();
            this.initializeSubtitleToggles();
            this.updateSubtitles();
             setInterval(this.updateSubtitles.bind(this), 100);
        } catch (error) {
            console.error('자막 로딩 중 심각한 오류 발생:', error);
        }
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

        if (!this.isTimeSeek && wasPlaying !== this.isPlaying) {
            this.updateVideoPosition();
        }
        this.previousTime = currentTime;
    }

   updateVideoPosition() {
        if (this.isMiniMode) return; // 소형 플레이어 모드일 때는 기존 sticky 동작 무시

        const elements = this.initializeElements();
        if (!elements) return;

        const { videoContainer, placeholder } = elements;
        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const videoHeight = videoContainer.offsetHeight;

        if (!this.isPlaying) {
            requestAnimationFrame(() => {
                videoContainer.style.transition = 'all 0.3s ease';
                placeholder.style.transition = 'height 0.3s ease';
                videoContainer.classList.remove('fixed', 'fixed-bottom');
                placeholder.style.height = '0';
                videoContainer.style.maxWidth = '';
            });
            return;
        }

        if (this.isTimeSeek) {
            return;
        }

        if (rect.top < 0) {
            videoContainer.classList.add('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        } else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.add('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        } else {
            videoContainer.classList.remove('fixed', 'fixed-bottom');
            placeholder.style.height = '0';
            videoContainer.style.maxWidth = '';
        }
    }


    initializeSubtitleToggles() {
        const toggleButtons = this.container.querySelectorAll('.toggle-btn');
        toggleButtons.forEach((button) => {
            const targetId = button.dataset.target;
            const targetContainer = this.container.querySelector(`#${targetId}`);
            if (!targetContainer) {
                console.warn(`대상 컨테이너를 찾을 수 없음: ${targetId}`);
                return;
            }

            const isVisible = localStorage.getItem(`${targetId}-visible`) !== 'false';
            targetContainer.classList.toggle('hidden', !isVisible);
            button.classList.toggle('active', isVisible);

            button.addEventListener('click', () => {
                targetContainer.classList.toggle('hidden');
                button.classList.toggle('active');
                localStorage.setItem(`${targetId}-visible`, !targetContainer.classList.contains('hidden'));
                this.adjustSubtitleContainerHeight();
            });
        });
         this.adjustSubtitleContainerHeight();
    }

     adjustSubtitleContainerHeight() {
        const subtitleContainers = this.container.querySelectorAll('.subtitle-text');
        subtitleContainers.forEach(container => {
            const contentDiv = container.querySelector('.subtitle-content');
            if (contentDiv) {
                container.style.height = contentDiv.offsetHeight + 'px';
            }
        });
    }



    toggleVideoExpand() {
          const videoContainer = this.safeQuerySelector('.video-container');
                if (!videoContainer) return;

        const expandButton = this.safeQuerySelector('[data-target="video-expand"]');
        if (!expandButton) return;


                if (videoContainer.classList.contains('expanded')) {
                    // 축소 모드로 전환
                    videoContainer.classList.remove('expanded');
                    expandButton.innerHTML = '<i class="fas fa-expand"></i>';
                } else {
                    // 확장 모드로 전환
                    videoContainer.classList.add('expanded');
                     expandButton.innerHTML = '<i class="fas fa-compress"></i>';
                }


                // 플레이어 크기 재조정
                if (this.player && this.player.getIframe) {
                    const iframe = this.player.getIframe();
                    if (iframe) {
                        requestAnimationFrame(() => {
                            iframe.style.width = '100%';
                            iframe.style.height = '100%';
                        });
                    }
                }
      this.handleResize();
    }


     handleResize() {
        const videoContainer = this.safeQuerySelector('.video-container');
        if (!videoContainer) return;

        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        if (this.isMiniMode) {
            // 소형 플레이어 모드일 때는 고정된 크기 유지
            videoContainer.style.maxWidth = '350px';
        } else if (
            videoContainer.classList.contains('fixed') ||
            videoContainer.classList.contains('fixed-bottom')
        ) {
            // 일반 sticky 모드
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const playerContainers = document.querySelectorAll('.youtube-srt-player');
    playerContainers.forEach(container => {
        new YouTubeSRTPlayer(container.id);
    });
});