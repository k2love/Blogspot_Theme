/************************************************
 * youtube-srt-player.js
 * (HTML에서 data-srt-url을 받아와 자막 로드)
 ************************************************/

// 전역 변수
let player;
let subtitles = [];
let isPlaying = false;
let videoContainer;
let placeholder;

/**
 * SRT 파싱 함수
 * @param {string} srtContent
 * @returns {Array} 파싱된 자막 배열
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
 * 자막 파일 로드 함수
 * @param {string} srtUrl
 */
async function loadSubtitles(srtUrl) {
  try {
    const response = await fetch(srtUrl);
    const srtContent = await response.text();
    subtitles = parseSRT(srtContent);
  } catch (error) {
    console.error("자막을 불러오는데 실패했습니다:", error);
  }
}

/**
 * YouTube 플레이어 상태 변경 핸들러
 */
function onPlayerStateChange(event) {
  isPlaying = event.data === YT.PlayerState.PLAYING;
  updateVideoPosition();
}

/**
 * 플레이어 준비 완료 핸들러
 */
function onPlayerReady() {
  // 자막 업데이트 주기 설정
  setInterval(updateSubtitle, 100);
}

/**
 * 자막 업데이트
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
 * 스크롤/리사이즈 등에 따라 비디오 포지션 업데이트
 */
function updateVideoPosition() {
  if (!videoContainer || !placeholder) return;

  const wrapper = videoContainer.closest(".sticky-wrapper");
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const videoHeight = videoContainer.offsetHeight;

  if (!isPlaying) {
    // 재생 중이 아닐 때는 고정하지 않음
    videoContainer.classList.remove("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = "";
    placeholder.style.height = "0";
    return;
  }

  // 상단에 고정
  if (rect.top < 0) {
    videoContainer.classList.add("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    placeholder.style.height = `${videoHeight}px`;
  }
  // 하단에 고정
  else if (windowHeight - rect.top <= videoHeight && rect.top > 0) {
    videoContainer.classList.remove("fixed");
    videoContainer.classList.add("fixed-bottom");
    videoContainer.style.maxWidth = `${wrapper.offsetWidth}px`;
    placeholder.style.height = `${videoHeight}px`;
  }
  // 일반 위치
  else {
    videoContainer.classList.remove("fixed");
    videoContainer.classList.remove("fixed-bottom");
    videoContainer.style.maxWidth = "";
    placeholder.style.height = "0";
  }
}

/**
 * 초기화: DOM 요소, 이벤트 리스너 세팅
 */
function initializeElements() {
  videoContainer = document.querySelector(".video-container");
  placeholder = document.querySelector(".placeholder");

  if (!videoContainer || !placeholder) {
    console.error("필수 요소 .video-container 또는 .placeholder를 찾을 수 없습니다.");
    return false;
  }

  // 스크롤 / 리사이즈 시 이벤트
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
 * YouTube Iframe API에서 호출하는 전역 함수
 * (반드시 전역 스코프에 있어야 함)
 */
function onYouTubeIframeAPIReady() {
  // 초기화
  if (!initializeElements()) return;

  // HTML의 script 태그에서 data-srt-url 정보를 가져오기
  const scriptTag = document.querySelector('script[src*="youtube-srt-player.js"]');
  if (!scriptTag) {
    console.error("youtube-srt-player.js를 로드하는 <script> 태그를 찾을 수 없습니다.");
    return;
  }
  const srtUrl = scriptTag.getAttribute("data-srt-url");
  if (!srtUrl) {
    console.warn("data-srt-url이 지정되지 않았습니다. 자막이 표시되지 않습니다.");
  }

  // SRT 자막 로드
  loadSubtitles(srtUrl).then(() => {
    // YouTube Player 생성
    player = new YT.Player("player", {
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
      },
    });
  });
}
