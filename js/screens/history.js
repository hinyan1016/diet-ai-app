import { getAllMeals, deleteMeal } from '../db.js';
import { localDateKey, aggregateTotals } from '../nutrition.js';

export async function renderHistory(el, goto) {
  const meals = await getAllMeals();
  if (!meals.length) { el.innerHTML = '<div class="card"><p class="muted">記録がありません。</p></div>'; return; }

  const byDate = new Map();
  for (const m of meals) {
    const k = localDateKey(m.datetime);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k).push(m);
  }
  const dates = [...byDate.keys()].sort().reverse();

  el.innerHTML = dates.map((d) => {
    const dayMeals = byDate.get(d);
    const t = aggregateTotals(dayMeals);
    const rows = dayMeals.map((m) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f0f0f0">
        <span>${m.name}</span>
        <span><span class="muted">${m.kcal}kcal</span>
        <button data-del="${m.id}" style="border:none;background:none;color:var(--p)">🗑</button></span>
      </div>`).join('');
    return `<div class="card"><h3 style="margin:0 0 6px">${d} <span class="muted">合計 ${t.kcal}kcal</span></h3>${rows}</div>`;
  }).join('');

  el.querySelectorAll('button[data-del]').forEach((b) => {
    b.onclick = async () => { await deleteMeal(Number(b.dataset.del)); goto('history'); };
  });
}
