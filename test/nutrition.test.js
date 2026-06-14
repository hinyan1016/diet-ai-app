import { describe, it, expect } from 'vitest';
import { aggregateTotals, goalProgress, localDateKey, summarizeWeek } from '../js/nutrition.js';

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

describe('goalProgress', () => {
  it('合計と目標から比率と残量を返す', () => {
    const totals = { kcal: 1420, protein_g: 62, fat_g: 41, carb_g: 168, salt_g: 5 };
    const goals = { kcal: 1800, protein_g: 72, fat_g: 50, carb_g: 200, salt_g: 7 };
    const p = goalProgress(totals, goals);
    expect(p.kcal.value).toBe(1420);
    expect(p.kcal.goal).toBe(1800);
    expect(p.kcal.ratio).toBeCloseTo(0.789, 2);
    expect(p.kcal.remaining).toBe(380);
  });
  it('目標がnull/未設定のキーは結果に含めない', () => {
    const p = goalProgress({ kcal: 100 }, { kcal: 1800, weightTarget: null });
    expect(p.kcal).toBeDefined();
    expect(p.weightTarget).toBeUndefined();
  });
  it('超過時はremainingが負になりratioが1超', () => {
    const p = goalProgress({ kcal: 2000 }, { kcal: 1800 });
    expect(p.kcal.remaining).toBe(-200);
    expect(p.kcal.ratio).toBeGreaterThan(1);
  });
});

describe('localDateKey', () => {
  it('ISO datetimeからYYYY-MM-DD(ローカル)を返す', () => {
    expect(localDateKey('2026-06-14T09:30:00')).toBe('2026-06-14');
  });
});

describe('summarizeWeek', () => {
  const meals = [
    { datetime: '2026-06-14T08:00:00', kcal: 400, protein_g: 20, fat_g: 10, carb_g: 50, salt_g: 1, fiber_g: 2 },
    { datetime: '2026-06-14T12:00:00', kcal: 600, protein_g: 25, fat_g: 20, carb_g: 80, salt_g: 2, fiber_g: 3 },
    { datetime: '2026-06-13T19:00:00', kcal: 700, protein_g: 30, fat_g: 25, carb_g: 90, salt_g: 3, fiber_g: 4 },
  ];
  it('endDateから過去N日分の日別合計を新しい順で返す', () => {
    const s = summarizeWeek(meals, '2026-06-14', 7);
    expect(s.days).toHaveLength(7);
    expect(s.days[0].date).toBe('2026-06-14');
    expect(s.days[0].kcal).toBe(1000);
    expect(s.days[1].date).toBe('2026-06-13');
    expect(s.days[1].kcal).toBe(700);
    expect(s.days[6].date).toBe('2026-06-08');
    expect(s.days[6].kcal).toBe(0);
  });
  it('記録のある日だけで平均を出す', () => {
    const s = summarizeWeek(meals, '2026-06-14', 7);
    expect(s.averages.kcal).toBe(850); // (1000+700)/2
  });
});
