import { describe, it, expect } from 'vitest';
import { NUTRIENT_KEYS, DEFAULT_MODEL } from '../js/constants.js';

describe('constants', () => {
  it('栄養キーが6種ある', () => {
    expect(NUTRIENT_KEYS).toHaveLength(6);
    expect(NUTRIENT_KEYS).toContain('kcal');
  });
  it('既定モデルが設定されている', () => {
    expect(DEFAULT_MODEL).toBe('claude-sonnet-4-6');
  });
});
