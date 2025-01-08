// 자막 로딩 및 YouTube 비디오 스크립트
(function() {
    // Lodash 의존성 확인
    if (typeof _ === 'undefined') {
        console.error('Lodash is required for this script to work properly');
        return;
    }

    // 전역 변수 선언
    let player;
    let subtitlesKo = [];
    let subtitlesEn = [];
    let subtitlesExtra = [];
    let isPlaying = false;
    
    // 자주 사용되는 DOM 요소 캐싱
    let cachedElements = {
        videoContainer: null,
        placeholder: null,
        wrapper: null
    };

    // 안전한 요소 선택 함수
    function safeQuerySelector(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`요소를 찾을 수 없음: ${selector}`);
        }
        return element;
    }

    // 초기화 함수
    function initializeElements() {
        if (cachedElements.videoContainer && cachedElements.placeholder) {
            return cachedElements;
        }

        const videoContainer = safeQuerySelector('.video-container');
        const placeholder = safeQuerySelector('.placeholder') || createPlaceholder();
        const wrapper = videoContainer ? videoContainer.closest('.sticky-wrapper') : null;

        if (!videoContainer || !placeholder) {
            console.error('필수 요소 초기화 실패');
            return false;
        }

        cachedElements = {
            videoContainer,
            placeholder,
            wrapper
        };

        return cachedElements;
    }

    // 플레이스홀더 동적 생성 함수
    function createPlaceholder() {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.style.height = '0px';

        const videoContainer = safeQuerySelector('.video-container');
        if (videoContainer) {
            videoContainer.parentNode.insertBefore(placeholder, videoContainer.nextSibling);
        }

        return placeholder;
    }

    // SRT 파싱 함수
    function parseSRT(srtContent) {
        try {
            const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const entries = normalizedContent.trim().split('\n\n');

            return entries
                .map(entry => {
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
                            parseInt(ms || '0')
                        );
                    });

                    const text = lines.slice(2).join('\n').trim();

                    return {
                        index: parseInt(lines[0], 10),
                        startTime,
                        endTime,
                        text
                    };
                })
                .filter(entry => entry !== null);
        } catch (error) {
            console.error('SRT 파싱 중 오류 발생:', error);
            return [];
        }
    }

    // 자막 로드 함수
    async function loadSubtitles() {
        const subtitleLoaders = [
            {
                elementId: 'subtitle-url-ko',
                subtitlesArray: subtitlesKo,
                logName: '한국어'
            },
            {
                elementId: 'subtitle-url-en',
                subtitlesArray: subtitlesEn,
                logName: '영어'
            },
            {
                elementId: 'subtitle-url-extra',
                subtitlesArray: subtitlesExtra,
                logName: '추가'
            }
        ];

        for (const loader of subtitleLoaders) {
            const subtitleElement = document.getElementById(loader.elementId);
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
                loader.subtitlesArray.splice(0, loader.subtitlesArray.length, ...parseSRT(srtContent));

                console.log(`${loader.logName} 자막 로드 성공:`, loader.subtitlesArray.length);
            } catch (error) {
                console.error(`${loader.logName} 자막 로드 실패:`, error);
            }
        }
    }

    // 자막 업데이트 함수
    function updateSubtitles() {
        if (!player || !player.getCurrentTime || !isPlaying) return;

        const time = player.getCurrentTime() * 1000;

        [
            { element: 'subtitle-text-ko', subtitles: subtitlesKo },
            { element: 'subtitle-text-en', subtitles: subtitlesEn },
            { element: 'subtitle-text-extra', subtitles: subtitlesExtra }
        ].forEach(({ element, subtitles }) => {
            const container = document.getElementById(element);
            if (!container || container.classList.contains('hidden')) return;

            const contentDiv = container.querySelector('.subtitle-content');
            if (!contentDiv) return;

            const currentSubtitle = subtitles.find(
                subtitle => time >= subtitle.startTime && time <= subtitle.endTime
            );

            const newText = currentSubtitle
                ? `<span>${currentSubtitle.text.replace(/\n/g, '<br>')}</span>`
                : '';
            if (contentDiv.innerHTML !== newText) {
                contentDiv.innerHTML = newText;
            }
        });
    }

    // 자막 업데이트 시작 함수
    function startSubtitleUpdates() {
        if (!isPlaying) return;
        updateSubtitles();
        requestAnimationFrame(startSubtitleUpdates);
    }

    // YouTube API 로드
    function loadYouTubeAPI() {
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
    async function onPlayerReady(event) {
        try {
            await loadSubtitles();
            initializeSubtitleToggles();
            startSubtitleUpdates();
        } catch (error) {
            console.error('자막 로딩 중 심각한 오류 발생:', error);
        }
    }

    // 플레이어 상태 변경 핸들러
    function onPlayerStateChange(event) {
        isPlaying = event.data === YT.PlayerState.PLAYING;
        updateVideoPosition();
    }

    // 비디오 위치 업데이트 함수
    function updateVideoPosition() {
        const elements = initializeElements();
        if (!elements) return;

        const { videoContainer, placeholder, wrapper } = elements;
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const videoHeight = videoContainer.offsetHeight;

        if (isPlaying) {
            placeholder.style.height = `${videoHeight}px`;
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        } else {
            placeholder.style.height = '0';
            videoContainer.style.maxWidth = '';
        }

        if (isPlaying) {
            if (rect.top < 0) {
                videoContainer.classList.add('fixed');
                videoContainer.classList.remove('fixed-bottom');
            } else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
                videoContainer.classList.remove('fixed');
                videoContainer.classList.add('fixed-bottom');
            } else {
                videoContainer.classList.remove('fixed');
                videoContainer.classList.remove('fixed-bottom');
            }
        } else {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
        }
    }

    // 비디오 크기 업데이트 함수
    function updateVideoSize() {
        const elements = initializeElements();
        if (!elements) return;

        const { videoContainer, wrapper } = elements;
        if (!wrapper) return;
        
        const viewportWidth = window.innerWidth;
        let maxWidth;
        
        if (viewportWidth < 768) {  // 모바일
            maxWidth = '100%';
        } else if (viewportWidth < 1024) {  // 태블릿
            maxWidth = '85%';
        } else {  // 데스크톱
            maxWidth = `${wrapper.offsetWidth}px`;
        }
        
        if (videoContainer.classList.contains('fixed') || 
            videoContainer.classList.contains('fixed-bottom')) {
            videoContainer.style.maxWidth = maxWidth;
        }
    }

    // 자막 토글 기능 초기화
    function initializeSubtitleToggles() {
        const toggleButtons = document.querySelectorAll('.toggle-btn');

        toggleButtons.forEach(button => {
            const targetId = button.dataset.target;
            const targetContainer = document.getElementById(targetId);

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
                localStorage.setItem(
                    `${targetId}-visible`,
                    !targetContainer.classList.contains('hidden')
                );
            });
        });
    }

    // 비디오 컨트롤 초기화
    function initializeVideoControls() {
        const elements = initializeElements();
        if (!elements) return;

        const { videoContainer } = elements;
        let controlsTimeout;

        videoContainer.addEventListener('mousemove', () => {
            videoContainer.classList.add('show-controls');
            clearTimeout(controlsTimeout);

            controlsTimeout = setTimeout(() => {
                if (isPlaying) {
                    videoContainer.classList.remove('show-controls');
                }
            }, 2000);
        });

        videoContainer.addEventListener('mouseleave', () => {
            if (isPlaying) {
                videoContainer.classList.remove('show-controls');
            }
        });
    }

    // 키보드 단축키 초기화
    function initializeKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key.toLowerCase()) {
                case 'k':
                case ' ':
                    if (player && player.getPlayerState) {
                        const state = player.getPlayerState();
                        if (state === YT.PlayerState.PLAYING) {
                            player.pauseVideo();
                        } else {
                            player.playVideo();
                        }
                        e.preventDefault();
                    }
                    break;
                case 'j':
                    if (player && player.getCurrentTime) {
                        player.seekTo(player.getCurrentTime() - 10, true);
                    }
                    break;
                case 'l':
                    if (player && player.getCurrentTime) {
                        player.seekTo(player.getCurrentTime() + 10, true);
                    }
                    break;
            }
        });
    }

    // 메인 초기화 함수
    async function initializePlayer() {
        try {
            await loadYouTubeAPI();

            player = new YT.Player('player', {
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange
                }
            });

            window.addEventListener('scroll', _.throttle(updateVideoPosition, 100));
            window.addEventListener('resize', _.throttle(updateVideoSize, 100));
        } catch (error) {
            console.error('플레이어 초기화 중 오류 발생:', error);
        }
    }

    // 스크립트 초기화
    document.addEventListener('DOMContentLoaded', () => {
        initializePlayer();
        initializeVideoControls();
        initializeKeyboardShortcuts();
    });
})();