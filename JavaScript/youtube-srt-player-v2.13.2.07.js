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
    let originalVideoWidth = 0; // 원래 비디오 컨테이너 너비 저장
    let originalWrapperWidth = 0; // 원래 래퍼 너비 저장

    // 미니 플레이어 관련 변수
    let isMiniPlayer = false;
    let miniPlayerPosition = 'bottom-right'; // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    let isDragging = false;
    let dragStartX, dragStartY;
    let miniPlayerX, miniPlayerY;

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

    // 미니 플레이어 전환 함수
    function toggleMiniPlayer() {
        console.log('toggleMiniPlayer 함수 호출됨'); // 디버깅용
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        isMiniPlayer = !isMiniPlayer;
        
        if (isMiniPlayer) {
            // 일반 모드에서 미니 플레이어 모드로 전환
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
            videoContainer.classList.remove('expanded');
            videoContainer.classList.add('mini-player');
            videoContainer.classList.add(`mini-player-${miniPlayerPosition}`);
            
            // 확장 모드 스타일 제거
            videoContainer.style.width = '';
            videoContainer.style.maxWidth = '';
            videoContainer.style.margin = '';

            // 미니 플레이어 버튼 아이콘 변경
            const miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
            if (miniPlayerBtn) {
                miniPlayerBtn.innerHTML = '<i class="fas fa-expand"></i>';
            }

            // 자막 크기 조정을 위한 클래스 추가
            adjustSubtitleSizeForMiniPlayer(true);            

            // 드래그 이벤트 추가
            videoContainer.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', dragMiniPlayer);
            document.addEventListener('mouseup', stopDrag);
        } else {
            // 미니 플레이어 모드에서 일반 모드로 전환
            videoContainer.classList.remove('mini-player');
            videoContainer.classList.remove('mini-player-top-left');
            videoContainer.classList.remove('mini-player-top-right');
            videoContainer.classList.remove('mini-player-bottom-left');
            videoContainer.classList.remove('mini-player-bottom-right');
            videoContainer.style.transform = '';

            // 미니 플레이어 버튼 아이콘 변경
            const miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
            if (miniPlayerBtn) {
                miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
            }
            
            // 자막 크기 조정 클래스 제거
            adjustSubtitleSizeForMiniPlayer(false);
            
            // 드래그 이벤트 제거
            videoContainer.removeEventListener('mousedown', startDrag);
            document.removeEventListener('mousemove', dragMiniPlayer);
            document.removeEventListener('mouseup', stopDrag);
            
            // 현재 스크롤 위치에 따라 fixed 클래스 다시 적용
            updateVideoPosition();
        }
    }

    // 자막 크기 조정 함수
    function adjustSubtitleSizeForMiniPlayer(isMini) {
        // 자막 요소들
        const subtitleElements = [
            document.getElementById('subtitle-text-ko'),
            document.getElementById('subtitle-text-en'),
            document.getElementById('subtitle-text-extra')
        ];
        
        subtitleElements.forEach(element => {
            if (!element) return;
            
            if (isMini) {
                element.classList.add('mini-player-subtitle');
            } else {
                element.classList.remove('mini-player-subtitle');
            }
        });
    }

    // 드래그 시작 함수
    function startDrag(e) {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer || !videoContainer.classList.contains('mini-player')) return;
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        // 현재 transform 값을 가져옴
        const transform = window.getComputedStyle(videoContainer).transform;
        const matrix = new DOMMatrixReadOnly(transform);
        miniPlayerX = matrix.m41;
        miniPlayerY = matrix.m42;
        
        // 드래그 중에 선택이 되지 않도록 방지
        e.preventDefault();
    }

    // 드래그 중 함수
    function dragMiniPlayer(e) {
        if (!isDragging) return;
        
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        // 새 위치 계산
        const newX = miniPlayerX + deltaX;
        const newY = miniPlayerY + deltaY;
        
        // transform 적용
        videoContainer.style.transform = `translate(${newX}px, ${newY}px)`;
        
        // 화면 경계 근처에 도달하면 위치 결정
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // 드래그 후 위치에 따라 자동으로 모서리 위치 결정
        if (e.clientX < windowWidth / 2 && e.clientY < windowHeight / 2) {
            miniPlayerPosition = 'top-left';
        } else if (e.clientX >= windowWidth / 2 && e.clientY < windowHeight / 2) {
            miniPlayerPosition = 'top-right';
        } else if (e.clientX < windowWidth / 2 && e.clientY >= windowHeight / 2) {
            miniPlayerPosition = 'bottom-left';
        } else {
            miniPlayerPosition = 'bottom-right';
        }
    }

    // 드래그 종료 함수
    function stopDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        // 모든 위치 클래스 제거
        videoContainer.classList.remove('mini-player-top-left');
        videoContainer.classList.remove('mini-player-top-right');
        videoContainer.classList.remove('mini-player-bottom-left');
        videoContainer.classList.remove('mini-player-bottom-right');
        
        // 드래그 후 위치에 따라 자동으로 모서리로 배치
        videoContainer.classList.add(`mini-player-${miniPlayerPosition}`);
        videoContainer.style.transform = '';
    }

    // 비디오 확장 토글 함수
    function toggleVideoExpand() {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;

        const expandButton = document.querySelector('[data-target="video-expand"]');
        const wrapper = videoContainer.closest('.sticky-wrapper');
        
        if (!wrapper) {
            console.error('비디오 래퍼를 찾을 수 없음');
            return;
        }
        
        // 원래 크기 저장 (처음 토글 시에만)
        if (originalWrapperWidth === 0) {
            originalWrapperWidth = wrapper.offsetWidth;
            originalVideoWidth = videoContainer.offsetWidth;
        }
        
        if (videoContainer.classList.contains('expanded')) {
            // 축소 모드로 전환
            videoContainer.classList.remove('expanded');
            if (expandButton) {
                expandButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
            
            // 원래 너비로 복원
            videoContainer.style.width = '';
            videoContainer.style.maxWidth = '';
            videoContainer.style.margin = '';
            
            // fixed 클래스가 있을 경우 적절한 너비 설정
            if (videoContainer.classList.contains('fixed') || videoContainer.classList.contains('fixed-bottom')) {
                videoContainer.style.maxWidth = `${originalWrapperWidth}px`;
                videoContainer.style.left = '50%';
                videoContainer.style.transform = 'translateX(-50%)';
            }
        } else {
            // 확장 모드로 전환 - 전체 화면 너비로 확장
            videoContainer.classList.add('expanded');
            if (expandButton) {
                expandButton.innerHTML = '<i class="fas fa-compress"></i>';
            }
            
            // 전체 화면 너비로 설정
            videoContainer.style.width = '100vw';
            videoContainer.style.maxWidth = '100vw';
            videoContainer.style.margin = '0 calc(-50vw + 50%)';
            
            // fixed 클래스가 있을 경우 전체 너비로 설정
            if (videoContainer.classList.contains('fixed') || videoContainer.classList.contains('fixed-bottom')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
                videoContainer.style.transform = 'none';
            }
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

            // 비디오 컨테이너의 초기 크기 저장
            const videoContainer = document.querySelector('.video-container');
            const wrapper = videoContainer ? videoContainer.closest('.sticky-wrapper') : null;
            
            if (videoContainer && wrapper) {
                originalVideoWidth = videoContainer.offsetWidth;
                originalWrapperWidth = wrapper.offsetWidth;
            }
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

        // 미니 플레이어 모드일 때는 위치 업데이트 건너뛰기
        if (isMiniPlayer) return;

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
                
               // 확장 모드 스타일 유지하면서 위치만 조정
               if (!videoContainer.classList.contains('expanded')) {
                videoContainer.style.maxWidth = '';
                videoContainer.style.left = '';
                videoContainer.style.transform = '';
                }
            });
            return;
        }

        if (isTimeSeek) {
            return;
        }

        // 비디오가 화면 상단 바깥으로 스크롤됐을 때
        if (rect.top < 0) {
            videoContainer.classList.add('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            
            // 확장 모드일 때는 전체 화면 너비로, 아닐 때는 래퍼 너비로
            if (videoContainer.classList.contains('expanded')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
                videoContainer.style.transform = 'none';
            } else {
                videoContainer.style.maxWidth = `${originalWrapperWidth || wrapper.offsetWidth}px`;
                videoContainer.style.left = '50%';
                videoContainer.style.transform = 'translateX(-50%)'; // 중앙 정렬을 위한 변환
            }
        } 
        // 비디오가 화면 하단으로 스크롤됐을 때
        else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.add('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            
            // 확장 모드일 때는 전체 화면 너비로, 아닐 때는 래퍼 너비로
            if (videoContainer.classList.contains('expanded')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
                videoContainer.style.transform = 'none';
            } else {
                videoContainer.style.maxWidth = `${originalWrapperWidth || wrapper.offsetWidth}px`;
                videoContainer.style.left = '50%';
                videoContainer.style.transform = 'translateX(-50%)'; // 중앙 정렬을 위한 변환
            }
        }
        // 비디오가 화면 내에 있을 때
        else {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = '0';
            
            // 확장 모드가 아닐 때만 스타일 초기화
            if (!videoContainer.classList.contains('expanded')) {
                videoContainer.style.maxWidth = '';
                videoContainer.style.left = '';
                videoContainer.style.transform = '';
            }
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

            button.addEventListener('click', (event) => {
                targetContainer.classList.toggle('hidden');
                button.classList.toggle('active');
                localStorage.setItem(`${targetId}-visible`, !targetContainer.classList.contains('hidden'));
                event.stopPropagation(); // 이벤트 버블링 방지
            });
        });
    }

    // 버튼 위치를 바꾸는 함수 추가
    function moveControlButtons() {
        // 기존 버튼들이 담긴 컨테이너 찾기
        const existingButtonsGroup = document.querySelector('.toggle-buttons-group');
        if (!existingButtonsGroup) {
            console.warn('토글 버튼 그룹을 찾을 수 없음');
            return;
        }

        // 새로운 좌측 버튼 컨테이너 생성
        const leftButtonsContainer = document.createElement('div');
        leftButtonsContainer.className = 'player-controls';
        
        // 비디오 컨테이너 찾기
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) {
            console.warn('비디오 컨테이너를 찾을 수 없음');
            return;
        }
        
        // 비디오 컨테이너에 좌측 버튼 컨테이너 추가
        videoContainer.appendChild(leftButtonsContainer);
        
        // 미니 플레이어 버튼 생성 및 추가
        const miniPlayerBtn = document.createElement('button');
        miniPlayerBtn.className = 'control-btn';
        miniPlayerBtn.dataset.target = 'mini-player';
        miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
        miniPlayerBtn.addEventListener('click', function(event) {
            toggleMiniPlayer();
            event.stopPropagation(); // 이벤트 버블링 방지
        });
        leftButtonsContainer.appendChild(miniPlayerBtn);
        
        // 확장 버튼 생성 및 추가
        const expandBtn = document.createElement('button');
        expandBtn.className = 'control-btn';
        expandBtn.dataset.target = 'video-expand';
        expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
        expandBtn.addEventListener('click', function(event) {
            toggleVideoExpand();
            event.stopPropagation(); // 이벤트 버블링 방지
        });
        leftButtonsContainer.appendChild(expandBtn);
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

            // 컨트롤 버튼 위치 변경 추가
            moveControlButtons();
            
            window.addEventListener('scroll', updateVideoPosition);
            window.addEventListener('resize', handleResize);
            
            // 초기 크기 값 기록
            const videoContainer = document.querySelector('.video-container');
            const wrapper = videoContainer ? videoContainer.closest('.sticky-wrapper') : null;
            
            if (videoContainer && wrapper) {
                originalVideoWidth = videoContainer.offsetWidth;
                originalWrapperWidth = wrapper.offsetWidth;
            }
        } catch (error) {
            console.error('플레이어 초기화 중 오류 발생:', error);
        }
    }

    // 리사이즈 핸들러 수정
    function handleResize() {
        const videoContainer = safeQuerySelector('.video-container');
        if (!videoContainer) return;

        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        // 미니 플레이어 모드일 때는 리사이즈 처리 건너뛰기
        if (videoContainer.classList.contains('mini-player')) return;

        // 원래 래퍼 너비 업데이트 (확장 모드가 아닐 때)
        if (!videoContainer.classList.contains('expanded')) {
            originalWrapperWidth = wrapper.offsetWidth;
        }

        // fixed 또는 fixed-bottom 클래스가 있을 때 처리
        if (videoContainer.classList.contains('fixed') || videoContainer.classList.contains('fixed-bottom')) {
            if (videoContainer.classList.contains('expanded')) {
                // 확장 모드일 때는 전체 화면 너비로
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
                videoContainer.style.transform = 'none';
            } else {
                // 일반 모드에서는 원래 래퍼 너비로 설정하고 중앙 정렬
                videoContainer.style.maxWidth = `${originalWrapperWidth}px`;
                videoContainer.style.left = '50%';
                videoContainer.style.transform = 'translateX(-50%)';
            }
        }
    }

    // DOMContentLoaded 이벤트 핸들러
    document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
    /* CSS 스타일 - DOM 로드 시 추가되는 스타일 */

    /* 미니 플레이어 기본 스타일 */
    .video-container.mini-player {
        position: fixed;
        width: 400px; /* 미니 플레이어 너비 */
        height: 225px; /* 16:9 비율 */
        z-index: 1000;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        overflow: hidden;
        transform: none; /* 추가됨 */
    }

    /* 자막 크기 비율 조정 */
    .mini-player-subtitle span {
        font-size: 14px !important; /* 소형 플레이어용 자막 크기 축소 */
        max-width: 90% !important;
    }

    /* 플레이어 제어 버튼 위치 및 스타일 수정 */
    .player-controls {
        position: absolute;
        left: 10px;
        bottom: 10px;
        display: flex;
        gap: 8px;
        z-index: 100;
    }

    .control-btn {
        background: rgba(0, 0, 0, 0.5);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s ease;
    }

    .control-btn:hover {
        background: rgba(0, 0, 0, 0.7);
    }

    .control-btn i {
        font-size: 16px;
    }
    
    /* 미니 플레이어 위치별 스타일 */
    .video-container.mini-player-top-left {
        top: 20px;
        left: 20px;
    }

    .video-container.mini-player-top-right {
        top: 20px;
        right: 20px;
        left: auto; /* 추가됨 */
    }

    .video-container.mini-player-bottom-left {
        bottom: 20px;
        left: 20px;
    }

    .video-container.mini-player-bottom-right {
        bottom: 20px;
        right: 20px;
        left: auto; /* 추가됨 */
        top: auto; /* 추가됨 */
    }

    /* 미니 플레이어 모드에서 transform 초기화 - 우측 고정을 위한 버그 수정 */
    .video-container.mini-player.mini-player-top-right,
    .video-container.mini-player.mini-player-bottom-right {
        transform: none !important;
}

    /* 미니 플레이어 내 비디오 컨테이너 */
    .video-container.mini-player .video-wrapper {
        padding-bottom: 0;
        height: 100%;
    }

    /* 미니 플레이어 모드에서 자막 숨기기 */
    .video-container.mini-player .subtitle-area,
    .video-container.mini-player .subtitle-overlay {
        display: none;
    }

    /* 미니 플레이어 컨트롤 영역 */
    .video-container.mini-player .video-controls-overlay {
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .video-container.mini-player:hover .video-controls-overlay {
        opacity: 1;
    }

    /* 드래그 중 커서 스타일 */
    .video-container.mini-player {
        cursor: move;
    }
        
    .video-container {
        position: relative;
        width: 100%;
        background: #000;
        z-index: 1;
        transition: all 0.3s ease; /* 모든 전환에 애니메이션 적용 */
    }

    .video-container.fixed {
        position: fixed;
        top: 0;
        width: 100%;
        left: 50%;
        transform: translateX(-50%); /* 중앙 정렬 기본값 */
    }

    .video-container.fixed-bottom {
        position: fixed;
        bottom: 0;
        width: 100%;
        left: 50%;
        transform: translateX(-50%); /* 중앙 정렬 기본값 */
    }

    .video-wrapper {
        padding-bottom: 56.25%;
        overflow: visible;
        position: relative;
        height: 0;
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
        position: absolute;
        width: 100%;
        z-index: 100;
        pointer-events: none;
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

    #extra-subtitle-area {
        top: 10px;
    }

    #ko-subtitle-area {
        top: 0;
        bottom: 0;
        height: 100%;
        display: flex;
        align-items: center;
    }

    #en-subtitle-area {
        bottom: 10px; /* 하단 여백 */
        min-height: 40px;
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
        transform: translateY(0);
        max-width: 80%;
    }
    
    #subtitle-text-ko {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    #subtitle-text-ko span {
        font-size: 22px;
        color: #FFD700;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
        white-space: normal;
        word-break: keep-all;
        line-height: 1.5;
        margin: 0 auto;
        position: relative;
        transform: translateY(0);
        max-width: 80%;
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
        text-align: center;
        margin: 0 auto;
        max-width: 80%;
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
        width: 100vw !important;
        max-width: 100vw !important;
        left: 0 !important;
        transform: none !important;
        margin: 0 !important;
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

    /* 확장 모드에서 자막 영역 스타일 조정 */
    .video-container.expanded #subtitle-text-ko span {
        font-size: 26px; /* 조금 더 큰 자막 */
        max-width: 70%; /* 화면이 넓어지므로 자막 너비 제한 */
    }

    .video-container.expanded #subtitle-text-en span {
        font-size: 16px; /* 조금 더 큰 영어 자막 */
        max-width: 70%; /* 화면이 넓어지므로 자막 너비 제한 */
    }

    /* 전환 애니메이션 */
    .video-container {
        transition: width 0.3s ease, margin 0.3s ease, max-width 0.3s ease, left 0.3s ease, transform 0.3s ease;
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

    // 페이지의 기존 스크롤 이벤트 리스너 제거 및 재등록
    window.addEventListener('scroll', updateVideoPosition);

    // 중복된 리사이즈 이벤트 리스너들을 하나로 통합
    window.addEventListener('resize', () => {
        const videoContainer = safeQuerySelector('.video-container');
        if (!videoContainer) return;

        const wrapper = videoContainer.closest('.sticky-wrapper');
        if (!wrapper) return;

        // 미니 플레이어 모드일 때는 리사이즈 처리 건너뛰기
        if (videoContainer.classList.contains('mini-player')) return;

        // 확장 모드와 고정 모드에 따라 적절한 스타일 적용
        if (videoContainer.classList.contains('fixed') || 
            videoContainer.classList.contains('fixed-bottom')) {
            
            if (videoContainer.classList.contains('expanded')) {
                // 확장 모드일 때는 전체 화면 너비로
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
            } else {
                // 일반 모드에서는 원래 래퍼 너비로 설정
                videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
            }
        }
    });

    // 스크립트 초기화
    document.addEventListener('DOMContentLoaded', initializePlayer);
})();
