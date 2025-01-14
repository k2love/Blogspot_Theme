class YouTubeSRTPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`컨테이너 요소를 찾을 수 없음: ${containerId}`);
            return;
        }

        // iframe 요소 찾기
        const iframe = this.container.querySelector('.player');
        if (!iframe) {
            console.error('플레이어 iframe을 찾을 수 없음');
            return;
        }
        this.playerId = iframe.id;

        this.subtitles = {
            ko: [],
            en: [],
            extra: [],
        };
        this.isPlaying = false;
        this.previousTime = 0;
        this.isTimeSeek = false;
        this.player = null; // player 객체 초기화

        this.initialize();

        // 컨테이너별 고유 식별자 추가
        this.instanceId = containerId;
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
                elementId: '.subtitle-url-ko',
                subtitlesArray: this.subtitles.ko,
                logName: '한국어',
            },
            {
                elementId: '.subtitle-url-en',
                subtitlesArray: this.subtitles.en,
                logName: '영어',
            },
            {
                elementId: '.subtitle-url-extra',
                subtitlesArray: this.subtitles.extra,
                logName: '추가',
            },
        ];

        for (const loader of subtitleLoaders) {
            const subtitleElement = this.container.querySelector(loader.elementId);
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
        if (!this.player || typeof this.player.getCurrentTime !== 'function') return;
        
        const time = this.player.getCurrentTime() * 1000;

        [
            { selector: '.subtitle-text-ko', subtitles: this.subtitles.ko },
            { selector: '.subtitle-text-en', subtitles: this.subtitles.en },
            { selector: '.subtitle-text-extra', subtitles: this.subtitles.extra },
        ].forEach(({ selector, subtitles }) => {
            const container = this.container.querySelector(selector);
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

            if (!window.onYouTubeIframeAPIReady) {
                window.onYouTubeIframeAPIReady = () => {
                    resolve(window.YT);
                };
                
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                tag.onerror = reject;
                document.head.appendChild(tag);
            } else {
                // API가 이미 로딩 중인 경우 대기
                const checkYT = setInterval(() => {
                    if (window.YT) {
                        clearInterval(checkYT);
                        resolve(window.YT);
                    }
                }, 100);
            }
        });
    }

    async initialize() {
        try {
            await this.loadYouTubeAPI();
            
            // YT.Player 초기화 전에 iframe이 존재하는지 다시 한번 확인
            const iframe = this.container.querySelector(`#${this.playerId}`);
            if (!iframe) {
                throw new Error(`iframe not found: ${this.playerId}`);
            }

            this.player = new YT.Player(this.playerId, {
                events: {
                    onReady: this.onPlayerReady.bind(this),
                    onStateChange: this.onPlayerStateChange.bind(this),
                },
            });

            const elements = this.initializeElements();
            if (!elements) return;

            const expandButton = this.container.querySelector('[data-target="video-expand"]');
            if (expandButton) {
                expandButton.addEventListener('click', this.toggleVideoExpand.bind(this));
            }

            window.addEventListener('scroll', this.updateVideoPosition.bind(this));
            window.addEventListener('resize', this.handleResize.bind(this));
        } catch (error) {
            console.error('플레이어 초기화 실패:', error);
        }
    }


    initializeElements() {
        const videoContainer = this.safeQuerySelector('.video-container');
        const placeholder = this.safeQuerySelector('.placeholder') || this.createPlaceholder();

        if (!videoContainer || !placeholder) {
            console.error('필수 요소 초기화 실패');
            return false;
        }

        return { videoContainer, placeholder };
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
                videoContainer.classList.remove('fixed');
                videoContainer.classList.remove('fixed-bottom');
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
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
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


        if (
            videoContainer.classList.contains('fixed') ||
            videoContainer.classList.contains('fixed-bottom')
        ) {
             videoContainer.style.maxWidth = videoContainer.classList.contains('expanded')
                ? '100%'
                : `${wrapper.offsetWidth}px`;
        }
    }


}


// DOMContentLoaded 이벤트 핸들러
document.addEventListener('DOMContentLoaded', () => {
    const playerContainers = document.querySelectorAll('.youtube-srt-player');
    playerContainers.forEach(container => {
        if (container.id) {
            new YouTubeSRTPlayer(container.id);
        } else {
            console.error('컨테이너에 ID가 없음:', container);
        }
    });
});