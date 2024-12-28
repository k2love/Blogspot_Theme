class YouTubeSRTPlayer {
    constructor() {
        this.player = null;
        this.isPlaying = false;
        this.subtitles = [];
        this.subtitleUpdateInterval = null;

        // 이벤트 바인딩
        window.onYouTubeIframeAPIReady = () => this.createPlayer();
        window.addEventListener('scroll', () => this.handleScroll());

        // YouTube API 로드
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
    }

    createPlayer() {
        if (!window.YOUTUBE_CONFIG) return;

        this.player = new YT.Player('player', {
            videoId: window.YOUTUBE_CONFIG.videoId,
            events: {
                'onReady': () => this.onPlayerReady(),
                'onStateChange': (event) => this.onPlayerStateChange(event)
            }
        });
    }

    onPlayerReady() {
        this.loadSubtitles();
    }

    onPlayerStateChange(event) {
        this.isPlaying = (event.data === YT.PlayerState.PLAYING);
        this.handleScroll();
    }

    handleScroll() {
        const videoContainer = document.querySelector('.video-container');
        const wrapper = document.querySelector('.sticky-wrapper');
        const rect = wrapper.getBoundingClientRect();
        
        if (rect.top <= 0 && this.isPlaying) {
            videoContainer.style.position = 'fixed';
            videoContainer.style.top = '0';
            videoContainer.style.width = wrapper.offsetWidth + 'px';
            wrapper.style.height = videoContainer.offsetHeight + 'px';
        } else {
            videoContainer.style.position = 'relative';
            videoContainer.style.top = 'auto';
            videoContainer.style.width = '100%';
            wrapper.style.height = 'auto';
        }
    }

    async loadSubtitles() {
        try {
            const response = await fetch(window.YOUTUBE_CONFIG.srtUrl);
            const srtContent = await response.text();
            this.subtitles = this.parseSRT(srtContent);
            setInterval(() => this.updateSubtitle(), 100);
        } catch (error) {
            console.error('자막 로드 실패:', error);
        }
    }

    parseSRT(srtContent) {
        const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const entries = normalizedContent.trim().split('\n\n');
        
        return entries.map(entry => {
            const lines = entry.trim().split('\n');
            if (lines.length < 3) return null;

            const timeCode = lines[1].trim();
            const [startTime, endTime] = timeCode.split(' --> ').map(timeStr => {
                const [time, ms] = timeStr.trim().split(',');
                const [hours, minutes, seconds] = time.split(':').map(Number);
                return (hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(ms));
            });

            return {
                index: parseInt(lines[0], 10),
                startTime,
                endTime,
                text: lines.slice(2).join('\n').trim()
            };
        }).filter(entry => entry !== null);
    }

    updateSubtitle() {
        if (!this.player || !this.player.getCurrentTime) return;

        const time = this.player.getCurrentTime() * 1000;
        const currentSubtitle = this.subtitles.find(subtitle => 
            time >= subtitle.startTime && time <= subtitle.endTime
        );

        const subtitleText = document.getElementById('subtitle-text');
        if (currentSubtitle) {
            subtitleText.textContent = currentSubtitle.text;
        } else {
            subtitleText.textContent = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.youtubeSRTPlayer = new YouTubeSRTPlayer();
});
