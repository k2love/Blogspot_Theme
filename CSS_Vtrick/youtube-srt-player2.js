/************************************************
 * youtube-srt-player.js
 * (HTML���� data-srt-url�� �޾ƿ� �ڸ� �ε�)
 ************************************************/

// ���� ����
let player;
let subtitles = [];
let isPlaying = false;
let videoContainer;
let placeholder;

/**
 * SRT �Ľ� �Լ�
 * @param {string} srtContent
 * @returns {Array} �Ľ̵� �ڸ� �迭
 */
function parseSRT(srtContent) {
  const normalizedContent = srtContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const entries = normalizedContent.trim().split("\n\n");

  return entries
    .map((entry) => {
      const lines = entry.trim().split("\n");
      if (lines.length < 3) return null;

      const timeCode = lines[1].trim();
      const [startTime, endTime] = timeCode.split(" --> ").map((timeStr) => {
        const [time, ms] = timeStr.trim().split(",");
        const [hours, minutes, seconds] = time.split(":").map(Number);
        return (
          hours * 3600000 +
          minutes * 60000 +
          seconds * 1000 +
          parseInt(ms, 10)
        );
      });

      const text = lines.slice(2).join("\n").trim();

      return {
        index: parseInt(lines[0], 10),
        startTime,
        endTime,
        text,
      };
    })
    .filter((entry) => entry !== null);
}

/**
 * �ڸ� ���� �ε� �Լ�
 * @param {string} srtUrl
 */
async function loadSubtitles(srtUrl) {
  try {
    const response = await fetch(srtUrl);
    const srtContent = await response.text();
    subtitles = parseSRT(srtContent);
  } catch (error) {
    console.error("�ڸ��� �ҷ����µ� �����߽��ϴ�:", error);
  }
}

/**
 * YouTube �÷��̾� ���� ���� �ڵ鷯
 */
function onPlayerStateChange(event) {
  isPlaying = event.data === YT.PlayerState.PLAYING;
  updateVideoPosition();
}

/**
 * �÷��̾� �غ� �Ϸ� �ڵ鷯
 */
function onPlayerReady() {
  // �ڸ� ������Ʈ �ֱ� ����
  setInterval(updateSubtitle, 100);
}

/**
 * �ڸ� ������Ʈ
 */
function updateSubtitle() {
  if (!player || !player.getCurrentTime) return;

  const time = player.getCurrentTime() * 1000;
  const currentSubtitle = subtitles.find(
    (sub) => time >= sub.startTime && time <= sub.endTime
  );

  const subtitleText = document.getElementById("subtitle-text");
  if (currentSubtitle) {
    subtitleText.textContent = currentSubtitle.text;
  } else {
    subtitleText.textContent = "";
  }
}

/**
 * ��ũ��/�������� � ���� ���� ������ ������Ʈ
 */
function updateVideoPosition() {
  if (!videoContainer || !placeholder) return;

  const wrapper = videoContainer.closest(".sticky-wrapper");
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const videoHeight = videoContainer.offsetHeight;

  if (!isPlaying) {
    // ��� ���� �ƴ� ���� �������� ����
    videoContainer.classList.remove("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = "";
    placeholder.style.height = "0";
    return;
  }

  // ��ܿ� ����
  if (rect.top < 0) {
    videoContainer.classList.add("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    placeholder.style.height = `${videoHeight}px`;
  }
  // �ϴܿ� ����
  else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
    videoContainer.classList.remove("fixed");
    videoContainer.classList.add("fixed-bottom");
    videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    placeholder.style.height = `${videoHeight}px`;
  }
  // �Ϲ� ��ġ
  else {
    videoContainer.classList.remove("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = "";
    placeholder.style.height = "0";
  }
}

/**
 * �ʱ�ȭ: DOM ���, �̺�Ʈ ������ ����
 */
function initializeElements() {
  videoContainer = document.querySelector(".video-container");
  placeholder = document.querySelector(".placeholder");

  if (!videoContainer || !placeholder) {
    console.error("�ʼ� ��� .video-container �Ǵ� .placeholder�� ã�� �� �����ϴ�.");
    return false;
  }

  // ��ũ�� / �������� �� �̺�Ʈ
  window.addEventListener("scroll", updateVideoPosition);
  window.addEventListener("resize", () => {
    const wrapper = videoContainer.closest(".sticky-wrapper");
    if (!wrapper) return;
    if (
      videoContainer.classList.contains("fixed") ||
      videoContainer.classList.contains("fixed-bottom")
    ) {
      videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    }
  });

  return true;
}

/**
 * YouTube Iframe API���� ȣ���ϴ� ���� �Լ�
 * (�ݵ�� ���� �������� �־�� ��)
 */
function onYouTubeIframeAPIReady() {
  // �ʱ�ȭ
  if (!initializeElements()) return;

  // HTML�� script �±׿��� data-srt-url ������ ��������
  const scriptTag = document.querySelector('script[src*="youtube-srt-player.js"]');
  if (!scriptTag) {
    console.error("youtube-srt-player.js�� �ε��ϴ� <script> �±׸� ã�� �� �����ϴ�.");
    return;
  }
  const srtUrl = scriptTag.getAttribute("data-srt-url");
  if (!srtUrl) {
    console.warn("data-srt-url�� �������� �ʾҽ��ϴ�. �ڸ��� ǥ�õ��� �ʽ��ϴ�.");
  }

  // SRT �ڸ� �ε�
  loadSubtitles(srtUrl).then(() => {
    // YouTube Player ����
    player = new YT.Player("player", {
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  });
}