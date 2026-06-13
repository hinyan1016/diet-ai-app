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

// ISO datetime（UTCの 'Z' 付きでもローカル無印でも可）を「その瞬間のローカル暦日」
// YYYY-MM-DD に変換する。meal.datetime は toISOString() のUTC文字列だが、
// 端末ローカルの日付に正しく落とすのが狙い（例: 16:00Z は JST翌日として扱う）。
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

// endDateKey から過去 days 日分の日別合計を返す。
// days は新しい順（days[0]=endDateKey, 末尾=最古）。averages は kcal>0 の日のみで平均。
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

// 目標が設定されたキー(正の有限数)のみ {value, goal, ratio, remaining} を返す。
// totals に該当キーが無い場合は value=0 として扱う（記録ゼロと同義）。
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
