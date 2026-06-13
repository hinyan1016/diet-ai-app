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
