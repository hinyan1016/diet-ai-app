import { getMealsByDate, getGoals } from '../db.js';
import { aggregateTotals, goalProgress, localDateKey } from '../nutrition.js';
import { DEFAULT_GOALS } from '../constants.js';

const LABELS = { protein_g: 'P', fat_g: 'F', carb_g: 'C' };

export async function renderHome(el) {
  const today = localDateKey(new Date().toISOString());
  const meals = await getMealsByDate(today);
  const totals = aggregateTotals(meals);
  const goals = (await getGoals()) || DEFAULT_GOALS;
  const prog = goalProgress(totals, goals);

  const kcal = prog.kcal || { value: totals.kcal, goal: goals.kcal || 0, ratio: 0 };
  const pct = Math.min(100, Math.round((kcal.ratio || 0) * 100));

  const macroRow = ['protein_g', 'fat_g', 'carb_g'].map((k) => {
    const v = totals[k]; const g = goals[k];
    return `<div style="text-align:center"><b>${LABELS[k]} ${v}g</b><div class="muted">目標${g ?? '-'}</div></div>`;
  }).join('');

  const mealList = meals.length
    ? meals.map((m) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f0f0f0">
        <span>${m.name}</span><span class="muted">${m.kcal}</span></div>`).join('')
    : '<p class="muted">まだ記録がありません。下の📷から始めましょう。</p>';

  el.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:28px;font-weight:bold;color:var(--primary)">${totals.kcal}<span style="font-size:14px">/${goals.kcal ?? '-'} kcal</span></div>
      <div class="bar ${kcal.ratio > 1 ? 'over' : ''}" style="margin-top:8px"><span style="width:${pct}%"></span></div>
    </div>
    <div class="card" style="display:flex;justify-content:space-around">${macroRow}</div>
    <div class="card"><h3 style="margin:0 0 8px">きょうの記録</h3>${mealList}</div>
  `;
}
