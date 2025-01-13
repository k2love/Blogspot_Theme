// 개선된 자막 로딩 및 YouTube 비디오 스크립트
(function () {
    // 전역 변수 선언 (let으로 변경)
    let player;
    let subtitlesKo = [];
    let subtitlesEn = [];
    let subtitlesExtra = [];
    let isPlaying = false;
    let previousTime = 0;
    let isTimeSeek = false;

    // 안전한 요소 선택 함수
    function safeQuerySelector(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`요소를 찾을 수 없음: ${selector}`);
        }
        return element;
    }

    // 개선된 초기화 함수
    function initializeElements() {
        const videoContainer = safeQuerySelector('.video-container');
        const placeholder = safeQuerySelector('.placeholder') || createPlaceholder();

        if (!videoContainer || !placeholder) {
            console.error('필수 요소 초기화 실패');
            return false;
        }

        return { videoContainer, placeholder };
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

    // 개선된 SRT 파싱 함수
    function parseSRT(srtContent) {
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
    async function loadSubtitles() {
        const subtitleLoaders = [
            {
                elementId: 'subtitle-url-ko',
                subtitlesArray: subtitlesKo,
                logName: '한국어',
            },
            {
                elementId: 'subtitle-url-en',
                subtitlesArray: subtitlesEn,
                logName: '영어',
            },
            {
                elementId: 'subtitle-url-extra',
                subtitlesArray: subtitlesExtra,
                logName: '추가',
            },
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

    // 자막 업데이트 함수 개선
    function updateSubtitles() {
        if (!player || !player.getCurrentTime) return;
        const time = player.getCurrentTime() * 1000;

        [
            { element: 'subtitle-text-ko', subtitles: subtitlesKo },
            { element: 'subtitle-text-en', subtitles: subtitlesEn },
            { element: 'subtitle-text-extra', subtitles: subtitlesExtra },
        ].forEach(({ element, subtitles }) => {
            const container = document.getElementById(element);
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
    async function onPlayerReady() {
        try {
            await loadSubtitles();
            initializeSubtitleToggles();
            updateSubtitles();
            setInterval(updateSubtitles, 100);
        } catch (error) {
            console.error('자막 로딩 중 심각한 오류 발생:', error);
        }
    }

    // 플레이어 상태 변경 핸들러
    function onPlayerStateChange(event) {
        const currentTime = player.getCurrentTime();
        const timeDiff = Math.abs(currentTime - previousTime);
        isTimeSeek = timeDiff >= 0.5;
    
        const wasPlaying = isPlaying;
        if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
        } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
        }
    
        if (!isTimeSeek && wasPlaying !== isPlaying) {
            updateVideoPosition();
            // 자막 위치 업데이트 추가
            document.querySelectorAll('.subtitle-content.zoomed').forEach(container => {
                updateZoomedSubtitlePosition(container);
            });
        }
        previousTime = currentTime;
    }

    // 비디오 위치 업데이트 함수 수정
    function updateVideoPosition() {
        const elements = initializeElements();
        if (!elements) return;

        const { videoContainer, placeholder } = elements;
        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const videoHeight = videoContainer.offsetHeight;

        if (!isPlaying) {
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

        if (isTimeSeek) {
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
    function initializeSubtitleToggles() {
        const toggleButtons = document.querySelectorAll('.toggle-btn');
        toggleButtons.forEach((button) => {
            const targetId = button.dataset.target;
            const targetContainer = document.getElementById(targetId);
            if (!targetContainer) {
                console.warn(`대상 컨테이너를 찾을 수 없음: ${targetId}`);
                return;
            }

            // 기존 표시/숨김 토글 기능
            const isVisible = localStorage.getItem(`${targetId}-visible`) !== 'false';
            targetContainer.classList.toggle('hidden', !isVisible);
            button.classList.toggle('active', isVisible);

            button.addEventListener('click', () => {
                targetContainer.classList.toggle('hidden');
                button.classList.toggle('active');
                localStorage.setItem(`${targetId}-visible`, !targetContainer.classList.contains('hidden'));
            });

            // 확대/중앙 정렬 토글 버튼 추가
            const zoomButton = document.createElement('button');
            zoomButton.className = 'zoom-toggle-btn';
            zoomButton.innerHTML = '<i class="fas fa-search-plus"></i>';
            zoomButton.setAttribute('data-target', targetId);
            button.parentNode.insertBefore(zoomButton, button.nextSibling);

            // 확대/중앙 정렬 상태 관리
            const isZoomed = localStorage.getItem(`${targetId}-zoomed`) === 'true';
            if (isZoomed) {
                targetContainer.classList.add('zoomed');
                zoomButton.classList.add('active');
            }

            zoomButton.addEventListener('click', () => {
                toggleSubtitleZoom(targetContainer, zoomButton);
            });
        });
    }

// toggleSubtitleZoom 함수 수정
function toggleSubtitleZoom(container, button) {
    const isZoomed = container.classList.contains('zoomed');
    const targetId = button.getAttribute('data-target');
    const videoContainer = document.querySelector('.video-container');
    
    if (!videoContainer) return;
    
    if (isZoomed) {
        // 확대 해제
        container.classList.remove('zoomed');
        button.classList.remove('active');
        container.style.transform = '';
        localStorage.setItem(`${targetId}-zoomed`, 'false');
    } else {
        // 다른 모든 자막의 확대 상태 해제
        document.querySelectorAll('.subtitle-text-ko, .subtitle-text-en, .subtitle-text-extra').forEach(elem => {
            if (elem !== container) {
                elem.classList.remove('zoomed');
                const otherButton = document.querySelector(`[data-target="${elem.id}"]`);
                if (otherButton) otherButton.classList.remove('active');
                localStorage.setItem(`${elem.id}-zoomed`, 'false');
            }
        });
        
        // 현재 자막 확대
        container.classList.add('zoomed');
        button.classList.add('active');
        localStorage.setItem(`${targetId}-zoomed`, 'true');
    }
}

// updateZoomedSubtitlePosition 함수 수정
function updateZoomedSubtitlePosition() {
    const videoContainer = document.querySelector('.video-container');
    if (!videoContainer) return;
    
    const videoRect = videoContainer.getBoundingClientRect();
    const zoomedSubtitles = document.querySelectorAll('.subtitle-text-ko.zoomed, .subtitle-text-en.zoomed, .subtitle-text-extra.zoomed');
    
    zoomedSubtitles.forEach(subtitle => {
        const subtitleContent = subtitle.querySelector('.subtitle-content');
        if (!subtitleContent) return;

        if (videoRect.top < window.innerHeight && videoRect.bottom > 0) {
            const videoCenter = videoRect.top + (videoRect.height / 2);
            subtitleContent.style.top = `${videoCenter}px`;
        }
    });
}

    // CSS 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
        .subtitle-text-ko.zoomed .subtitle-content,
        .subtitle-text-en.zoomed .subtitle-content,
        .subtitle-text-extra.zoomed .subtitle-content {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 3em;
            background: rgba(0, 0, 0, 0.7);
            padding: 0.5em;
            border-radius: 0.3em;
            z-index: 1000;
            text-align: center;
            max-width: 90vw;
            transition: all 0.3s ease;
            color: white;
        }
    
        .subtitle-text-ko:not(.zoomed) .subtitle-content,
        .subtitle-text-en:not(.zoomed) .subtitle-content,
        .subtitle-text-extra:not(.zoomed) .subtitle-content {
            transition: all 0.3s ease;
            font-size: 1em;
        }
    
        .zoom-toggle-btn {
            margin-left: 0.5em;
            padding: 0.5em;
            border: none;
            background: none;
            color: #666;
            cursor: pointer;
            transition: color 0.3s ease;
        }
    
        .zoom-toggle-btn.active {
            color: #007bff;
        }
    
        @media (max-width: 768px) {
            .subtitle-text-ko.zoomed .subtitle-content,
            .subtitle-text-en.zoomed .subtitle-content,
            .subtitle-text-extra.zoomed .subtitle-content {
                font-size: 2em;
            }
        }
    
        @media (max-width: 480px) {
            .subtitle-text-ko.zoomed .subtitle-content,
            .subtitle-text-en.zoomed .subtitle-content,
            .subtitle-text-extra.zoomed .subtitle-content {
                font-size: 1.5em;
            }
        }
    `;
    document.head.appendChild(style);

    // 스크롤 이벤트 리스너 추가
    window.addEventListener('scroll', () => {
        document.querySelectorAll('.subtitle-content.zoomed').forEach(container => {
            updateZoomedSubtitlePosition(container);
        });
    });

// 리사이즈 핸들러 수정
function handleResize() {
    const videoContainer = safeQuerySelector('.video-container');
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

    // 확대된 자막 위치 업데이트
    document.querySelectorAll('.subtitle-content.zoomed').forEach(container => {
        updateZoomedSubtitlePosition(container);
    });
}
    
    // 메인 초기화 함수
    async function initializePlayer() {
        try {
            await loadYouTubeAPI();
            player = new YT.Player('player', {
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                },
            });

            const expandButton = document.querySelector('[data-target="video-expand"]');
            if (expandButton) {
                expandButton.addEventListener('click', toggleVideoExpand);
            }

            window.addEventListener('scroll', updateVideoPosition);
            window.addEventListener('resize', handleResize);
        } catch (error) {
            console.error('플레이어 초기화 중 오류 발생:', error);
        }
    }

    // 확장 기능을 위한 EventListener 추가
    document.addEventListener('DOMContentLoaded', function() {
        // 기존 initializePlayer() 함수 내부의 이벤트 리스너 초기화 부분에 추가
        const expandButton = document.querySelector('[data-target="video-expand"]');
        if (expandButton) {
            expandButton.addEventListener('click', function() {
                const videoContainer = document.querySelector('.video-container');
                if (!videoContainer) return;

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
                if (player && player.getIframe) {
                    const iframe = player.getIframe();
                    if (iframe) {
                        requestAnimationFrame(() => {
                            iframe.style.width = '100%';
                            iframe.style.height = '100%';
                        });
                    }
                }
            });
        }
    });

    // 리사이즈 핸들러 수정
    function handleResize() {
        const videoContainer = safeQuerySelector('.video-container');
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

    window.addEventListener('scroll', updateVideoPosition);
    window.addEventListener('resize', () => {
        const videoContainer = safeQuerySelector('.video-container');
        if (!videoContainer) return;

        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        if (
            videoContainer.classList.contains('fixed') ||
            videoContainer.classList.contains('fixed-bottom')
        ) {
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        }
    });

    // 스크립트 초기화
    document.addEventListener('DOMContentLoaded', initializePlayer);
})();