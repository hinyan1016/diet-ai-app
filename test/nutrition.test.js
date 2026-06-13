import { describe, it, expect } from 'vitest';
import { aggregateTotals } from '../js/nutrition.js';

describe('aggregateTotals', () => {
  it('複数mealの栄養を合計し四捨五入する', () => {
    const meals = [
      { kcal: 420, protein_g: 20, fat_g: 14, carb_g: 50, salt_g: 1.2, fiber_g: 3 },
      { kcal: 680.4, protein_g: 24, fat_g: 19, carb_g: 98, salt_g: 3.2, fiber_g: 4 },
    ];
    expect(aggregateTotals(meals)).toEqual({
      kcal: 1100.4, protein_g: 44, fat_g: 33, carb_g: 148, salt_g: 4.4, fiber_g: 7,
    });
  });
  it('空配列なら全て0', () => {
    expect(aggregateTotals([]).kcal).toBe(0);
  });
  it('欠損フィールドは0として扱う', () => {
    expect(aggregateTotals([{ kcal: 100 }]).protein_g).toBe(0);
  });
});
