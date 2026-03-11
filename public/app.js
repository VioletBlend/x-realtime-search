const socket = new WebSocket(`ws://${location.host}`);
const input = document.getElementById("keyword");
const searchBtn = document.getElementById("search-btn");
let history = [];

/* ===== 検索送信 ===== */
function sendKeyword(keyword) {
  const fixed = keyword.trim().split(/\s+/).join(" OR ");

  socket.send(JSON.stringify({ type: "setKeyword", keyword: fixed }));

  // TLリセット
  document.getElementById("tweet-container").innerHTML = "";

  addHistory(keyword);
}

/* ===== 検索ボタン ===== */
searchBtn.onclick = () => {
  const keyword = input.value.trim();
  if (keyword) sendKeyword(keyword);
};

/* ===== Enter キー ===== */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const keyword = input.value.trim();
    if (keyword) sendKeyword(keyword);
  }
});

/* ===== WebSocket 受信 ===== */
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const tweet = data.data;
  if (!tweet) return;
  renderTweet(tweet);
};

/* ===== ツイート描画 ===== */
function renderTweet(tweet) {
  const container = document.getElementById("tweet-container");

  const div = document.createElement("div");
  div.className = "tweet";

  let mediaHTML = "";
  if (tweet.media) {
    mediaHTML = tweet.media
      .map(m => `<img src="${m.url || m.preview_image_url}" class="tweet-img">`)
      .join("");
  }

  div.innerHTML = `
    <div class="tweet-user">
      ${tweet.user?.profile_image_url ? `<img src="${tweet.user.profile_image_url}" class="icon">` : ""}
      <span>${escapeHTML(tweet.user?.name || "unknown")}</span>
      <span class="id">@${escapeHTML(tweet.user?.username || "")}</span>
    </div>

    <div class="tweet-text">${escapeHTML(tweet.text || "")}</div>

    ${mediaHTML}
  `;

  container.prepend(div);

  /* ★ 最新30件だけ保持 */
  while (container.children.length > 30) {
    container.removeChild(container.lastChild);
  }
}

/* ===== HTML エスケープ ===== */
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

/* ===== 履歴管理 ===== */
function addHistory(keyword) {
  if (!history.includes(keyword)) {
    history.unshift(keyword);
    if (history.length > 10) history.pop();
    renderHistory();
  }
}

function renderHistory() {
  const box = document.getElementById("history");
  box.innerHTML = history
    .map(k => `
      <div class="history-item">
        <span class="history-word">${escapeHTML(k)}</span>
        <span class="history-delete" data-word="${escapeHTML(k)}">×</span>
      </div>
    `)
    .join("");
}

/* ===== 履歴クリック ===== */
document.getElementById("history").addEventListener("click", (e) => {
  if (e.target.classList.contains("history-word")) {
    const keyword = e.target.textContent;
    input.value = keyword;
    sendKeyword(keyword);
  }

  if (e.target.classList.contains("history-delete")) {
    const word = e.target.dataset.word;
    history = history.filter(h => h !== word);
    renderHistory();
  }
});

/* ===== テーマ切り替え ===== */
document.getElementById("theme-icons").addEventListener("click", (e) => {
  if (e.target.classList.contains("theme-circle")) {
    const theme = e.target.dataset.theme;
    document.body.className = theme;
  }
});

/* ===== ランダムファイル名生成 ===== */
function randomName(length = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/* ===== TLを縦長画像として保存（完全版） ===== */
document.getElementById("save-long-image").onclick = () => {
  const target = document.getElementById("tweet-container");

  html2canvas(target, {
    backgroundColor: getComputedStyle(document.body).getPropertyValue("--bg") || "#000",
    scrollY: -window.scrollY,
    windowHeight: target.scrollHeight,
    height: target.scrollHeight,
    useCORS: true
  }).then(canvas => {
    const link = document.createElement("a");

    // ★ ランダムファイル名
    const filename = `timeline-${randomName(10)}.png`;

    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    link.click();
  });
};

/* ===== 900秒ごとにTLを完全リセット ===== */
setInterval(() => {
  document.getElementById("tweet-container").innerHTML = "";
}, 900000);
