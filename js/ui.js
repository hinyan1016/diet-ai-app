import { renderHome } from './screens/home.js';
import { renderCapture } from './screens/capture.js';
import { renderHistory } from './screens/history.js';
import { renderTrends } from './screens/trends.js';
import { renderSettings } from './screens/settings.js';

export async function renderScreen(tab, goto) {
  const el = document.getElementById('screen');
  el.innerHTML = '';
  if (tab === 'home') return renderHome(el);
  if (tab === 'capture') return renderCapture(el, goto);
  if (tab === 'history') return renderHistory(el, goto);
  if (tab === 'trends') return renderTrends(el);
  if (tab === 'settings') return renderSettings(el);
  el.innerHTML = '<div class="card">不明な画面</div>';
  return undefined;
}

export function setActiveTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab && tab !== 'capture');
  });
}
