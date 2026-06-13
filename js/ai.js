import { validateNutrition } from './schema.js';
import { DEFAULT_MODEL } from './constants.js';

const API_URL = 'https://api.anthropic.com/v1/messages';

export const RECORD_NUTRITION_TOOL = {
  name: 'record_nutrition',
  description: '食事1食分の推定栄養価と行動提案を記録する',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '料理名（推定の場合は「（推定）」を付ける）' },
      kcal: { type: 'number', description: '推定カロリー(kcal)' },
      protein_g: { type: 'number', description: 'たんぱく質(g)' },
      fat_g: { type: 'number', description: '脂質(g)' },
      carb_g: { type: 'number', description: '炭水化物(g)' },
      salt_g: { type: 'number', description: '食塩相当量(g)' },
      fiber_g: { type: 'number', description: '食物繊維(g)' },
      confidence: { type: 'string', enum: ['high', 'mid', 'low'], description: '推定の確信度' },
      items: { type: 'array', items: { type: 'string' }, description: '含まれる主な品目' },
      advice: { type: 'string', description: 'この一食に対する短い行動提案(日本語・100字以内)' },
    },
    required: ['name', 'kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g', 'confidence', 'advice'],
  },
};

const PROMPT_PHOTO =
  'これは食事の写真です。見た目から品目と量を推定し、1食分の栄養価を概算してください。' +
  '推定なので確信度(confidence)も返してください。record_nutritionツールで結果を返してください。';

const PROMPT_LABEL =
  'これは食品の栄養成分表示ラベルの写真です。記載されている数値を正確に読み取り転記してください。' +
  '推定ではなく記載値を優先します。1包装/1食分の値を返してください。' +
  'record_nutritionツールで結果を返してください。';

export function buildAnalyzeRequest({ imageBase64, mediaType, mode, model, apiKey }) {
  const text = mode === 'label' ? PROMPT_LABEL : PROMPT_PHOTO;
  return {
    url: API_URL,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: {
      model: model || DEFAULT_MODEL,
      max_tokens: 1024,
      tools: [RECORD_NUTRITION_TOOL],
      tool_choice: { type: 'tool', name: 'record_nutrition' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text },
          ],
        },
      ],
    },
  };
}

export function parseToolResponse(apiJson) {
  const blocks = (apiJson && apiJson.content) || [];
  const tool = blocks.find((b) => b.type === 'tool_use' && b.name === 'record_nutrition');
  if (!tool) throw new Error('応答にrecord_nutritionツール呼び出しがありません');
  return validateNutrition(tool.input);
}

export async function analyzeImage(params, { fetchImpl = fetch } = {}) {
  const req = buildAnalyzeRequest(params);
  const res = await fetchImpl(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || '';
    } catch { /* ignore */ }
    throw new Error(`API エラー ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return parseToolResponse(json);
}

export function buildTrendAdviceRequest({ summary, goals, model, apiKey }) {
  const text =
    '以下は直近の食事記録の日別合計と平均、目標値です。医療助言ではなく、' +
    '生活の中で実行しやすい栄養バランスの傾向と、明日からの行動提案を3点以内・日本語で簡潔に述べてください。\n\n' +
    `目標: ${JSON.stringify(goals)}\n` +
    `日別: ${JSON.stringify(summary.days)}\n` +
    `平均: ${JSON.stringify(summary.averages)}`;
  return {
    url: API_URL,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: {
      model: model || DEFAULT_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: text }],
    },
  };
}

export async function getTrendAdvice(params, { fetchImpl = fetch } = {}) {
  const req = buildTrendAdviceRequest(params);
  const res = await fetchImpl(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
  if (!res.ok) throw new Error(`API エラー ${res.status}`);
  const json = await res.json();
  const block = (json.content || []).find((b) => b.type === 'text');
  return block ? block.text : '';
}
