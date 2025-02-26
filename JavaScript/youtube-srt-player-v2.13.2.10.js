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

    // 미니 플레이어 관련 변수
    let isMiniPlayer = false;
    let miniPlayerPosition = 'bottom-right'; // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    let isDragging = false;
    let dragStartX, dragStartY;
    let miniPlayerX, miniPlayerY;

    // 컨트롤 버튼 자동 숨김 관련 변수
    let controlsTimeout;
    let isControlsVisible = true;

    // 버튼 이벤트 핸들러 등록 상태 추적
    let buttonHandlersInitialized = false;

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

    // 미니 플레이어 전환 함수 - 이벤트 핸들러 개선
    function toggleMiniPlayer(event) {
        // 이벤트가 있는 경우 기본 동작 방지 및 전파 중단
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        console.log('toggleMiniPlayer 함수 호출됨');
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) {
            console.error('비디오 컨테이너를 찾을 수 없음');
            return;
        }
        
        isMiniPlayer = !isMiniPlayer;
        
        if (isMiniPlayer) {
            // 일반 모드에서 미니 플레이어 모드로 전환
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
            videoContainer.classList.remove('expanded');
            videoContainer.classList.add('mini-player');
            videoContainer.classList.add(`mini-player-${miniPlayerPosition}`);
            
            // 미니 플레이어 버튼 아이콘 변경
            const miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
            if (miniPlayerBtn) {
                miniPlayerBtn.innerHTML = '<i class="fas fa-expand"></i>';
                miniPlayerBtn.title = "미니 플레이어 종료";
            }

            // 자막 크기 조정을 위한 클래스 추가
            adjustSubtitleSizeForMiniPlayer(true);            

            // 드래그 이벤트 추가
            videoContainer.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', dragMiniPlayer);
            document.addEventListener('mouseup', stopDrag);

            // 미니플레이어 모드일 때는 컨트롤 항상 표시
            showControls(true);            
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
                miniPlayerBtn.title = "미니 플레이어";
            }
            
            // 자막 크기 조정 클래스 제거
            adjustSubtitleSizeForMiniPlayer(false);
            
            // 드래그 이벤트 제거
            videoContainer.removeEventListener('mousedown', startDrag);
            document.removeEventListener('mousemove', dragMiniPlayer);
            document.removeEventListener('mouseup', stopDrag);
            
            // 현재 스크롤 위치에 따라 fixed 클래스 다시 적용
            updateVideoPosition();

            // 일반 모드에서는 자동 숨김 활성화
            hideControlsWithDelay();            
        }

        // 미니 플레이어 상태 로컬 스토리지에 저장
        localStorage.setItem('miniPlayerMode', isMiniPlayer ? 'true' : 'false');
        localStorage.setItem('miniPlayerPosition', miniPlayerPosition);
        
        return false; // 이벤트 전파 중단
    }

    // 비디오 확장 토글 함수 - 이벤트 핸들러 개선
    function toggleVideoExpand(event) {
        // 이벤트가 있는 경우 기본 동작 방지 및 전파 중단
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        console.log('toggleVideoExpand 함수 호출됨');
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) {
            console.error('비디오 컨테이너를 찾을 수 없음');
            return;
        }

        const expandButton = document.querySelector('[data-target="video-expand"]');
        
        if (videoContainer.classList.contains('expanded')) {
            // 축소 모드로 전환
            videoContainer.classList.remove('expanded');
            if (expandButton) {
                expandButton.innerHTML = '<i class="fas fa-expand"></i>';
                expandButton.title = "확장 모드";
            }
            // 원래 너비로 복원
            videoContainer.style.width = '';
            videoContainer.style.maxWidth = '';
            videoContainer.style.margin = '';
        } else {
            // 확장 모드로 전환 - 전체 화면 너비로 확장
            videoContainer.classList.add('expanded');
            if (expandButton) {
                expandButton.innerHTML = '<i class="fas fa-compress"></i>';
                expandButton.title = "확장 모드 종료";
            }
            // 전체 화면 너비로 설정
            videoContainer.style.width = '100vw';
            videoContainer.style.maxWidth = '100vw';
            videoContainer.style.margin = '0 calc(-50vw + 50%)';
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

        // 컨트롤 일시적 표시
        showControls();

        // 확장 모드 상태 로컬 스토리지에 저장
        localStorage.setItem('expandedMode', videoContainer.classList.contains('expanded') ? 'true' : 'false');
        
        return false; // 이벤트 전파 중단
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
        miniPlayerX = matrix.m41 || 0; // 값이 없을 경우 0으로 초기화
        miniPlayerY = matrix.m42 || 0; // 값이 없을 경우 0으로 초기화
        
        // 드래그 중에 선택이 되지 않도록 방지
        e.preventDefault();

        // 드래그 중 스타일 추가
        videoContainer.classList.add('dragging');
    }

    // 드래그 중 함수 - 부드러운 이동 개선
    function dragMiniPlayer(e) {
        if (!isDragging) return;
        
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        // 새 위치 계산
        const newX = miniPlayerX + deltaX;
        const newY = miniPlayerY + deltaY;
        
        // requestAnimationFrame을 사용하여 부드러운 이동 구현
        requestAnimationFrame(() => {
            // transform 적용 - translate3d로 하드웨어 가속 활용
            videoContainer.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
        });
        
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

        // 드래그 중 스타일 제거
        videoContainer.classList.remove('dragging');
        
        // 모든 위치 클래스 제거
        videoContainer.classList.remove('mini-player-top-left');
        videoContainer.classList.remove('mini-player-top-right');
        videoContainer.classList.remove('mini-player-bottom-left');
        videoContainer.classList.remove('mini-player-bottom-right');
        
        // 드래그 후 위치에 따라 자동으로 모서리로 배치 (애니메이션 추가)
        videoContainer.style.transition = 'transform 0.3s ease, left 0.3s ease, top 0.3s ease, right 0.3s ease, bottom 0.3s ease';
        videoContainer.classList.add(`mini-player-${miniPlayerPosition}`);
        videoContainer.style.transform = '';

        // 미니 플레이어 위치 저장
        localStorage.setItem('miniPlayerPosition', miniPlayerPosition);
              
        // 트랜지션 완료 후 트랜지션 속성 제거
        setTimeout(() => {
            videoContainer.style.transition = '';
        }, 300);
    }

    // 컨트롤 표시 함수
    function showControls(permanent = false) {
        const playerControls = document.querySelector('.player-controls');
        const toggleButtons = document.querySelector('.toggle-buttons-group');
        
        if (!playerControls || !toggleButtons) return;
        
        // 컨트롤 표시
        playerControls.classList.add('controls-visible');
        toggleButtons.classList.add('controls-visible');
        
        // 인라인 스타일로 강제 표시
        playerControls.style.opacity = '1';
        playerControls.style.visibility = 'visible';
        playerControls.style.pointerEvents = 'auto';
        
        toggleButtons.style.opacity = '1';
        toggleButtons.style.visibility = 'visible';
        toggleButtons.style.pointerEvents = 'auto';
        
        isControlsVisible = true;
       
        // 자동 숨김 타이머 취소
        clearTimeout(controlsTimeout);
        
        // permanent가 true가 아니면 일정 시간 후 숨김
        if (!permanent && !isMiniPlayer) {
            hideControlsWithDelay();
        }
    }

    // 컨트롤 숨김 함수
    function hideControls() {
        const playerControls = document.querySelector('.player-controls');
        const toggleButtons = document.querySelector('.toggle-buttons-group');
        
        if (!playerControls || !toggleButtons) return;
        
        // 미니 플레이어 모드에서는 숨기지 않음
        if (isMiniPlayer) return;
        
        // 컨트롤 숨김
        playerControls.classList.remove('controls-visible');
        toggleButtons.classList.remove('controls-visible');
        isControlsVisible = false;
    }

    // 지연 후 컨트롤 숨김 함수
    function hideControlsWithDelay() {
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            hideControls();
        }, 3000); // 3초 후 숨김
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

            // 초기 컨트롤 상태 설정
            showControls();

            // 이전 상태 복원
            restorePreviousState();
            
            // 일정 시간 후 자동 숨김 (미니 플레이어 모드가 아닌 경우)
            if (!isMiniPlayer) {
                hideControlsWithDelay();
            }
        } catch (error) {
            console.error('자막 로딩 중 심각한 오류 발생:', error);
        }
    }            

    // 이전 상태 복원 함수 (로컬 스토리지 사용)
    function restorePreviousState() {
        try {
            // 미니 플레이어 모드 복원
            const savedMiniPlayerMode = localStorage.getItem('miniPlayerMode');
            if (savedMiniPlayerMode === 'true' && !isMiniPlayer) {
                // 미니 플레이어 위치 복원
                const savedPosition = localStorage.getItem('miniPlayerPosition');
                if (savedPosition) {
                    miniPlayerPosition = savedPosition;
                }
                toggleMiniPlayer();
            }
            
            // 확장 모드 복원
            const savedExpandedMode = localStorage.getItem('expandedMode');
            if (savedExpandedMode === 'true') {
                const videoContainer = document.querySelector('.video-container');
                if (videoContainer && !videoContainer.classList.contains('expanded')) {
                    toggleVideoExpand();
                }
            }
        } catch (error) {
            console.error('이전 상태 복원 중 오류 발생:', error);
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
            // 재생 시작 시 컨트롤 일시적 표시 후 숨김
            showControls();
        } else if (event.data === YT.PlayerState.PAUSED) {
            isPlaying = false;
            // 일시 정지 시 컨트롤 계속 표시
            showControls(true);
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
                
                // 확장 모드가 아닐 때만 maxWidth 초기화
                if (!videoContainer.classList.contains('expanded')) {
                    videoContainer.style.maxWidth = '';
                }
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
            
            // 확장 모드일 때는 전체 화면 너비로, 아닐 때는 래퍼 너비로
            if (videoContainer.classList.contains('expanded')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
            } else {
                videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
            }
            
            // 컨트롤 일시적 표시
            showControls(); 
        } else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.add('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            
            // 확장 모드일 때는 전체 화면 너비로, 아닐 때는 래퍼 너비로
            if (videoContainer.classList.contains('expanded')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
            } else {
                videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
            }
            
            // 컨트롤 일시적 표시
            showControls();
        } else {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = '0';
            
            // 확장 모드가 아닐 때만 maxWidth 초기화
            if (!videoContainer.classList.contains('expanded')) {
                videoContainer.style.maxWidth = '';
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

    // 완전히 개선된 컨트롤 버튼 초기화 함수
    function initializeControlButtons() {
        // 이미 초기화되었으면 중복 실행 방지
        if (buttonHandlersInitialized) {
            return;
        }
        
        console.log('컨트롤 버튼 초기화 시작');
        
        // 비디오 컨테이너 찾기
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) {
            console.error('비디오 컨테이너를 찾을 수 없음');
            return;
        }
        
        // 기존 버튼 컨테이너 찾거나 생성
        let leftButtonsContainer = document.querySelector('.player-controls');
        if (!leftButtonsContainer) {
            console.log('컨트롤 버튼 컨테이너 생성');
            leftButtonsContainer = document.createElement('div');
            leftButtonsContainer.className = 'player-controls controls-visible';
            videoContainer.appendChild(leftButtonsContainer);
        }
        
        // 버튼 그룹 컨테이너 찾거나 생성
        let existingButtonsGroup = document.querySelector('.toggle-buttons-group');
        if (!existingButtonsGroup) {
            console.log('토글 버튼 그룹 생성');
            existingButtonsGroup = document.createElement('div');
            existingButtonsGroup.className = 'toggle-buttons-group controls-visible';
            videoContainer.appendChild(existingButtonsGroup);
        }
        
        // 컨테이너 스타일 강제 적용
        leftButtonsContainer.style.opacity = '1';
        leftButtonsContainer.style.visibility = 'visible';
        leftButtonsContainer.style.pointerEvents = 'auto';
        leftButtonsContainer.style.zIndex = '1000';
        
        existingButtonsGroup.style.opacity = '1';
        existingButtonsGroup.style.visibility = 'visible';
        existingButtonsGroup.style.pointerEvents = 'auto';
        existingButtonsGroup.style.zIndex = '1000';

        // 기존 버튼 이벤트 리스너 제거
        const oldMiniPlayerBtn = document.querySelector('[data-target="mini-player"]');
        if (oldMiniPlayerBtn) {
            const oldClone = oldMiniPlayerBtn.cloneNode(true);
            if (oldMiniPlayerBtn.parentNode) {
                oldMiniPlayerBtn.parentNode.replaceChild(oldClone, oldMiniPlayerBtn);
            }
        }
        
        const oldExpandBtn = document.querySelector('[data-target="video-expand"]');
        if (oldExpandBtn) {
            const oldClone = oldExpandBtn.cloneNode(true);
            if (oldExpandBtn.parentNode) {
                oldExpandBtn.parentNode.replaceChild(oldClone, oldExpandBtn);
            }
        }

        // 미니 플레이어 버튼 생성 및 이벤트 처리
        let miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
        if (!miniPlayerBtn) {
            console.log('미니 플레이어 버튼 생성');
            miniPlayerBtn = document.createElement('button');
            miniPlayerBtn.className = 'control-btn';
            miniPlayerBtn.setAttribute('data-target', 'mini-player');
            miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
            miniPlayerBtn.title = "미니 플레이어";
            leftButtonsContainer.appendChild(miniPlayerBtn);
        }
        
        // 확장 버튼 생성 및 이벤트 처리
        let expandBtn = document.querySelector('[data-target="video-expand"]');
        if (!expandBtn) {
            console.log('확장 버튼 생성');
            expandBtn = document.createElement('button');
            expandBtn.className = 'control-btn';
            expandBtn.setAttribute('data-target', 'video-expand');
            expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
            expandBtn.title = "확장 모드";
            leftButtonsContainer.appendChild(expandBtn);
        }

        // 각 버튼의 초기 상태 설정
        if (isMiniPlayer) {
            miniPlayerBtn.innerHTML = '<i class="fas fa-expand"></i>';
            miniPlayerBtn.title = "미니 플레이어 종료";
        } else {
            miniPlayerBtn.innerHTML = '<i class="fas fa-compress"></i>';
            miniPlayerBtn.title = "미니 플레이어";
        }
        
        if (videoContainer.classList.contains('expanded')) {
            expandBtn.innerHTML = '<i class="fas fa-compress"></i>';
            expandBtn.title = "확장 모드 종료";
        } else {
            expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
            expandBtn.title = "확장 모드";
        }
        
        // 이벤트 리스너 직접 등록 (명확한 이벤트 바인딩)
        miniPlayerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('미니 플레이어 버튼 클릭됨 (직접 핸들러)');
            toggleMiniPlayer(e);
            return false;
        });
        
        expandBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('확장 버튼 클릭됨 (직접 핸들러)');
            toggleVideoExpand(e);
            return false;
        });
        
        // 디버깅용 콘솔 출력
        console.log('미니 플레이어 버튼:', miniPlayerBtn);
        console.log('확장 버튼:', expandBtn);
        
        // 버튼 핸들러 초기화 완료 플래그 설정
        buttonHandlersInitialized = true;
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

            // 이벤트 리스너 등록
            window.addEventListener('scroll', updateVideoPosition);
            window.addEventListener('resize', handleResize);
        
            // 비디오 컨테이너에 마우스 이벤트 추가
            const videoContainer = document.querySelector('.video-container');
            if (videoContainer) {
                videoContainer.addEventListener('mousemove', () => showControls());
                videoContainer.addEventListener('mouseleave', () => {
                    if (!isMiniPlayer) {
                        hideControlsWithDelay();
                    }
                });
            }

            // 컨트롤 버튼 초기화
            initializeControlButtons();
            
            // DOM이 완전히 로드된 후 버튼 이벤트 리스너 재설정
            setTimeout(() => {
                initializeControlButtons();
                showControls(true);
                console.log('지연 후 버튼 이벤트 리스너 재설정 완료');
            }, 1000);

            // 2초 후 한 번 더 확인 (이벤트 리스너 유실 방지)
            setTimeout(() => {
                // 버튼이 작동하지 않는 경우 대비해 강제 재초기화
                const miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
                const expandBtn = document.querySelector('[data-target="video-expand"]');
                
                if (miniPlayerBtn) {
                    // 기존 모든 이벤트 리스너 제거 (클론 교체)
                    const newMiniBtn = miniPlayerBtn.cloneNode(true);
                    if (miniPlayerBtn.parentNode) {
                        miniPlayerBtn.parentNode.replaceChild(newMiniBtn, miniPlayerBtn);
                    }
                    
                    // 직접 이벤트 리스너 등록
                    newMiniBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('미니 플레이어 버튼 클릭됨 (백업 핸들러)');
                        toggleMiniPlayer(e);
                    });
                }
                
                if (expandBtn) {
                    // 기존 모든 이벤트 리스너 제거 (클론 교체)
                    const newExpandBtn = expandBtn.cloneNode(true);
                    if (expandBtn.parentNode) {
                        expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
                    }
                    
                    // 직접 이벤트 리스너 등록
                    newExpandBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('확장 버튼 클릭됨 (백업 핸들러)');
                        toggleVideoExpand(e);
                    });
                }
                
                console.log('버튼 이벤트 핸들러 백업 등록 완료');
            }, 2000);
            
            // 주기적으로 컨트롤 버튼 가시성 및 이벤트 리스너 확인
            const controlCheckInterval = setInterval(() => {
                const playerControls = document.querySelector('.player-controls');
                const toggleButtons = document.querySelector('.toggle-buttons-group');
                
                // 컨트롤 가시성 확인 및 강제 설정
                if (playerControls) {
                    playerControls.classList.add('controls-visible');
                    playerControls.style.opacity = '1';
                    playerControls.style.visibility = 'visible';
                    playerControls.style.pointerEvents = 'auto';
                    playerControls.style.zIndex = '1000';
                }
                
                if (toggleButtons) {
                    toggleButtons.classList.add('controls-visible');
                    toggleButtons.style.opacity = '1';
                    toggleButtons.style.visibility = 'visible';
                    toggleButtons.style.pointerEvents = 'auto';
                    toggleButtons.style.zIndex = '1000';
                }
       
                // 버튼 이벤트 리스너 확인
                const miniPlayerBtn = document.querySelector('[data-target="mini-player"]');
                const expandBtn = document.querySelector('[data-target="video-expand"]');
                
                // 버튼이 있지만 이벤트가 없는 경우 재설정
                if (miniPlayerBtn && !miniPlayerBtn.hasAttribute('data-initialized')) {
                    miniPlayerBtn.setAttribute('data-initialized', 'true');
                    miniPlayerBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('미니 플레이어 버튼 클릭됨 (주기적 체크)');
                        toggleMiniPlayer(e);
                    });
                }
                
                if (expandBtn && !expandBtn.hasAttribute('data-initialized')) {
                    expandBtn.setAttribute('data-initialized', 'true');
                    expandBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('확장 버튼 클릭됨 (주기적 체크)');
                        toggleVideoExpand(e);
                    });
                }
            }, 3000);

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

        // 확장 모드일 때는 전체 화면 너비 유지
        if (videoContainer.classList.contains('expanded')) {
            if (videoContainer.classList.contains('fixed') || 
                videoContainer.classList.contains('fixed-bottom')) {
                videoContainer.style.width = '100vw';
                videoContainer.style.maxWidth = '100vw';
                videoContainer.style.left = '0';
            }
        } else if (videoContainer.classList.contains('fixed') || 
                videoContainer.classList.contains('fixed-bottom')) {
            // 일반 모드에서는 원래 래퍼 너비로 설정
            videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
        }
    }

    // DOMContentLoaded 이벤트 핸들러
    document.addEventListener('DOMContentLoaded', () => {
        // 스타일 추가
        addStyles();
        
        // 초기화 실행
        initializePlayer();
    });
    
    // 스타일 추가 함수
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
    /* CSS 스타일 */

    /* 미니 플레이어 기본 스타일 */
    .video-container.mini-player {
        position: fixed;
        width: 400px; /* 미니 플레이어 너비 */
        height: 225px; /* 16:9 비율 */
        z-index: 9999;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        overflow: hidden;
        transform: none !important; /* 중요: 초기 transform 설정 */
    }

    /* 자막 크기 비율 조정 */
    .mini-player-subtitle span {
        font-size: 14px !important; /* 소형 플레이어용 자막 크기 축소 */
        max-width: 90% !important;
    }

    /* 드래그 중 스타일 */
    .video-container.mini-player.dragging {
        opacity: 0.8;
        cursor: grabbing !important;
        transition: none; /* 드래그 중에는 트랜지션 비활성화 */
    }

    /* 플레이어 제어 버튼 자동 숨김 및 표시 */
    .player-controls {
        position: absolute;
        left: 10px;
        bottom: 10px;
        display: flex;
        gap: 8px;
        z-index: 9999;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transition: opacity 0.3s ease;
    }

    .toggle-buttons-group {
        position: absolute;
        right: 5px;
        bottom: 5px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: flex-end;
        z-index: 9999;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transition: opacity 0.3s ease;
    }

    /* 중요: 가시성 클래스 스타일 수정 - 가시성 문제 해결 */
    .player-controls.controls-visible,
    .toggle-buttons-group.controls-visible {
        opacity: 1 !important; /* !important 추가로 우선순위 높임 */
        pointer-events: auto !important; /* 클릭 이벤트 반드시 활성화 */
        visibility: visible !important; /* 가시성 확실히 보장 */
    }

    /* 미니 플레이어에서는 항상 컨트롤 표시 */
    .video-container.mini-player .player-controls,
    .video-container.mini-player .toggle-buttons-group {
        opacity: 1 !important;
        pointer-events: auto !important;
        visibility: visible !important;
    }

    .control-btn {
        background: rgba(0, 0, 0, 0.7);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex !important;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s ease;
        opacity: 1 !important;
        visibility: visible !important;
        z-index: 9999;
        margin: 3px;
    }

    .control-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
    }

    .control-btn i {
        font-size: 16px;
        opacity: 1 !important;
        visibility: visible !important;
    }
    
    /* 미니 플레이어 위치별 스타일 */
    .video-container.mini-player-top-left {
        top: 20px !important;
        left: 20px !important;
        right: auto !important;
        bottom: auto !important;
    }

    .video-container.mini-player-top-right {
        top: 20px !important;
        right: 20px !important;
        left: auto !important;
        bottom: auto !important;
    }

    .video-container.mini-player-bottom-left {
        bottom: 20px !important;
        left: 20px !important;
        top: auto !important;
        right: auto !important;
    }

    .video-container.mini-player-bottom-right {
        bottom: 20px !important;
        right: 20px !important;
        left: auto !important;
        top: auto !important;
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
    }

    .video-container.fixed {
        position: fixed;
        top: 0;
        width: 100%;
        z-index: 100;
    }

    .video-container.fixed-bottom {
        position: fixed;
        bottom: 0;
        width: 100%;
        z-index: 100;
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

    /* 확장 모드 스타일 개선 */
    .video-container.expanded {
        position: relative;
        width: 100vw !important;
        background-color: #000;
        margin-left: calc(-50vw + 50%) !important;
        margin-right: calc(-50vw + 50%) !important;
        z-index: 50;
    }

    .video-container.expanded.fixed,
    .video-container.expanded.fixed-bottom {
        position: fixed;
        width: 100vw !important;
        max-width: 100vw !important;
        left: 0 !important;
        margin: 0 !important;
        z-index: 100;
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

    /* 컨트롤 버튼 영역 추가 스타일 */
    .player-controls button,
    .toggle-buttons-group button {
        opacity: 1 !important;
        visibility: visible !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 10000 !important;
    }

    /* 플레이스홀더 스타일 */
    .placeholder {
        display: none;
    }

    .video-container.fixed + .placeholder,
    .video-container.fixed-bottom + .placeholder {
        display: block;
    }  

    /* 자막 영역 스타일 */
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
        max-width: 80%;
    }

    #subtitle-text-en span {
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
    `;
            document.head.appendChild(style);
    }

    // 페이지의 기존 스크롤 이벤트 리스너 제거 및 재등록
    window.addEventListener('scroll', updateVideoPosition);

})();