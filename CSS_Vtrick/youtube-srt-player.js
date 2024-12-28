class YouTubeSRTPlayer {
  constructor(config = {}) {
    this.config = {
      videoId: config.videoId || '',
      srtUrl: config.srtUrl || '',
      playerElementId: config.playerElementId || 'player',
      subtitleElementId: config.subtitleElementId || 'subtitle-text'
    };

    this.player = null;
    this.subtitles = [];
    this.isPlaying = false;

    this.loadYouTubeAPI();
    window.addEventListener('scroll', () => this.handleScroll());
  }

  loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      this.initializePlayer();
    };
  }

  initializePlayer() {
    this.player = new YT.Player(this.config.playerElementId, {
      videoId: this.config.videoId,
      height: '100%',
      width: '100%',
      events: {
        'onReady': (event) => this.onPlayerReady(event),
        'onStateChange': (event) => this.onPlayerStateChange(event)
      }
    });
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
        return (
          hours * 3600000 + 
          minutes * 60000 +
          seconds * 1000 +
          parseInt(ms || 0)
        );
      });

      return {
        index: parseInt(lines[0], 10),
        startTime,
        endTime,
        text: lines.slice(2).join('\n').trim()
      };
    }).filter(entry => entry !== null);
  }

  async loadSubtitles() {
    try {
      const response = await fetch(this.config.srtUrl);
      const srtContent = await response.text();
      this.subtitles = this.parseSRT(srtContent);
    } catch (error) {
      console.error('Failed to load subtitles:', error);
    }
  }

  async onPlayerReady(event) {
    try {
      await this.loadSubtitles();
      this.updateSubtitleInterval = setInterval(() => this.updateSubtitle(), 100);
    } catch (error) {
      console.error('Player ready error:', error);
    }
  }

  onPlayerStateChange(event) {
    this.isPlaying = (event.data === YT.PlayerState.PLAYING);
  }

  updateSubtitle() {
    if (!this.player || !this.player.getCurrentTime) return;

    const time = this.player.getCurrentTime() * 1000;
    const currentSubtitle = this.subtitles.find(subtitle =>
      time >= subtitle.startTime && time <= subtitle.endTime
    );

    const subtitleText = document.getElementById(this.config.subtitleElementId);
    if (subtitleText) {
      subtitleText.textContent = currentSubtitle ? currentSubtitle.text : '';
    }
  }

  handleScroll() {
    const videoContainer = document.querySelector('.video-container');
    const wrapper = document.querySelector('.sticky-wrapper');

    if (!videoContainer || !wrapper) return;

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
}

window.YouTubeSRTPlayer = YouTubeSRTPlayer;
