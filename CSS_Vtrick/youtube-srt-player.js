/**
 * YouTube SRT Player
 * ��Ʃ�� ����� SRT �ڸ��� ����ȭ�Ͽ� ǥ���ϴ� �÷��̾�
 * ��� �� ��ũ�ѿ� ���� ������ �����Ǵ� ��� ����
 */

/**
 * SRT ������ �Ľ��ϴ� �Լ�
 * @param {string} srtContent - SRT ������ �ؽ�Ʈ ����
 * @returns {Array<{index: number, startTime: number, endTime: number, text: string}>}
 */
const parseSRT = (srtContent) => {
    // �ٹٲ� ���� ����ȭ (\r\n, \r �� \n���� ����)
    const normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // �� ���� �������� �ڸ� �׸���� �и�
    const entries = normalizedContent.trim().split('\n\n');

    return entries.map(entry => {
        // �� �׸��� �� ������ �и�
        const lines = entry.trim().split('\n');
        if (lines.length < 3) return null;  // ��ȿ���� ���� �׸� ����

        // �ð� ���� �Ľ� (��: "00:00:01,000 --> 00:00:04,000")
        const timeCode = lines[1].trim();
        const [startTime, endTime] = timeCode.split(' --> ').map(timeStr => {
            const [time, ms] = timeStr.trim().split(',');
            const [hours, minutes, seconds] = time.split(':').map(Number);
            
            // ��� �ð��� �и��� ������ ��ȯ
            return (
                hours * 3600000 +    // �ð� �� �и���
                minutes * 60000 +    // �� �� �и���
                seconds * 1000 +     // �� �� �и���
                parseInt(ms)         // �и���
            );
        });

        // �ڸ� �ؽ�Ʈ ���� (���� ���� �� ����)
        const text = lines.slice(2).join('\n').trim();

        return {
            index: parseInt(lines[0], 10),
            startTime,
            endTime,
            text
        };
    }).filter(entry => entry !== null);  // null �׸� ����
};

// ���� ���� ����
let player;          // YouTube �÷��̾� �ν��Ͻ�
let subtitles = [];  // �Ľ̵� �ڸ� ������
let isPlaying = false; // ��� ����

/**
 * SRT �ڸ� ������ �ε��ϰ� �Ľ��ϴ� �Լ�
 * @returns {Promise<Array>} �Ľ̵� �ڸ� ������
 */
async function loadSubtitles() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/k2love/Script/refs/heads/main/1.%20n8n%20Beginner%20Course%20(1%209)%20-%20Introduction%20to%20Automation.srt');
        const srtContent = await response.text();
        return parseSRT(srtContent);
    } catch (error) {
        console.error('�ڸ��� �ҷ����µ� �����߽��ϴ�:', error);
    }
}

// YouTube IFrame API ��ũ��Ʈ �ε�
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);

/**
 * YouTube IFrame API �غ� �Ϸ� �� ȣ��Ǵ� �Լ�
 * �÷��̾� �ν��Ͻ� ����
 */
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

/**
 * �÷��̾� �غ� �Ϸ� �� ȣ��Ǵ� �Լ�
 * �ڸ� �ε� �� ������Ʈ Ÿ�̸� ����
 */
function onPlayerReady(event) {
    loadSubtitles().then(loadedSubtitles => {
        subtitles = loadedSubtitles;
        setInterval(updateSubtitle, 100);  // 100ms �������� �ڸ� ������Ʈ
    });
}

/**
 * �÷��̾� ���� ���� �� ȣ��Ǵ� �Լ�
 * @param {Object} event - YouTube �÷��̾� �̺�Ʈ ��ü
 */
function onPlayerStateChange(event) {
    isPlaying = (event.data === YT.PlayerState.PLAYING);
}

/**
 * ���� ��� �ð��� �´� �ڸ��� ȭ�鿡 ǥ���ϴ� �Լ�
 */
function updateSubtitle() {
    if (!player || !player.getCurrentTime) return;

    const time = player.getCurrentTime() * 1000;  // �ʸ� �и��ʷ� ��ȯ
    const currentSubtitle = subtitles.find(subtitle => 
        time >= subtitle.startTime && time <= subtitle.endTime
    );

    const subtitleText = document.getElementById('subtitle-text');
    if (currentSubtitle) {
        subtitleText.textContent = currentSubtitle.text;
    } else {
        subtitleText.textContent = '';
    }
}

/**
 * ��ũ�� �̺�Ʈ ó��
 * ��� ���� ���� ������ ȭ�� ��ܿ� ����
 */
window.addEventListener('scroll', function() {
    const videoContainer = document.querySelector('.video-container');
    const wrapper = document.querySelector('.sticky-wrapper');
    const rect = wrapper.getBoundingClientRect();
    
    // ��� ���̰� ��ũ���� ���� ��ġ�� �Ѿ�� ��
    if (rect.top <= 0 && isPlaying) {
        videoContainer.style.position = 'fixed';
        videoContainer.style.top = '0';
        videoContainer.style.width = wrapper.offsetWidth + 'px';
        wrapper.style.height = videoContainer.offsetHeight + 'px';
    } else {
        // �� ���� ��� �⺻ ��ġ��
        videoContainer.style.position = 'relative';
        videoContainer.style.top = 'auto';
        videoContainer.style.width = '100%';
        wrapper.style.height = 'auto';
    }
});