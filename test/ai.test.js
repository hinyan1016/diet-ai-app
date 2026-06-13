import { describe, it, expect, vi } from 'vitest';
import { RECORD_NUTRITION_TOOL, buildAnalyzeRequest, parseToolResponse, analyzeImage } from '../js/ai.js';

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

const apiOk = {
  content: [
    { type: 'tool_use', name: 'record_nutrition', input: {
      name: 'サラダ', kcal: 120, protein_g: 5, fat_g: 8, carb_g: 6, salt_g: 0.8,
      fiber_g: 3, confidence: 'mid', items: ['レタス', 'トマト'], advice: '良い選択です。',
    } },
  ],
};

describe('parseToolResponse', () => {
  it('tool_useブロックを検証済み栄養に変換する', () => {
    const r = parseToolResponse(apiOk);
    expect(r.name).toBe('サラダ');
    expect(r.kcal).toBe(120);
  });
  it('tool_useが無ければ例外', () => {
    expect(() => parseToolResponse({ content: [{ type: 'text', text: 'x' }] }))
      .toThrow(/record_nutrition/);
  });
});

describe('analyzeImage', () => {
  it('成功時に検証済み栄養を返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => apiOk });
    const r = await analyzeImage(
      { imageBase64: 'A', mediaType: 'image/jpeg', mode: 'photo', model: 'claude-sonnet-4-6', apiKey: 'sk' },
      { fetchImpl: fetchMock },
    );
    expect(r.name).toBe('サラダ');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('HTTPエラー時はステータスを含む例外', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }),
    });
    await expect(analyzeImage(
      { imageBase64: 'A', mediaType: 'image/jpeg', mode: 'photo', apiKey: 'sk' },
      { fetchImpl: fetchMock },
    )).rejects.toThrow(/429/);
  });
});
