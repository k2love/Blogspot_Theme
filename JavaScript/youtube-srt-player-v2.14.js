// Top-level variables
let player;
let subtitlesKo = [];
let subtitlesEn = [];
let subtitlesExtra = [];
let isPlaying = false;
let previousTime = 0;
let isTimeSeek = false;

// Utility: Safe element selector
function safeQuerySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) console.warn(`Element not found: ${selector}`);
    return element;
}

// Utility: Create placeholder if missing
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

// Initialize essential elements
function initializeElements() {
    const videoContainer = safeQuerySelector('.video-container');
    const placeholder = safeQuerySelector('.placeholder') || createPlaceholder();
    if (!videoContainer || !placeholder) {
        console.error('Essential elements initialization failed');
        return false;
    }
    return { videoContainer, placeholder };
}

// Parse SRT content
function parseSRT(srtContent) {
    try {
        const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        return normalized
            .trim()
            .split('\n\n')
            .map((entry) => {
                const lines = entry.trim().split('\n');
                if (lines.length < 3) return null;
                const [startTime, endTime] = lines[1].split(' --> ').map((t) => {
                    const [time, ms] = t.trim().split(',');
                    const [h, m, s] = time.split(':').map(Number);
                    return h * 3600000 + m * 60000 + s * 1000 + parseInt(ms || '0');
                });
                return {
                    index: parseInt(lines[0], 10),
                    startTime,
                    endTime,
                    text: lines.slice(2).join('\n').trim(),
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error('SRT parsing error:', error);
        return [];
    }
}

// Load subtitles from dataset URLs
async function loadSubtitles() {
    const loaders = [
        { id: 'subtitle-url-ko', store: subtitlesKo, label: 'Korean' },
        { id: 'subtitle-url-en', store: subtitlesEn, label: 'English' },
        { id: 'subtitle-url-extra', store: subtitlesExtra, label: 'Extra' },
    ];
    for (const { id, store, label } of loaders) {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`${label} subtitle element not found`);
            continue;
        }
        const srtUrl = el.dataset.url;
        if (!srtUrl) {
            console.warn(`${label} subtitle URL missing`);
            continue;
        }
        try {
            const response = await fetch(srtUrl);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const srtContent = await response.text();
            store.splice(0, store.length, ...parseSRT(srtContent));
            console.log(`${label} subtitles loaded:`, store.length);
        } catch (error) {
            console.error(`${label} subtitles load failed:`, error);
        }
    }
}

// Update visible subtitles
function updateSubtitles() {
    if (!player || !player.getCurrentTime) return;
    const time = player.getCurrentTime() * 1000;

    [
        { id: 'subtitle-text-ko', data: subtitlesKo },
        { id: 'subtitle-text-en', data: subtitlesEn },
        { id: 'subtitle-text-extra', data: subtitlesExtra },
    ].forEach(({ id, data }) => {
        const container = document.getElementById(id);
        if (!container || container.classList.contains('hidden')) return;
        const contentDiv = container.querySelector('.subtitle-content');
        if (!contentDiv) return;
        const current = data.find((s) => time >= s.startTime && time <= s.endTime);
        contentDiv.innerHTML = current ? `<span>${current.text.replace(/\n/g, '<br>')}</span>` : '';
    });
}

// YouTube API
function loadYouTubeAPI() {
    return new Promise((resolve, reject) => {
        if (window.YT) {
            resolve(window.YT);
            return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onload = () => (window.onYouTubeIframeAPIReady = () => resolve(window.YT));
        tag.onerror = reject;
        document.head.appendChild(tag);
    });
}

// Player ready
async function onPlayerReady() {
    try {
        await loadSubtitles();
        initializeSubtitleToggles();
        updateSubtitles();
        setInterval(updateSubtitles, 100);
    } catch (error) {
        console.error('Subtitle loading error:', error);
    }
}

// Player state change
function onPlayerStateChange(e) {
    const currentTime = player.getCurrentTime();
    isTimeSeek = Math.abs(currentTime - previousTime) >= 0.5;
    const wasPlaying = isPlaying;
    isPlaying = e.data === YT.PlayerState.PLAYING;
    if (!isTimeSeek && wasPlaying !== isPlaying) updateVideoPosition();
    previousTime = currentTime;
}

// Update video position
function updateVideoPosition() {
    const elements = initializeElements();
    if (!elements) return;
    const { videoContainer, placeholder } = elements;
    const wrapper = videoContainer.closest('.sticky-wrapper');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const videoHeight = videoContainer.offsetHeight;
    const isExpanded = videoContainer.classList.contains('expanded');

    if (isPlaying) {
        if (rect.top < 0) {
            videoContainer.classList.add('fixed');
            videoContainer.classList.remove('fixed-bottom');
            placeholder.style.height = `${videoHeight}px`;
            if (isExpanded) {
                videoContainer.style.width = '100vw';
                videoContainer.style.left = '0';
            }
        } else if (windowHeight - rect.top <= videoHeight) {
            // Potential bottom fix logic...
            // ...
        }
    }
}

// Subtitles toggle
function initializeSubtitleToggles() {
    document.querySelectorAll('.toggle-btn').forEach((btn) => {
        const targetId = btn.dataset.target;
        const container = document.getElementById(targetId);
        if (!container) {
            console.warn(`Container not found: ${targetId}`);
            return;
        }
        const isVisible = localStorage.getItem(`${targetId}-visible`) !== 'false';
        container.classList.toggle('hidden', !isVisible);
        btn.classList.toggle('active', isVisible);
        btn.addEventListener('click', () => {
            container.classList.toggle('hidden');
            btn.classList.toggle('active');
            localStorage.setItem(`${targetId}-visible`, !container.classList.contains('hidden'));
        });
    });
}

// Video expand toggle
function toggleVideoExpand() {
    const videoContainer = document.querySelector('.video-container');
    const icon = document.querySelector('[data-target="video-expand"] i');
    const iframe = player?.getIframe();
    if (!videoContainer || !icon || !iframe) return;

    if (videoContainer.classList.contains('expanded')) {
        videoContainer.classList.remove('expanded');
        icon.classList.remove('fa-compress');
        icon.classList.add('fa-expand');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
    } else {
        videoContainer.classList.add('expanded');
        icon.classList.remove('fa-expand');
        icon.classList.add('fa-compress');
        const w = videoContainer.offsetWidth;
        iframe.style.width = '100%';
        iframe.style.height = `${(w * 9) / 16}px`;
    }
    updateVideoPosition();
}

// Resize handling
function handleResize() {
    const videoContainer = safeQuerySelector('.video-container');
    if (!videoContainer) return;
    const wrapper = videoContainer.closest('.sticky-wrapper');
    if (!wrapper) return;
    if (videoContainer.classList.contains('fixed') || videoContainer.classList.contains('fixed-bottom')) {
        videoContainer.style.maxWidth = videoContainer.classList.contains('expanded')
            ? '100%'
            : `${wrapper.offsetWidth}px`;
    }
}

// Main initialization
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
        if (expandButton) expandButton.addEventListener('click', toggleVideoExpand);
        window.addEventListener('scroll', updateVideoPosition);
        window.addEventListener('resize', handleResize);
    } catch (error) {
        console.error('Player init error:', error);
    }
}

// Final setup
document.addEventListener('DOMContentLoaded', initializePlayer);
window.addEventListener('scroll', updateVideoPosition);
window.addEventListener('resize', () => {
    const videoContainer = safeQuerySelector('.video-container');
    const wrapper = videoContainer?.closest('.sticky-wrapper');
    if (videoContainer && wrapper && (videoContainer.classList.contains('fixed') || videoContainer.classList.contains('fixed-bottom'))) {
        videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    }
});
