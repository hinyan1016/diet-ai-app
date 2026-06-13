// 各画面は後続タスクで差し替える
const placeholders = {
  home: '🏠 きょう（Task 12で実装）',
  history: '📅 履歴（Task 14で実装）',
  capture: '📷 撮る（Task 13で実装）',
  trends: '📈 傾向（Task 15で実装）',
  settings: '⚙️ 設定（Task 16で実装）',
};

export function renderScreen(tab) {
  const el = document.getElementById('screen');
  el.innerHTML = `<div class="card">${placeholders[tab] || '不明な画面'}</div>`;
}

export function setActiveTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab && tab !== 'capture');
  });
}
