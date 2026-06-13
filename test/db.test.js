import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, closeDB, addMeal, getMealsByDate, getMealsInRange, saveGoals, getGoals } from '../js/db.js';

beforeEach(async () => {
  closeDB();                       // モジュールキャッシュをリセット
  indexedDB = new IDBFactory();    // 各テストで新しいDBを使う
});

describe('db', () => {
  it('mealを追加してidが付与される', async () => {
    await openDB();
    const id = await addMeal({ datetime: '2026-06-14T08:00:00', kcal: 400, name: '朝食' });
    expect(id).toBeGreaterThan(0);
  });
  it('日付でmealを取得する', async () => {
    await openDB();
    await addMeal({ datetime: '2026-06-14T08:00:00', kcal: 400, name: 'a' });
    await addMeal({ datetime: '2026-06-14T12:00:00', kcal: 600, name: 'b' });
    await addMeal({ datetime: '2026-06-13T19:00:00', kcal: 700, name: 'c' });
    const meals = await getMealsByDate('2026-06-14');
    expect(meals).toHaveLength(2);
  });
  it('期間でmealを取得する', async () => {
    await openDB();
    await addMeal({ datetime: '2026-06-14T08:00:00', kcal: 400 });
    await addMeal({ datetime: '2026-06-08T08:00:00', kcal: 500 });
    await addMeal({ datetime: '2026-06-01T08:00:00', kcal: 600 });
    const meals = await getMealsInRange('2026-06-08', '2026-06-14');
    expect(meals).toHaveLength(2);
  });
  it('目標を保存・取得する', async () => {
    await openDB();
    await saveGoals({ kcal: 1800, protein_g: 72 });
    expect((await getGoals()).kcal).toBe(1800);
  });
});
