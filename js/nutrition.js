import { NUTRIENT_KEYS } from './constants.js';

// 小数1桁で丸め（塩分等の小数を保持しつつ浮動小数誤差を排除）
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function aggregateTotals(meals) {
  const totals = {};
  for (const key of NUTRIENT_KEYS) {
    const sum = meals.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
    totals[key] = round1(sum);
  }
  return totals;
}

export function localDateKey(datetime) {
  const d = new Date(datetime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  // ローカル時刻でDate構築（UTCへの変換で日付がずれるのを防ぐ）
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const sy = dt.getFullYear();
  const sm = String(dt.getMonth() + 1).padStart(2, '0');
  const sd = String(dt.getDate()).padStart(2, '0');
  return `${sy}-${sm}-${sd}`;
}

export function summarizeWeek(meals, endDateKey, days = 7) {
  const byDate = new Map();
  for (const meal of meals) {
    const key = localDateKey(meal.datetime);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(meal);
  }
  const result = [];
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDateKey(endDateKey, -i);
    const dayMeals = byDate.get(dateKey) || [];
    result.push({ date: dateKey, ...aggregateTotals(dayMeals) });
  }
  const active = result.filter((d) => d.kcal > 0);
  const averages = {};
  for (const key of NUTRIENT_KEYS) {
    const sum = active.reduce((acc, d) => acc + d[key], 0);
    averages[key] = active.length ? round1(sum / active.length) : 0;
  }
  return { days: result, averages };
}

export function goalProgress(totals, goals) {
  const result = {};
  for (const key of Object.keys(goals)) {
    const goal = goals[key];
    if (typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) continue;
    const value = Number(totals[key]) || 0;
    result[key] = {
      value,
      goal,
      ratio: value / goal,
      remaining: round1(goal - value),
    };
  }
  return result;
}
