import { describe, it, expect } from 'vitest';
import { validateNutrition } from '../js/schema.js';

const valid = {
  name: '幕の内弁当', kcal: 680, protein_g: 24, fat_g: 19, carb_g: 98,
  salt_g: 3.2, fiber_g: 4, confidence: 'high', items: ['白米', '焼き魚'],
  advice: '炭水化物多め。夜は主食を半分に。',
};

describe('validateNutrition', () => {
  it('正常な応答を正規化して返す', () => {
    const r = validateNutrition(valid);
    expect(r.name).toBe('幕の内弁当');
    expect(r.kcal).toBe(680);
    expect(r.items).toEqual(['白米', '焼き魚']);
  });
  it('数値が文字列でも数値に変換する', () => {
    const r = validateNutrition({ ...valid, kcal: '680' });
    expect(r.kcal).toBe(680);
  });
  it('必須数値が欠損なら例外', () => {
    const bad = { ...valid }; delete bad.kcal;
    expect(() => validateNutrition(bad)).toThrow(/kcal/);
  });
  it('confidenceが範囲外なら例外', () => {
    expect(() => validateNutrition({ ...valid, confidence: 'maybe' })).toThrow(/confidence/);
  });
  it('itemsが配列でなければ空配列に正規化', () => {
    const r = validateNutrition({ ...valid, items: undefined });
    expect(r.items).toEqual([]);
  });
  it('負の数値は例外', () => {
    expect(() => validateNutrition({ ...valid, fat_g: -1 })).toThrow(/fat_g/);
  });
});
