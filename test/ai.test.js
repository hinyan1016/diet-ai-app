import { describe, it, expect, vi } from 'vitest';
import { RECORD_NUTRITION_TOOL, buildAnalyzeRequest, parseToolResponse, analyzeImage } from '../js/ai.js';

describe('RECORD_NUTRITION_TOOL', () => {
  it('record_nutritionツールが必須栄養キーを要求する', () => {
    expect(RECORD_NUTRITION_TOOL.name).toBe('record_nutrition');
    expect(RECORD_NUTRITION_TOOL.input_schema.required).toEqual(
      expect.arrayContaining(['name', 'kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g', 'confidence', 'advice']),
    );
    // fiber_g は任意なので required に含めない
    expect(RECORD_NUTRITION_TOOL.input_schema.required).not.toContain('fiber_g');
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
    // POSTメソッド・APIキーヘッダ・URLが正しく渡ること（回帰防止）
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.anthropic.com/v1/messages');
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers['x-api-key']).toBe('sk');
    expect(typeof calledOpts.body).toBe('string'); // JSON文字列化されている
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

import { buildTrendAdviceRequest } from '../js/ai.js';

describe('buildTrendAdviceRequest', () => {
  it('週次サマリと目標をテキストに含めtool不要のメッセージを作る', () => {
    const req = buildTrendAdviceRequest({
      summary: { days: [{ date: '2026-06-14', kcal: 1000 }], averages: { kcal: 1000 } },
      goals: { kcal: 1800 }, model: 'claude-sonnet-4-6', apiKey: 'sk',
    });
    const text = req.body.messages[0].content;
    expect(text).toContain('1800');
    expect(req.body.tools).toBeUndefined();
    expect(req.headers['x-api-key']).toBe('sk');
  });
});

import { buildDayAdviceRequest } from '../js/ai.js';

describe('buildDayAdviceRequest', () => {
  it('今日の合計と目標を含むtool不要メッセージを作る', () => {
    const req = buildDayAdviceRequest({
      totals: { kcal: 1200, protein_g: 50 }, goals: { kcal: 1800 },
      model: 'claude-sonnet-4-6', apiKey: 'sk',
    });
    const text = req.body.messages[0].content;
    expect(text).toContain('1800');
    expect(text).toContain('1200');
    expect(req.body.tools).toBeUndefined();
    expect(req.headers['x-api-key']).toBe('sk');
  });
});

import { buildGeminiAnalyzeRequest, parseGeminiNutrition } from '../js/ai.js';

describe('buildGeminiAnalyzeRequest', () => {
  it('Geminiエンドポイント・x-goog-api-key・inline_data・JSON強制を含む', () => {
    const req = buildGeminiAnalyzeRequest({ imageBase64: 'AAAA', mediaType: 'image/jpeg', mode: 'photo', model: 'gemini-3.5-flash', apiKey: 'gk' });
    expect(req.url).toContain('generativelanguage.googleapis.com');
    expect(req.url).toContain('gemini-3.5-flash:generateContent');
    expect(req.headers['x-goog-api-key']).toBe('gk');
    const parts = req.body.contents[0].parts;
    expect(parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'AAAA' });
    expect(req.body.generationConfig.responseMimeType).toBe('application/json');
  });
  it('labelモードは記載値優先の指示', () => {
    const req = buildGeminiAnalyzeRequest({ imageBase64: 'A', mediaType: 'image/png', mode: 'label', apiKey: 'gk' });
    const text = req.body.contents[0].parts[1].text;
    expect(text).toMatch(/記載値/);
  });
});

describe('parseGeminiNutrition', () => {
  const wrap = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
  const valid = { name: 'サラダ', kcal: 120, protein_g: 5, fat_g: 8, carb_g: 6, salt_g: 0.8, fiber_g: 3, confidence: 'mid', items: ['レタス'], advice: '良い選択です' };
  it('plainなJSONテキストを検証済み栄養にする', () => {
    expect(parseGeminiNutrition(wrap(JSON.stringify(valid))).name).toBe('サラダ');
  });
  it('```json フェンス付きでも解析できる', () => {
    expect(parseGeminiNutrition(wrap('```json\n' + JSON.stringify(valid) + '\n```')).kcal).toBe(120);
  });
  it('候補が無ければ例外', () => {
    expect(() => parseGeminiNutrition({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow();
  });
});

describe('analyzeImage (gemini)', () => {
  it('provider geminiでGeminiパスを通り検証済み栄養を返す', async () => {
    const payload = { name: '卵', kcal: 80, protein_g: 6, fat_g: 5, carb_g: 1, salt_g: 0.2, fiber_g: 0, confidence: 'high', items: ['卵'], advice: 'ok' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }) });
    const r = await analyzeImage({ provider: 'gemini', imageBase64: 'A', mediaType: 'image/jpeg', mode: 'photo', model: 'gemini-3.5-flash', apiKey: 'gk' }, { fetchImpl: fetchMock });
    expect(r.name).toBe('卵');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('generativelanguage');
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-goog-api-key']).toBe('gk');
  });
});
