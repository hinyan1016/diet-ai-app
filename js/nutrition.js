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
