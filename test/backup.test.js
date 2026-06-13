import { describe, it, expect } from 'vitest';
import { buildExport, parseImport } from '../js/backup.js';

describe('backup', () => {
  it('meals/goals/settingsをまとめたエクスポートを作る', () => {
    const data = buildExport({
      meals: [{ id: 1, kcal: 400 }],
      goals: { kcal: 1800 },
      settings: { model: 'claude-sonnet-4-6', apiKey: 'secret' },
    });
    expect(data.version).toBe(1);
    expect(data.meals).toHaveLength(1);
    expect(data.settings.apiKey).toBeUndefined();   // APIキーはエクスポートしない
    expect(data.settings.model).toBe('claude-sonnet-4-6');
  });
  it('エクスポートしたJSON文字列を取り込める', () => {
    const json = JSON.stringify(buildExport({ meals: [{ id: 1, kcal: 400 }], goals: {}, settings: {} }));
    const r = parseImport(json);
    expect(r.meals[0].kcal).toBe(400);
  });
  it('versionが無い不正JSONは例外', () => {
    expect(() => parseImport('{"foo":1}')).toThrow(/version/);
  });
});
