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

            const isVisible = localStorage.getItem(`${targetId}-visible`) !== 'false';
            targetContainer.classList.toggle('hidden', !isVisible);
            button.classList.toggle('active', isVisible);

            button.addEventListener('click', () => {
                targetContainer.classList.toggle('hidden');
                button.classList.toggle('active');
                localStorage.setItem(`${targetId}-visible`, !targetContainer.classList.contains('hidden'));
            });
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

    // DOMContentLoaded 이벤트 핸들러
    document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
    .video-container {
        position: relative;
        width: 100%;
        background: #000;
        padding-bottom: 56.25%; /* 16:9 비율 */
        z-index: 1;
    }

    .video-container.fixed {
        position: fixed;
        top: 0;
        width: 100%;
    }

    .video-container.fixed-bottom {
        position: fixed;
        bottom: 0;
        width: 100%;
    }

    .video-wrapper {
        padding-bottom: 56.25%;
        overflow: visible;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .video-wrapper iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 0;
    }

    .subtitle-area {
        position: relative;
        width: 100%;
        height: 40px;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        z-index: 10;
    }

    .subtitle-area > div {
        width: 100%;
        display: flex;
        justify-content: center;
        cursor: pointer;
        transition: opacity 0.2s ease;
    }

    .subtitle-area > div:hover,
    .subtitle-overlay > div:hover {
        opacity: 0.8;
    }

    .subtitle-overlay {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        text-align: center;
        z-index: 20;
        padding-bottom: 5px;
        min-height: 60px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        pointer-events: none;
    }

    .subtitle-area:first-child {
        position: relative;
        min-height: 40px;
        height: 40px;
        background: #000;
    }

    #subtitle-text-extra {
        width: 100%;
        position: relative;
    }

    #subtitle-text-extra .subtitle-content {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }
    
    #subtitle-text-extra span {
        font-size: 18px;
        color: #D3D3D3;
        text-shadow: 
            -1px -1px 0 #000,  
            1px -1px 0 #000,
            -1px  1px 0 #000,
            1px  1px 0 #000,
            2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0, 0, 0, 0.4);
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
        max-width: 600px;
        white-space: normal;
        word-break: keep-all;
        line-height: 1.5;
        margin: 0 auto;
        position: relative;
        top: 0;
    }
    
    #subtitle-text-ko {
        width: 100%;
    }  

    #subtitle-text-ko span {
        font-size: 22px;
        color: #FFD700;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
        max-width: 450px;
        white-space: normal;
        word-break: keep-all;
        line-height: 1.5;
        margin: 0 auto;
        position: relative;
        top: 65px;
    }

    .subtitle-area#en-subtitle-area {
        position: relative;
        height: 100px;
        background: #000;
        display: flex;
        align-items: flex-end;
        margin: 0;
        padding-bottom: 2px;
    }
    
    .subtitle-area:last-child {
        position: relative;
        min-height: 100px;  
        height: 100px;
        overflow: hidden;
        z-index: 10;
        display: flex;
        align-items: flex-end;
        padding: 0;
    }

    #subtitle-text-en {
        width: 100%;
        position: absolute;
        bottom: 0;
        left: 0;
    }
    
    #subtitle-text-en span {
        font-size: 14px;
        color: #E0E0E0;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0, 0, 0, 0.2);
        padding: 0px 0px;
        border-radius: 4px;
        display: inline-block;
        max-width: 650px;
        white-space: normal;
        word-break: normal;
        line-height: 1.5;
        margin: 0 auto;
        margin-bottom: 0;
        position: relative;
        top: 0;
    }

    #subtitle-text-en.subtitle-toggle {
        width: 100%;
        height: auto;
        margin: 0;
        padding: 0;
    }

    .subtitle-content {
        width: 100%;
        height: 100%;
        min-height: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
    }  
    
    #subtitle-text-en .subtitle-content {
        width: 100%;
        height: 100%;
        min-height: inherit;  
        display: flex;
        justify-content: center;
        align-items: flex-end;
        margin: 0;
        padding: 0;
    }  

    #subtitle-text-en .subtitle-content span {
        font-size: 14px;
        color: #E0E0E0;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
        max-width: 650px;
        white-space: normal;
        word-break: normal;
        line-height: 1.5;
        margin: 0;
        position: relative;
        bottom: 0px;
    }
    
    .subtitle-line {
        padding: 4px 8px;
        margin: 0;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .subtitle-line span {
        background: rgba(0, 0, 0, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
        word-wrap: break-word;
        max-width: 100%;
        line-height: 1.4;
    }

    .subtitle-area > div.hidden span,
    .subtitle-overlay > div.hidden span {
        display: none;
    }

    .placeholder {
        display: none;
    }

    .video-container.fixed + .placeholder,
    .video-container.fixed-bottom + .placeholder {
        display: block;
    }  

    .toggle-buttons-group {
        position: absolute;
        right: 5px;
        bottom: 5px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;
        z-index: 100;
    }  

    .toggle-btn {
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 1px 6px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 10px;
        font-family: monospace;
        min-width: 28px;
        text-align: center;
        transition: all 0.2s ease;
    }

    .toggle-btn:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .toggle-btn.active {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.6);
    }
    
    .subtitle-toggle {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .subtitle-content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .subtitle-toggle.hidden .subtitle-content {
        visibility: hidden; /* display: none 대신 visibility: hidden 사용 */
    }

    .subtitle-area > div.hidden span,
    .subtitle-overlay > div.hidden span {
        visibility: hidden; /* display: none 대신 visibility: hidden 사용 */
    }

    .subtitle-area > div {
        position: relative;
        height: 100%;
    }

    .subtitle-overlay > div {
        position: relative;
        height: 100%;
    }  
    
    .video-controls-overlay {
        position: absolute;
        left: 0;
        right: 2px; /* 오른쪽 2px에 고정 */
        bottom: 2px; /* 하단 2px에 고정 */  
        width: 100%;
        height: 40px;
        display: flex;
        flex-direction: column; /* 세로 방향으로 변경 */
        align-items: flex-end; /* 오른쪽 정렬 */
        z-index: 100;
        padding: 0
        gap: 2px; /* 버튼 사이 간격 */
        z-index: 100;  
    }

    /* 확장 모드 스타일 개선 */
    .video-container.expanded {
        position: relative;
        width: 100vw;
        background-color: var(--widget-bg);
        margin-left: calc(-50vw + 50%);
        margin-right: calc(-50vw + 50%);
    }

    .video-container.expanded .video-wrapper {
        position: relative;
        width: 100%;
        padding-top: 56.25%; /* 16:9 비율 유지 */
        overflow: hidden;
    }

    .video-container.expanded .video-wrapper iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    /* 확장 모드의 sticky 상태 공통 속성 */
    .video-container.expanded.fixed,
    .video-container.expanded.fixed-bottom {
        position: fixed;
        width: 100vw;
        left: 0;
        margin: 0;
        z-index: 50;
    }

    .video-container.expanded.fixed {
        top: 0;
    }

    .video-container.expanded.fixed-bottom {
        bottom: 0;
    }

    /* 비디오 래퍼와 자막 영역 정렬 */
    .video-container.expanded .video-wrapper,
    .video-container.expanded .subtitle-area {
        width: 100%;
        margin: 0 auto;
    }

    /* 확장 버튼 아이콘 스타일 */
    .toggle-btn[data-target="video-expand"] i {
        font-size: 14px;
        line-height: 1;
    }
        `;
        document.head.appendChild(style);
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
