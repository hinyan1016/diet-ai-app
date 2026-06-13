import { NUTRIENT_KEYS, CONFIDENCE_LEVELS } from './constants.js';

/**
 * AI（Claude tool-use）応答の生オブジェクトを検証・正規化して返す。
 * - 必須数値フィールド（fiber_g を除く）が欠損 → Error（フィールド名を含む）
 * - fiber_g が欠損 → 0 に補完
 * - 数値フィールドが文字列 → Number() 変換
 * - 負の数値 → Error
 * - confidence が CONFIDENCE_LEVELS 外 → Error
 * - items が配列でない → [] に正規化
 * - name が空/非文字列 → '不明な食事'
 *
 * @param {unknown} obj - 未検証の AI 応答オブジェクト
 * @returns {{ name: string, advice: string, items: string[], confidence: string, kcal: number, protein_g: number, fat_g: number, carb_g: number, salt_g: number, fiber_g: number }}
 */
export function validateNutrition(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('応答がオブジェクトではありません');
  }

  const out = {};

  // 数値フィールドの検証・正規化
  for (const key of NUTRIENT_KEYS) {
    const raw = obj[key];

    if (raw === undefined || raw === null || raw === '') {
      // fiber_g のみ任意 → 0 補完
      if (key === 'fiber_g') {
        out[key] = 0;
        continue;
      }
      throw new Error(`必須フィールドが欠損: ${key}`);
    }

    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`数値ではありません: ${key}`);
    }
    if (n < 0) {
      throw new Error(`負の値は不正: ${key}`);
    }

    // 小数第1位まで丸め
    out[key] = Math.round(n * 10) / 10;
  }

  // テキストフィールドの正規化
  out.name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : '不明な食事';
  out.advice = typeof obj.advice === 'string' ? obj.advice : '';
  out.items = Array.isArray(obj.items) ? obj.items.map(String) : [];

  // confidence の検証
  if (!CONFIDENCE_LEVELS.includes(obj.confidence)) {
    throw new Error(`confidenceが不正: ${obj.confidence}`);
  }
  out.confidence = obj.confidence;

  return out;
}
