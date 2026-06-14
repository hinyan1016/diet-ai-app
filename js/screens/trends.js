import { getMealsInRange, getGoals, getSettings } from '../db.js';
import { summarizeWeek, localDateKey, shiftDateKey } from '../nutrition.js';
import { getTrendAdvice } from '../ai.js';
import { DEFAULT_GOALS, DEFAULT_MODEL } from '../constants.js';

function barChart(days, goalKcal) {
  const max = Math.max(goalKcal || 0, ...days.map((d) => d.kcal), 1);
  const reversed = [...days].reverse();
  const bw = 100 / reversed.length;
  const bars = reversed.map((d, i) => {
    const h = (d.kcal / max) * 90;
    const over = goalKcal && d.kcal > goalKcal;
    return `<rect x="${i * bw + 1}" y="${100 - h}" width="${bw - 2}" height="${h}"
      fill="${over ? 'var(--p)' : 'var(--primary)'}"></rect>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:120px">${bars}</svg>`;
}

export async function renderTrends(el) {
  const today = localDateKey(new Date().toISOString());
  const meals = await getMealsInRange(shiftDateKey(today, -6), today);
  const summary = summarizeWeek(meals, today, 7);
  const goals = (await getGoals()) || DEFAULT_GOALS;

  el.innerHTML = `
    <div class="card"><h3 style="margin:0 0 8px">直近7日のカロリー</h3>
      ${barChart(summary.days, goals.kcal)}
      <p class="muted">平均 ${summary.averages.kcal} kcal/日</p></div>
    <div class="card"><h3 style="margin:0 0 8px">今週の傾向</h3>
      <div id="advice" class="advice">「助言を生成」を押すとAIが傾向をまとめます。</div>
      <button class="btn" id="gen" style="margin-top:8px">助言を生成</button></div>`;

  el.querySelector('#gen').onclick = async () => {
    const settings = (await getSettings()) || {};
    const box = el.querySelector('#advice');
    if (!settings.apiKey) { box.textContent = 'APIキーを設定してください。'; return; }
    box.textContent = '生成中…';
    try {
      box.textContent = await getTrendAdvice({
        summary, goals, provider: settings.provider || 'claude', model: settings.model || DEFAULT_MODEL, apiKey: settings.apiKey,
      });
    } catch (e) { box.textContent = `エラー: ${e.message}`; }
  };
}
