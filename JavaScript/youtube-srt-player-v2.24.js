// 개선된 자막 로딩 및 YouTube 비디오 스크립트
(function () {
    // 클래스 기반 컴포넌트
    class YouTubePlayer {
        constructor(containerElement) {
            this.container = containerElement;
            this.videoId = this.container.dataset.videoId;
            this.player = null;
            this.subtitlesKo = [];
            this.subtitlesEn = [];
            this.subtitlesExtra = [];
            this.isPlaying = false;
            this.previousTime = 0;
            this.isTimeSeek = false;
            this.elements = null; // 요소를 저장할 변수

            // 초기화 시 바로 시작
            this.initialize();
        }

        // 초기화 함수
        async initialize() {
            this.elements = this.initializeElements();
            if (!this.elements) return;
            try {
                await this.loadYouTubeAPI();
                this.player = new YT.Player(this.elements.videoContainer.querySelector('.player'), {
                    events: {
                        onReady: this.onPlayerReady.bind(this),
                        onStateChange: this.onPlayerStateChange.bind(this),
                    },
                });
                 const expandButton = this.container.querySelector('[data-target="video-expand"]');
                    if (expandButton) {
                        expandButton.addEventListener('click', this.toggleVideoExpand.bind(this));
                   }

                window.addEventListener('scroll', this.updateVideoPosition.bind(this));
                window.addEventListener('resize', this.handleResize.bind(this));
                
            } catch (error) {
                console.error('플레이어 초기화 중 오류 발생:', error);
            }
        }

        // 안전한 요소 선택 함수
        safeQuerySelector(selector) {
            const element = this.container.querySelector(selector);
            if (!element) {
                console.warn(`요소를 찾을 수 없음: ${selector}`);
            }
            return element;
        }

        // 개선된 초기화 함수
         initializeElements() {
            const videoContainer = this.safeQuerySelector('.video-container');
            const player = this.safeQuerySelector('.player');
            const placeholder = this.safeQuerySelector('.placeholder') || this.createPlaceholder();

            if (!videoContainer || !placeholder || !player) {
                console.error('필수 요소 초기화 실패');
                return null;
            }
            return { videoContainer, placeholder, player };
        }

        // 플레이스홀더 동적 생성 함수
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
        // 개선된 SRT 파싱 함수
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

        // 개선된 자막 로드 함수
        async loadSubtitles() {
            const subtitleLoaders = [
                {
                    elementId: 'subtitle-url-ko',
                    subtitlesArray: this.subtitlesKo,
                    logName: '한국어',
                },
                {
                    elementId: 'subtitle-url-en',
                    subtitlesArray: this.subtitlesEn,
                    logName: '영어',
                },
                 {
                    elementId: 'subtitle-url-extra',
                    subtitlesArray: this.subtitlesExtra,
                    logName: '추가',
                },
            ];

            for (const loader of subtitleLoaders) {
                 const subtitleElement = this.container.querySelector(`.${loader.elementId}`);
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


       // 자막 업데이트 함수 개선
         updateSubtitles() {
             if (!this.player || !this.player.getCurrentTime) return;
            const time = this.player.getCurrentTime() * 1000;

           [
                 { element: 'subtitle-text-ko', subtitles: this.subtitlesKo },
                 { element: 'subtitle-text-en', subtitles: this.subtitlesEn },
                 { element: 'subtitle-text-extra', subtitles: this.subtitlesExtra },
             ].forEach(({ element, subtitles }) => {
                 const container = this.container.querySelector(`.${element}`);
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

        // YouTube API 로드
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
         // 플레이어 준비 핸들러
          async onPlayerReady() {
            try {
                await this.loadSubtitles();
                this.initializeSubtitleToggles();
                this.updateSubtitles();
                 setInterval(this.updateSubtitles.bind(this), 100);
            } catch (error) {
                console.error('자막 로딩 중 심각한 오류 발생:', error);
             }
        }

       // 플레이어 상태 변경 핸들러
         onPlayerStateChange(event) {
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

         // 비디오 위치 업데이트 함수 수정
        updateVideoPosition() {
            if (!this.elements || !this.elements.videoContainer || !this.elements.placeholder) return;
            const { videoContainer, placeholder } = this.elements;

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


        // 자막 토글 기능 초기화
       initializeSubtitleToggles() {
            const toggleButtons = this.container.querySelectorAll('.toggle-btn');
            toggleButtons.forEach((button) => {
                const targetId = button.dataset.target;
                 const targetContainer = this.container.querySelector(`.${targetId}`);
                if (!targetContainer) {
                    console.warn(`대상 컨테이너를 찾을 수 없음: ${targetId}`);
                    return;
                }
                let isVisible = localStorage.getItem(`${targetId}-visible`);
				
				if(isVisible === null){
					isVisible = true;
				}else{
					isVisible = (isVisible === 'true');
				}
               targetContainer.classList.toggle('hidden', !isVisible);
                button.classList.toggle('active', isVisible);

                button.addEventListener('click', () => {
                    targetContainer.classList.toggle('hidden');
                   button.classList.toggle('active');
                   localStorage.setItem(`${targetId}-visible`, !targetContainer.classList.contains('hidden'));
               });
          });
        }
        
          // 확장 모드 토글 함수
         toggleVideoExpand() {
             const videoContainer = this.container.querySelector('.video-container');
             if (!videoContainer) return;

           const expandButton = this.container.querySelector('[data-target="video-expand"]');
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
         }
          // 리사이즈 핸들러 수정
         handleResize() {
            const { videoContainer } = this.elements;
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

   // 모든 비디오 컨테이너를 찾아서 각 인스턴스 생성
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.youtube-player-container').forEach(container => {
           new YouTubePlayer(container);
       });
    });
})();