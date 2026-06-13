import { describe, it, expect } from 'vitest';
import { RECORD_NUTRITION_TOOL, buildAnalyzeRequest } from '../js/ai.js';

describe('RECORD_NUTRITION_TOOL', () => {
  it('record_nutritionツールが必須栄養キーを要求する', () => {
    expect(RECORD_NUTRITION_TOOL.name).toBe('record_nutrition');
    expect(RECORD_NUTRITION_TOOL.input_schema.required).toContain('kcal');
    expect(RECORD_NUTRITION_TOOL.input_schema.required).toContain('confidence');
  });
});

describe('buildAnalyzeRequest', () => {
  const base = { imageBase64: 'AAAA', mediaType: 'image/jpeg', model: 'claude-sonnet-4-6' };

  it('ブラウザ直接呼び出しヘッダとAPIキーを含む', () => {
    const req = buildAnalyzeRequest({ ...base, mode: 'photo', apiKey: 'sk-x' });
    expect(req.url).toBe('https://api.anthropic.com/v1/messages');
    expect(req.headers['x-api-key']).toBe('sk-x');
    expect(req.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(req.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('tool_choiceでrecord_nutritionを強制する', () => {
    const req = buildAnalyzeRequest({ ...base, mode: 'photo', apiKey: 'sk-x' });
    expect(req.body.tool_choice).toEqual({ type: 'tool', name: 'record_nutrition' });
    expect(req.body.tools[0].name).toBe('record_nutrition');
  });

  it('photoモードは推定、labelモードは記載値優先の指示になる', () => {
    const photo = buildAnalyzeRequest({ ...base, mode: 'photo', apiKey: 'sk-x' });
    const label = buildAnalyzeRequest({ ...base, mode: 'label', apiKey: 'sk-x' });
    const photoText = photo.body.messages[0].content.find((c) => c.type === 'text').text;
    const labelText = label.body.messages[0].content.find((c) => c.type === 'text').text;
    expect(photoText).toMatch(/推定/);
    expect(labelText).toMatch(/記載値/);
  });

  it('画像ブロックにbase64とメディアタイプを含む', () => {
    const req = buildAnalyzeRequest({ ...base, mode: 'photo', apiKey: 'sk-x' });
    const img = req.body.messages[0].content.find((c) => c.type === 'image');
    expect(img.source.data).toBe('AAAA');
    expect(img.source.media_type).toBe('image/jpeg');
  });
});
