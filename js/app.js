import { renderScreen, setActiveTab } from './ui.js';

function goto(tab) {
  setActiveTab(tab);
  renderScreen(tab, goto);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => goto(btn.dataset.tab));
});

goto('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
