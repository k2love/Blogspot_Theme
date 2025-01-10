// 개선된 자막 로딩 및 YouTube 비디오 스크립트
(function() {
    // 전역 변수 선언 (let으로 변경)
    let player;
    let subtitlesKo = [];
    let subtitlesEn = [];
    let subtitlesExtra = [];
    let isPlaying = false;
    let previousTime = 0;
    let isTimeSeek = false;
    let isExpanded = false;
    
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
            }).filter(entry => entry !== null);
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

    // 자막 업데이트 함수 개선
    function updateSubtitles() {
        if (!player || !player.getCurrentTime) return;

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

            const currentSubtitle = subtitles.find(subtitle => 
                time >= subtitle.startTime && time <= subtitle.endTime
            );

            contentDiv.innerHTML = currentSubtitle ? 
                `<span>${currentSubtitle.text.replace(/\n/g, '<br>')}</span>` : '';
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
            tag.src = "https://www.youtube.com/iframe_api";
            tag.onload = () => {
                // YouTube API 로드 대기
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
            
            // 자막 초기 업데이트 및 주기적 업데이트
            updateSubtitles();
            setInterval(updateSubtitles, 100);
        } catch (error) {
            console.error("자막 로딩 중 심각한 오류 발생:", error);
        }
    }

    // 플레이어 상태 변경 핸들러
    function onPlayerStateChange(event) {
        const currentTime = player.getCurrentTime();
        const timeDiff = Math.abs(currentTime - previousTime);
        
        isTimeSeek = (timeDiff >= 0.5);
        
        if (event.data === YT.PlayerState.PLAYING) {
            isPlaying = true;
            if (!isTimeSeek) {
                updateVideoPosition();
            }
        } else if (event.data === YT.PlayerState.PAUSED && !isTimeSeek) {
            isPlaying = false;
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

        // 정지 상태일 때 원래 위치로 강제 복귀
        if (!isPlaying) {
            requestAnimationFrame(() => {
                videoContainer.style.transition = 'all 0.3s ease';
                placeholder.style.transition = 'height 0.3s ease';
                videoContainer.classList.remove('fixed');
                videoContainer.classList.remove('fixed-bottom');
                placeholder.style.height = '0';
                
                // 확장 상태 유지
                if (isExpanded) {
                    videoContainer.classList.add('expanded');
                }
            });
            return;
        }
    
        // 시간 이동 중에는 position 변경하지 않음
        if (isTimeSeek) {
            return;
        }

        // 재생 중일 때의 position 설정
        if (rect.top < 0) {
            videoContainer.classList.add('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
        } else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.add('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
        } else {
            videoContainer.classList.remove('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = '0';
        }

        // 확장 상태 유지
        if (isExpanded) {
            videoContainer.classList.add('expanded');
        }
    }

    // 확장 버튼 초기화 함수
    function initializeExpandButton() {
        const videoContainer = safeQuerySelector('.video-container');
        if (!videoContainer) return;

        // 확장 버튼 생성
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = '<i class="fas fa-expand"></i>'; // Font Awesome 사용
        videoContainer.appendChild(expandBtn);

        // localStorage에서 이전 상태 복원
        const savedState = localStorage.getItem('video-expanded');
        if (savedState === 'true') {
            isExpanded = true;
            videoContainer.classList.add('expanded');
            expandBtn.innerHTML = '<i class="fas fa-compress"></i>';
        }

        // 클릭 이벤트 설정
        expandBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            videoContainer.classList.toggle('expanded');
            expandBtn.innerHTML = isExpanded ? 
                '<i class="fas fa-compress"></i>' : 
                '<i class="fas fa-expand"></i>';
            localStorage.setItem('video-expanded', isExpanded);
            
            // 위치 업데이트
            updateVideoPosition();
        });
    }

    // 자막 토글 및 확장 버튼 초기화
    function initializeSubtitleToggles() {
        const toggleButtons = document.querySelectorAll('.toggle-btn');
        
        toggleButtons.forEach(button => {
            const targetId = button.dataset.target;
            
            // 확장 버튼인 경우
            if (targetId === 'video-expand') {
                // 저장된 상태 복원
                isExpanded = localStorage.getItem('video-expanded') === 'true';
                const videoContainer = document.querySelector('.video-container');
                if (isExpanded) {
                    videoContainer.classList.add('expanded');
                    button.innerHTML = '<i class="fas fa-compress"></i>';
                }

                button.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    videoContainer.classList.toggle('expanded');
                    button.innerHTML = isExpanded ? 
                        '<i class="fas fa-compress"></i>' : 
                        '<i class="fas fa-expand"></i>';
                    localStorage.setItem('video-expanded', isExpanded);
                    updateVideoPosition();
                });
                return;
            }

            // 기존 자막 토글 처리
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
            
    // 메인 초기화 함수
    async function initializePlayer() {
        try {
            // YouTube API 로드
            await loadYouTubeAPI();

            // YouTube 플레이어 생성
            player = new YT.Player('player', {
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });

            // 스크롤 이벤트
            window.addEventListener('scroll', () => {
                if (!isTimeSeek) {
                    updateVideoPosition();
                }
            });

            // 스크롤 및 리사이즈 이벤트 리스너
            window.addEventListener('scroll', updateVideoPosition);
            window.addEventListener('resize', () => {
                const videoContainer = safeQuerySelector('.video-container');
                if (!videoContainer) return;
                
                const wrapper = videoContainer.closest('.sticky-wrapper');
                if (!wrapper) return;
                
                if (videoContainer.classList.contains('fixed') || 
                    videoContainer.classList.contains('fixed-bottom')) {
                    videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
                }
                
                updateVideoPosition();
            });

    // 스크립트 초기화
    document.addEventListener('DOMContentLoaded', initializePlayer);
})();  