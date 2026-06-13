import { renderScreen, setActiveTab } from './ui.js';

function goto(tab) {
  setActiveTab(tab);
  renderScreen(tab);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => goto(btn.dataset.tab));
});

// 起動時はホーム
goto('home');

// Service Worker 登録（Task 17で sw.js を作成後に有効化）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
