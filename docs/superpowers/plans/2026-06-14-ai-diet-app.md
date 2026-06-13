# AIダイエットアプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 食事写真／栄養成分ラベルをClaude APIで分析し、栄養概算・行動提案・記録・履歴・目標進捗・週次トレンド助言を行う個人用スマホPWAを、ビルドなしのバニラJS（ESモジュール）で実装する。

**Architecture:** 構成A（サーバーなし）。スマホPWAがブラウザから直接Claude API（Vision + Tool Use）を呼び、APIキーは端末のlocalStorage、食事データは端末のIndexedDBに保存する。テスト可能な純粋ロジック（栄養集計・スキーマ検証・リクエスト生成・DB）を先にTDDで固め、その上にUIを載せる。

**Tech Stack:** バニラJavaScript（ネイティブESモジュール・ビルドなし）/ IndexedDB / Claude API（`claude-sonnet-4-6` 既定）/ PWA（manifest + Service Worker）/ テストは Vitest + jsdom + fake-indexeddb。

---

## 共通データ形状（全タスクで一貫させる）

```js
// 栄養の数値キー（この順・この名前で統一）
export const NUTRIENT_KEYS = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g', 'fiber_g'];

// meal レコード
// { id, datetime(ISO文字列), mode('photo'|'label'), imageThumb(dataURL),
//   name, kcal, protein_g, fat_g, carb_g, salt_g, fiber_g,
//   confidence('high'|'mid'|'low'), items(string[]), advice, userEdited(bool) }

// goals レコード(単一)
// { kcal, protein_g, fat_g, carb_g, salt_g, weightTarget }

// settings レコード(単一)
// { apiKey, model, adviceTone }
```

## ファイル構成

```
diet-ai-app/
  package.json              devDependency: vitest, jsdom, fake-indexeddb
  vitest.config.js
  index.html                画面骨組み＋下タブ
  css/styles.css
  js/
    constants.js            NUTRIENT_KEYS・既定値・モデルID
    nutrition.js            集計・目標進捗・週次トレンド（純粋関数）
    schema.js               AI応答スキーマ検証（純粋関数）
    ai.js                   Claude APIリクエスト生成・呼び出し・応答パース
    camera.js               撮影・サムネ縮小（fitDimensionsは純粋関数）
    db.js                   IndexedDBラッパ
    backup.js               JSON書き出し/取り込み（純粋関数）
    ui.js                   画面描画・タブ切替
    app.js                  起点（DOM配線）
  test/
    nutrition.test.js
    schema.test.js
    ai.test.js
    camera.test.js
    db.test.js
    backup.test.js
  manifest.json
  sw.js
  icons/                    icon-192.png / icon-512.png
  README.md
```

---

### Task 1: プロジェクト雛形とテスト基盤

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `js/constants.js`
- Create: `test/smoke.test.js`

- [ ] **Step 1: package.json を作成**

```json
{
  "name": "diet-ai-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0",
    "fake-indexeddb": "^6.0.0"
  }
}
```

- [ ] **Step 2: vitest.config.js を作成**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
```

- [ ] **Step 3: constants.js を作成**

```js
export const NUTRIENT_KEYS = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g', 'fiber_g'];

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const AVAILABLE_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8'];

export const DEFAULT_GOALS = {
  kcal: 1800, protein_g: 72, fat_g: 50, carb_g: 200, salt_g: 7, weightTarget: null,
};

export const CONFIDENCE_LEVELS = ['high', 'mid', 'low'];
export const MODES = ['photo', 'label'];
```

- [ ] **Step 4: スモークテストを作成**

```js
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
```

- [ ] **Step 5: 依存をインストールしてテスト実行**

Run: `cd diet-ai-app && npm install && npm test`
Expected: PASS（2 tests）

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.js js/constants.js test/smoke.test.js package-lock.json
git commit -m "chore: プロジェクト雛形とVitestテスト基盤を追加"
```

---

### Task 2: nutrition.js — 1日の合計集計

**Files:**
- Create: `js/nutrition.js`
- Test: `test/nutrition.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
import { describe, it, expect } from 'vitest';
import { aggregateTotals } from '../js/nutrition.js';

describe('aggregateTotals', () => {
  it('複数mealの栄養を合計し四捨五入する', () => {
    const meals = [
      { kcal: 420, protein_g: 20, fat_g: 14, carb_g: 50, salt_g: 1.2, fiber_g: 3 },
      { kcal: 680.4, protein_g: 24, fat_g: 19, carb_g: 98, salt_g: 3.2, fiber_g: 4 },
    ];
    expect(aggregateTotals(meals)).toEqual({
      kcal: 1100, protein_g: 44, fat_g: 33, carb_g: 148, salt_g: 4.4, fiber_g: 7,
    });
  });
  it('空配列なら全て0', () => {
    expect(aggregateTotals([]).kcal).toBe(0);
  });
  it('欠損フィールドは0として扱う', () => {
    expect(aggregateTotals([{ kcal: 100 }]).protein_g).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- nutrition`
Expected: FAIL（aggregateTotals is not defined）

- [ ] **Step 3: 最小実装**

```js
import { NUTRIENT_KEYS } from './constants.js';

// 小数1桁で丸め（塩分等の小数を保持しつつ浮動小数誤差を排除）
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function aggregateTotals(meals) {
  const totals = {};
  for (const key of NUTRIENT_KEYS) {
    const sum = meals.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
    totals[key] = round1(sum);
  }
  return totals;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- nutrition`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/nutrition.js test/nutrition.test.js
git commit -m "feat: 1日の栄養合計集計(aggregateTotals)を追加"
```

---

### Task 3: nutrition.js — 目標進捗

**Files:**
- Modify: `js/nutrition.js`
- Test: `test/nutrition.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記**

```js
import { goalProgress } from '../js/nutrition.js';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- nutrition`
Expected: FAIL（goalProgress is not defined）

- [ ] **Step 3: 最小実装（nutrition.jsに追記）**

```js
export function goalProgress(totals, goals) {
  const result = {};
  for (const key of Object.keys(goals)) {
    const goal = goals[key];
    if (typeof goal !== 'number' || !Number.isFinite(goal) || goal <= 0) continue;
    const value = Number(totals[key]) || 0;
    result[key] = {
      value,
      goal,
      ratio: value / goal,
      remaining: round1(goal - value),
    };
  }
  return result;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- nutrition`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/nutrition.js test/nutrition.test.js
git commit -m "feat: 目標進捗(goalProgress)を追加"
```

---

### Task 4: nutrition.js — 日付グループ化と週次サマリ

**Files:**
- Modify: `js/nutrition.js`
- Test: `test/nutrition.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記**

```js
import { localDateKey, summarizeWeek } from '../js/nutrition.js';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- nutrition`
Expected: FAIL（localDateKey / summarizeWeek is not defined）

- [ ] **Step 3: 最小実装（nutrition.jsに追記）**

```js
export function localDateKey(datetime) {
  const d = new Date(datetime);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localDateKey(dt.toISOString());
}

export function summarizeWeek(meals, endDateKey, days = 7) {
  // 日付ごとにmealsをまとめる
  const byDate = new Map();
  for (const meal of meals) {
    const key = localDateKey(meal.datetime);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(meal);
  }
  const result = [];
  for (let i = 0; i < days; i++) {
    const dateKey = shiftDateKey(endDateKey, -i);
    const dayMeals = byDate.get(dateKey) || [];
    result.push({ date: dateKey, ...aggregateTotals(dayMeals) });
  }
  // 記録のある日(kcal>0)のみで平均
  const active = result.filter((d) => d.kcal > 0);
  const averages = {};
  for (const key of NUTRIENT_KEYS) {
    const sum = active.reduce((acc, d) => acc + d[key], 0);
    averages[key] = active.length ? round1(sum / active.length) : 0;
  }
  return { days: result, averages };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- nutrition`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/nutrition.js test/nutrition.test.js
git commit -m "feat: 日付グループ化と週次サマリ(summarizeWeek)を追加"
```

---

### Task 5: schema.js — AI応答スキーマ検証

**Files:**
- Create: `js/schema.js`
- Test: `test/schema.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- schema`
Expected: FAIL（validateNutrition is not defined）

- [ ] **Step 3: 最小実装**

```js
import { NUTRIENT_KEYS, CONFIDENCE_LEVELS } from './constants.js';

export function validateNutrition(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('応答がオブジェクトではありません');
  }
  const out = {};

  // 数値フィールド（fiber_gは任意で0補完、それ以外は必須）
  for (const key of NUTRIENT_KEYS) {
    const raw = obj[key];
    if (raw === undefined || raw === null || raw === '') {
      if (key === 'fiber_g') { out[key] = 0; continue; }
      throw new Error(`必須フィールドが欠損: ${key}`);
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`数値ではありません: ${key}`);
    if (n < 0) throw new Error(`負の値は不正: ${key}`);
    out[key] = Math.round(n * 10) / 10;
  }

  out.name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : '不明な食事';
  out.advice = typeof obj.advice === 'string' ? obj.advice : '';
  out.items = Array.isArray(obj.items) ? obj.items.map(String) : [];

  if (!CONFIDENCE_LEVELS.includes(obj.confidence)) {
    throw new Error(`confidenceが不正: ${obj.confidence}`);
  }
  out.confidence = obj.confidence;

  return out;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/schema.js test/schema.test.js
git commit -m "feat: AI応答スキーマ検証(validateNutrition)を追加"
```

---

### Task 6: ai.js — リクエスト生成（純粋関数）

**Files:**
- Create: `js/ai.js`
- Test: `test/ai.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- ai`
Expected: FAIL（buildAnalyzeRequest is not defined）

- [ ] **Step 3: 最小実装**

```js
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- ai`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/ai.js test/ai.test.js
git commit -m "feat: Claude APIリクエスト生成とrecord_nutritionツール定義を追加"
```

---

### Task 7: ai.js — 応答パースと呼び出し（fetchモック）

**Files:**
- Modify: `js/ai.js`
- Test: `test/ai.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記**

```js
import { vi } from 'vitest';
import { parseToolResponse, analyzeImage } from '../js/ai.js';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- ai`
Expected: FAIL（parseToolResponse / analyzeImage is not defined）

- [ ] **Step 3: 最小実装（ai.jsに追記）**

```js
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- ai`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/ai.js test/ai.test.js
git commit -m "feat: AI応答パースとanalyzeImage(fetch注入)を追加"
```

---

### Task 8: camera.js — サムネ寸法計算（純粋関数）

**Files:**
- Create: `js/camera.js`
- Test: `test/camera.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
import { describe, it, expect } from 'vitest';
import { fitDimensions } from '../js/camera.js';

describe('fitDimensions', () => {
  it('長辺をmaxに縮小し比率を保つ', () => {
    expect(fitDimensions(4000, 3000, 1024)).toEqual({ w: 1024, h: 768 });
  });
  it('縦長も正しく縮小', () => {
    expect(fitDimensions(3000, 4000, 1024)).toEqual({ w: 768, h: 1024 });
  });
  it('max以下なら拡大しない', () => {
    expect(fitDimensions(800, 600, 1024)).toEqual({ w: 800, h: 600 });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- camera`
Expected: FAIL（fitDimensions is not defined）

- [ ] **Step 3: 最小実装（純粋関数＋ブラウザ用縮小関数）**

```js
// 純粋関数：縮小後の寸法を計算（拡大はしない）
export function fitDimensions(w, h, max) {
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const scale = max / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// ブラウザ専用：File/Blob を縮小したJPEG dataURL に変換（テスト対象外・手動確認）
export async function resizeToThumbDataUrl(fileOrBlob, max = 1024, quality = 0.8) {
  const bitmap = await createImageBitmap(fileOrBlob);
  const { w, h } = fitDimensions(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

// dataURL("data:image/jpeg;base64,XXXX") から {mediaType, base64} を取り出す
export function splitDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('dataURL形式が不正です');
  return { mediaType: match[1], base64: match[2] };
}
```

- [ ] **Step 4: テストが失敗→通ることを確認（splitDataUrlのテストも追記）**

`test/camera.test.js` に追記:

```js
import { splitDataUrl } from '../js/camera.js';

describe('splitDataUrl', () => {
  it('mediaTypeとbase64を分離する', () => {
    expect(splitDataUrl('data:image/jpeg;base64,AAAA')).toEqual({ mediaType: 'image/jpeg', base64: 'AAAA' });
  });
  it('不正形式は例外', () => {
    expect(() => splitDataUrl('notadataurl')).toThrow();
  });
});
```

Run: `npm test -- camera`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/camera.js test/camera.test.js
git commit -m "feat: サムネ寸法計算とdataURL分離(camera.js)を追加"
```

---

### Task 9: db.js — IndexedDBラッパ

**Files:**
- Create: `js/db.js`
- Test: `test/db.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB, addMeal, getMealsByDate, getMealsInRange, saveGoals, getGoals } from '../js/db.js';

beforeEach(async () => {
  // 各テストで新しいDB名を使うため、グローバルを初期化
  indexedDB = new IDBFactory();
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
```

- [ ] **Step 2: fake-indexeddb を devDependency に追加（Task1で導入済みなら確認のみ）してテストが失敗することを確認**

Run: `npm test -- db`
Expected: FAIL（openDB is not defined）

- [ ] **Step 3: 最小実装**

```js
import { localDateKey } from './nutrition.js';

const DB_NAME = 'diet-ai-app';
const DB_VERSION = 1;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('meals')) {
        const store = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        store.createIndex('datetime', 'datetime');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'date' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return _db.transaction(store, mode).objectStore(store);
}
function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addMeal(meal) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').add(meal));
}
export async function updateMeal(meal) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').put(meal));
}
export async function deleteMeal(id) {
  await openDB();
  return asPromise(tx('meals', 'readwrite').delete(id));
}
export async function getAllMeals() {
  await openDB();
  return asPromise(tx('meals', 'readonly').getAll());
}
export async function getMealsByDate(dateKey) {
  const all = await getAllMeals();
  return all.filter((m) => localDateKey(m.datetime) === dateKey);
}
export async function getMealsInRange(startKey, endKey) {
  const all = await getAllMeals();
  return all.filter((m) => {
    const k = localDateKey(m.datetime);
    return k >= startKey && k <= endKey;
  });
}

async function kvGet(key) {
  await openDB();
  const r = await asPromise(tx('kv', 'readonly').get(key));
  return r ? r.value : null;
}
async function kvSet(key, value) {
  await openDB();
  return asPromise(tx('kv', 'readwrite').put({ key, value }));
}
export const getGoals = () => kvGet('goals');
export const saveGoals = (g) => kvSet('goals', g);
export const getSettings = () => kvGet('settings');
export const saveSettings = (s) => kvSet('settings', s);

export async function addWeight(date, kg) {
  await openDB();
  return asPromise(tx('weights', 'readwrite').put({ date, kg }));
}
export async function getAllWeights() {
  await openDB();
  return asPromise(tx('weights', 'readonly').getAll());
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- db`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/db.js test/db.test.js
git commit -m "feat: IndexedDBラッパ(db.js)を追加"
```

---

### Task 10: backup.js — JSON書き出し/取り込み

**Files:**
- Create: `js/backup.js`
- Test: `test/backup.test.js`

- [ ] **Step 1: 失敗するテストを書く**

```js
import { describe, it, expect } from 'vitest';
import { buildExport, parseImport } from '../js/backup.js';

describe('backup', () => {
  it('meals/goals/settingsをまとめたエクスポートを作る', () => {
    const data = buildExport({
      meals: [{ id: 1, kcal: 400 }],
      goals: { kcal: 1800 },
      settings: { model: 'claude-sonnet-4-6' },
    });
    expect(data.version).toBe(1);
    expect(data.meals).toHaveLength(1);
    // APIキーはエクスポートしない
    expect(data.settings.apiKey).toBeUndefined();
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- backup`
Expected: FAIL（buildExport is not defined）

- [ ] **Step 3: 最小実装**

```js
export function buildExport({ meals, goals, settings }) {
  const safeSettings = { ...(settings || {}) };
  delete safeSettings.apiKey; // 秘密情報はバックアップに含めない
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    meals: meals || [],
    goals: goals || {},
    settings: safeSettings,
  };
}

export function parseImport(jsonString) {
  let obj;
  try {
    obj = JSON.parse(jsonString);
  } catch {
    throw new Error('JSONの解析に失敗しました');
  }
  if (!obj || obj.version !== 1) {
    throw new Error('対応していないバックアップ形式です（versionが不正）');
  }
  return {
    meals: Array.isArray(obj.meals) ? obj.meals : [],
    goals: obj.goals || {},
    settings: obj.settings || {},
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- backup`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/backup.js test/backup.test.js
git commit -m "feat: JSONバックアップの書き出し/取り込み(backup.js)を追加"
```

---

### Task 11: index.html・CSS・タブ骨組み

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/ui.js`
- Create: `js/app.js`

- [ ] **Step 1: index.html を作成**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#2E7D5B">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="manifest.json">
<link rel="stylesheet" href="css/styles.css">
<title>AIダイエット記録</title>
</head>
<body>
  <main id="screen"><!-- 画面はui.jsが描画 --></main>
  <nav id="tabbar">
    <button data-tab="home" class="tab active">🏠<span>きょう</span></button>
    <button data-tab="history" class="tab">📅<span>履歴</span></button>
    <button data-tab="capture" class="tab capture">📷</button>
    <button data-tab="trends" class="tab">📈<span>傾向</span></button>
    <button data-tab="settings" class="tab">⚙️<span>設定</span></button>
  </nav>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/styles.css を作成**

```css
:root { --primary:#2E7D5B; --primary-dark:#1f5a41; --bg:#f6f7f6; --card:#fff;
  --p:#C0392B; --f:#E08E0B; --c:#2980B9; --text:#222; --muted:#888; }
* { box-sizing:border-box; }
body { margin:0; font-family:system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;
  background:var(--bg); color:var(--text); padding-bottom:72px; }
#screen { max-width:480px; margin:0 auto; padding:16px; }
.card { background:var(--card); border-radius:12px; padding:16px; margin-bottom:12px;
  box-shadow:0 1px 4px rgba(0,0,0,.06); }
.bar { height:8px; background:#eee; border-radius:4px; overflow:hidden; }
.bar > span { display:block; height:100%; background:var(--primary); }
.bar.over > span { background:var(--p); }
button { font:inherit; cursor:pointer; }
.btn { background:var(--primary); color:#fff; border:none; border-radius:8px; padding:12px 16px; width:100%; }
.btn.secondary { background:#eee; color:var(--text); }
.muted { color:var(--muted); font-size:13px; }
.advice { background:#FFF4E5; border-left:3px solid var(--f); padding:10px; border-radius:6px; font-size:14px; }
.badge-low { background:#fde8e8; color:var(--p); font-size:11px; padding:2px 6px; border-radius:4px; }
#tabbar { position:fixed; bottom:0; left:0; right:0; display:flex; justify-content:space-around;
  background:#fff; border-top:1px solid #eee; max-width:480px; margin:0 auto; }
.tab { background:none; border:none; flex:1; padding:8px 0; font-size:20px; color:var(--muted);
  display:flex; flex-direction:column; align-items:center; gap:2px; }
.tab span { font-size:10px; }
.tab.active { color:var(--primary); }
.tab.capture { color:#fff; background:var(--primary); border-radius:50%; width:48px; height:48px;
  flex:0 0 auto; align-self:center; margin-top:-16px; font-size:22px; }
```

- [ ] **Step 3: js/ui.js にタブ描画の骨組みを作成**

```js
// 各画面は { mount(el) } を持つオブジェクトとして後続タスクで差し替える
const placeholders = {
  home: '🏠 きょう（Task 12で実装）',
  history: '📅 履歴（Task 14で実装）',
  capture: '📷 撮る（Task 13で実装）',
  trends: '📈 傾向（Task 15で実装）',
  settings: '⚙️ 設定（Task 16で実装）',
};

export function renderScreen(tab) {
  const el = document.getElementById('screen');
  el.innerHTML = `<div class="card">${placeholders[tab] || '不明な画面'}</div>`;
}

export function setActiveTab(tab) {
  document.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab && tab !== 'capture');
  });
}
```

- [ ] **Step 4: js/app.js でタブ配線**

```js
import { renderScreen, setActiveTab } from './ui.js';

function goto(tab) {
  setActiveTab(tab);
  renderScreen(tab);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => goto(btn.dataset.tab));
});

// 起動時はホーム
goto('home');

// Service Worker 登録（Task 17で sw.js を作成後に有効化）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
```

- [ ] **Step 5: 手動確認**

`cd diet-ai-app && python -m http.server 8000` で起動し、`http://localhost:8000` をブラウザで開く。下タブを押すと画面のプレースホルダが切り替わることを確認。

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/ui.js js/app.js
git commit -m "feat: 画面骨組み・CSS・下タブナビを追加"
```

---

### Task 12: ホーム画面（きょうの合計・進捗・食事リスト）

**Files:**
- Create: `js/screens/home.js`
- Modify: `js/ui.js`（home画面の差し替え）

- [ ] **Step 1: js/screens/home.js を作成**

```js
import { getMealsByDate, getGoals } from '../db.js';
import { aggregateTotals, goalProgress, localDateKey } from '../nutrition.js';
import { DEFAULT_GOALS, NUTRIENT_KEYS } from '../constants.js';

const LABELS = { kcal:'kcal', protein_g:'P', fat_g:'F', carb_g:'C', salt_g:'塩分', fiber_g:'食物繊維' };

export async function renderHome(el) {
  const today = localDateKey(new Date().toISOString());
  const meals = await getMealsByDate(today);
  const totals = aggregateTotals(meals);
  const goals = (await getGoals()) || DEFAULT_GOALS;
  const prog = goalProgress(totals, goals);

  const kcal = prog.kcal || { value: totals.kcal, goal: goals.kcal || 0, ratio: 0 };
  const pct = Math.min(100, Math.round((kcal.ratio || 0) * 100));

  const macroRow = ['protein_g','fat_g','carb_g'].map((k) => {
    const v = totals[k]; const g = goals[k];
    return `<div style="text-align:center"><b>${LABELS[k]} ${v}g</b><div class="muted">目標${g ?? '-'}</div></div>`;
  }).join('');

  const mealList = meals.length
    ? meals.map((m) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f0f0f0">
        <span>${m.name}</span><span class="muted">${m.kcal}</span></div>`).join('')
    : '<p class="muted">まだ記録がありません。下の📷から始めましょう。</p>';

  el.innerHTML = `
    <div class="card" style="text-align:center">
      <div style="font-size:28px;font-weight:bold;color:var(--primary)">${totals.kcal}<span style="font-size:14px">/${goals.kcal ?? '-'} kcal</span></div>
      <div class="bar ${kcal.ratio>1?'over':''}" style="margin-top:8px"><span style="width:${pct}%"></span></div>
    </div>
    <div class="card" style="display:flex;justify-content:space-around">${macroRow}</div>
    <div class="card"><h3 style="margin:0 0 8px">きょうの記録</h3>${mealList}</div>
  `;
}
```

- [ ] **Step 2: ui.js を home画面対応に修正**

`js/ui.js` の `renderScreen` を非同期化し home を差し替え:

```js
import { renderHome } from './screens/home.js';

const placeholders = {
  history: '📅 履歴（Task 14で実装）',
  capture: '📷 撮る（Task 13で実装）',
  trends: '📈 傾向（Task 15で実装）',
  settings: '⚙️ 設定（Task 16で実装）',
};

export async function renderScreen(tab) {
  const el = document.getElementById('screen');
  if (tab === 'home') { await renderHome(el); return; }
  el.innerHTML = `<div class="card">${placeholders[tab] || '不明な画面'}</div>`;
}
// setActiveTab は変更なし
```

- [ ] **Step 3: 手動確認**

`python -m http.server 8000` で起動。ホームに「0/1800 kcal」「まだ記録がありません」が表示されることを確認（DBが空のため）。

- [ ] **Step 4: Commit**

```bash
git add js/screens/home.js js/ui.js
git commit -m "feat: ホーム画面(きょうの合計・進捗・食事リスト)を追加"
```

---

### Task 13: 撮影〜分析〜記録フロー

**Files:**
- Create: `js/screens/capture.js`
- Modify: `js/ui.js`

- [ ] **Step 1: js/screens/capture.js を作成**

```js
import { resizeToThumbDataUrl, splitDataUrl } from '../camera.js';
import { analyzeImage } from '../ai.js';
import { getSettings, addMeal } from '../db.js';
import { DEFAULT_MODEL, NUTRIENT_KEYS } from '../constants.js';

export async function renderCapture(el, goto) {
  const settings = (await getSettings()) || {};
  if (!settings.apiKey) {
    el.innerHTML = `<div class="card"><p>分析にはAPIキーが必要です。</p>
      <button class="btn" id="toSettings">設定を開く</button></div>`;
    el.querySelector('#toSettings').onclick = () => goto('settings');
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn secondary" id="modePhoto">🍽 料理</button>
        <button class="btn secondary" id="modeLabel">🏷 ラベル</button>
      </div>
      <input type="file" accept="image/*" capture="environment" id="file" hidden>
      <button class="btn" id="pick">📷 写真を撮る / 選ぶ</button>
      <div id="result" style="margin-top:12px"></div>
    </div>`;

  let mode = 'photo';
  const setMode = (m) => {
    mode = m;
    el.querySelector('#modePhoto').classList.toggle('secondary', m !== 'photo');
    el.querySelector('#modeLabel').classList.toggle('secondary', m !== 'label');
  };
  setMode('photo');
  el.querySelector('#modePhoto').onclick = () => setMode('photo');
  el.querySelector('#modeLabel').onclick = () => setMode('label');

  const fileInput = el.querySelector('#file');
  el.querySelector('#pick').onclick = () => fileInput.click();

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const resultEl = el.querySelector('#result');
    resultEl.innerHTML = '<p class="muted">分析中…</p>';
    try {
      const thumb = await resizeToThumbDataUrl(file);
      const { mediaType, base64 } = splitDataUrl(thumb);
      const nut = await analyzeImage({
        imageBase64: base64, mediaType, mode,
        model: settings.model || DEFAULT_MODEL, apiKey: settings.apiKey,
      });
      showResult(resultEl, nut, thumb, mode, goto);
    } catch (err) {
      resultEl.innerHTML = `<p class="badge-low">エラー: ${err.message}</p>
        <button class="btn secondary" id="retry">もう一度</button>`;
      resultEl.querySelector('#retry').onclick = () => { fileInput.value=''; fileInput.click(); };
    }
  };
}

function showResult(el, nut, thumb, mode, goto) {
  const lowBadge = nut.confidence === 'low' ? '<span class="badge-low">確信度 低</span>' : '';
  el.innerHTML = `
    <img src="${thumb}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">
    <h3 style="margin:8px 0 4px">${nut.name} ${lowBadge}</h3>
    <p>🔥 ${nut.kcal} kcal ／ P ${nut.protein_g}g・F ${nut.fat_g}g・C ${nut.carb_g}g ／ 🧂${nut.salt_g}g</p>
    <div class="advice">💡 ${nut.advice}</div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn secondary" id="edit">修正</button>
      <button class="btn" id="save">記録する</button>
    </div>`;

  el.querySelector('#save').onclick = async () => {
    await addMeal({
      datetime: new Date().toISOString(), mode, imageThumb: thumb,
      ...pickNut(nut), confidence: nut.confidence, items: nut.items,
      advice: nut.advice, userEdited: false,
    });
    goto('home');
  };

  el.querySelector('#edit').onclick = () => showEdit(el, nut, thumb, mode, goto);
}

function pickNut(nut) {
  const o = { name: nut.name };
  for (const k of NUTRIENT_KEYS) o[k] = nut[k];
  return o;
}

function showEdit(el, nut, thumb, mode, goto) {
  const fields = [['name','料理名','text'], ...NUTRIENT_KEYS.map((k)=>[k,k,'number'])];
  el.innerHTML = `<div>${fields.map(([k,label,type])=>`
    <label style="display:block;margin:6px 0">${label}
      <input data-k="${k}" type="${type}" value="${nut[k] ?? ''}" style="width:100%;padding:8px">
    </label>`).join('')}
    <button class="btn" id="saveEdit">この内容で記録</button></div>`;
  el.querySelector('#saveEdit').onclick = async () => {
    const edited = { ...nut };
    el.querySelectorAll('input[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      edited[k] = k === 'name' ? inp.value : Number(inp.value);
    });
    await addMeal({
      datetime: new Date().toISOString(), mode, imageThumb: thumb,
      ...pickNut(edited), confidence: nut.confidence, items: nut.items,
      advice: nut.advice, userEdited: true,
    });
    goto('home');
  };
}
```

- [ ] **Step 2: ui.js を capture対応に修正（gotoを渡す）**

`js/ui.js`:

```js
import { renderCapture } from './screens/capture.js';
// renderScreen のシグネチャを (tab, goto) に変更し:
//   if (tab === 'capture') { await renderCapture(el, goto); return; }
```

`js/app.js` の `goto` で `renderScreen(tab, goto)` を渡すよう修正。

- [ ] **Step 3: 手動確認**

設定でAPIキー未設定なら「設定を開く」が出ること、設定後（Task16実装後）に料理写真を選ぶと分析→結果→記録でホームに反映されることを確認。

- [ ] **Step 4: Commit**

```bash
git add js/screens/capture.js js/ui.js js/app.js
git commit -m "feat: 撮影〜AI分析〜修正〜記録フローを追加"
```

---

### Task 14: 履歴画面

**Files:**
- Create: `js/screens/history.js`
- Modify: `js/ui.js`

- [ ] **Step 1: js/screens/history.js を作成**

```js
import { getAllMeals, deleteMeal } from '../db.js';
import { localDateKey, aggregateTotals } from '../nutrition.js';

export async function renderHistory(el, goto) {
  const meals = await getAllMeals();
  if (!meals.length) { el.innerHTML = '<div class="card"><p class="muted">記録がありません。</p></div>'; return; }

  // 日付ごとにまとめ、新しい順
  const byDate = new Map();
  for (const m of meals) {
    const k = localDateKey(m.datetime);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k).push(m);
  }
  const dates = [...byDate.keys()].sort().reverse();

  el.innerHTML = dates.map((d) => {
    const dayMeals = byDate.get(d);
    const t = aggregateTotals(dayMeals);
    const rows = dayMeals.map((m) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #f0f0f0">
        <span>${m.name}</span>
        <span><span class="muted">${m.kcal}kcal</span>
        <button data-del="${m.id}" style="border:none;background:none;color:var(--p)">🗑</button></span>
      </div>`).join('');
    return `<div class="card"><h3 style="margin:0 0 6px">${d} <span class="muted">合計 ${t.kcal}kcal</span></h3>${rows}</div>`;
  }).join('');

  el.querySelectorAll('button[data-del]').forEach((b) => {
    b.onclick = async () => { await deleteMeal(Number(b.dataset.del)); goto('history'); };
  });
}
```

- [ ] **Step 2: ui.js を history対応に修正**

```js
import { renderHistory } from './screens/history.js';
// if (tab === 'history') { await renderHistory(el, goto); return; }
```

- [ ] **Step 3: 手動確認**

記録を数件追加後、履歴に日付別でまとまり、🗑で削除できることを確認。

- [ ] **Step 4: Commit**

```bash
git add js/screens/history.js js/ui.js
git commit -m "feat: 履歴画面(日付別表示・削除)を追加"
```

---

### Task 15: トレンド画面（SVGグラフ＋週次AI助言）

**Files:**
- Create: `js/screens/trends.js`
- Modify: `js/ai.js`（週次助言生成を追加）
- Modify: `test/ai.test.js`（buildTrendAdviceRequestのテスト追記）

- [ ] **Step 1: ai.js に週次助言リクエスト生成のテストを追記（純粋関数）**

`test/ai.test.js`:

```js
import { buildTrendAdviceRequest } from '../js/ai.js';

describe('buildTrendAdviceRequest', () => {
  it('週次サマリと目標をテキストに含めtool不要のメッセージを作る', () => {
    const req = buildTrendAdviceRequest({
      summary: { days: [{ date:'2026-06-14', kcal:1000 }], averages: { kcal: 1000 } },
      goals: { kcal: 1800 }, model: 'claude-sonnet-4-6', apiKey: 'sk',
    });
    const text = req.body.messages[0].content;
    expect(text).toContain('1800');
    expect(req.body.tools).toBeUndefined();
    expect(req.headers['x-api-key']).toBe('sk');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- ai`
Expected: FAIL（buildTrendAdviceRequest is not defined）

- [ ] **Step 3: ai.js に実装を追記**

```js
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- ai`
Expected: PASS

- [ ] **Step 5: js/screens/trends.js を作成（SVG棒グラフ・自前描画）**

```js
import { getMealsInRange } from '../db.js';
import { summarizeWeek, localDateKey } from '../nutrition.js';
import { getGoals, getSettings } from '../db.js';
import { getTrendAdvice } from '../ai.js';
import { DEFAULT_GOALS, DEFAULT_MODEL } from '../constants.js';

function barChart(days, goalKcal) {
  const max = Math.max(goalKcal || 0, ...days.map((d) => d.kcal), 1);
  const reversed = [...days].reverse(); // 古い→新しい
  const bw = 100 / reversed.length;
  const bars = reversed.map((d, i) => {
    const h = (d.kcal / max) * 90;
    const over = goalKcal && d.kcal > goalKcal;
    return `<rect x="${i*bw+1}" y="${100-h}" width="${bw-2}" height="${h}"
      fill="${over ? 'var(--p)' : 'var(--primary)'}"></rect>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" style="width:100%;height:120px">${bars}</svg>`;
}

export async function renderTrends(el) {
  const today = localDateKey(new Date().toISOString());
  const meals = await getMealsInRange(shift(today, -6), today);
  const summary = summarizeWeek(meals, today, 7);
  const goals = (await getGoals()) || DEFAULT_GOALS;

  el.innerHTML = `
    <div class="card"><h3 style="margin:0 0 8px">直近7日のカロリー</h3>
      ${barChart(summary.days, goals.kcal)}
      <p class="muted">平均 ${summary.averages.kcal} kcal/日</p></div>
    <div class="card"><h3 style="margin:0 0 8px">今週の傾向</h3>
      <div id="advice" class="advice">「助言を生成」を押すとAIが傾向をまとめます。</div>
      <button class="btn" id="gen" style="margin-top:8px">助言を生成</button></div>`;

  el.querySelector('#gen').onclick = async () => {
    const settings = (await getSettings()) || {};
    const box = el.querySelector('#advice');
    if (!settings.apiKey) { box.textContent = 'APIキーを設定してください。'; return; }
    box.textContent = '生成中…';
    try {
      box.textContent = await getTrendAdvice({
        summary, goals, model: settings.model || DEFAULT_MODEL, apiKey: settings.apiKey,
      });
    } catch (e) { box.textContent = `エラー: ${e.message}`; }
  };
}

function shift(dateKey, delta) {
  const [y,m,d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m-1, d); dt.setDate(dt.getDate()+delta);
  return localDateKey(dt.toISOString());
}
```

- [ ] **Step 6: ui.js を trends対応に修正**

```js
import { renderTrends } from './screens/trends.js';
// if (tab === 'trends') { await renderTrends(el); return; }
```

- [ ] **Step 7: 手動確認**

数日分の記録後、トレンドにグラフが描画され、「助言を生成」でAI助言が表示されることを確認。

- [ ] **Step 8: Commit**

```bash
git add js/screens/trends.js js/ui.js js/ai.js test/ai.test.js
git commit -m "feat: トレンド画面(SVGグラフ＋週次AI助言)を追加"
```

---

### Task 16: 設定画面（APIキー・モデル・目標・バックアップ）

**Files:**
- Create: `js/screens/settings.js`
- Modify: `js/ui.js`

- [ ] **Step 1: js/screens/settings.js を作成**

```js
import { getSettings, saveSettings, getGoals, saveGoals, getAllMeals } from '../db.js';
import { buildExport, parseImport } from '../backup.js';
import { addMeal } from '../db.js';
import { AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_GOALS, NUTRIENT_KEYS } from '../constants.js';

export async function renderSettings(el) {
  const s = (await getSettings()) || {};
  const g = (await getGoals()) || DEFAULT_GOALS;
  const goalKeys = ['kcal','protein_g','fat_g','carb_g','salt_g'];

  el.innerHTML = `
    <div class="card"><h3 style="margin:0 0 8px">AI設定</h3>
      <label>APIキー<input id="apiKey" type="password" value="${s.apiKey || ''}" style="width:100%;padding:8px"></label>
      <label style="display:block;margin-top:8px">モデル
        <select id="model" style="width:100%;padding:8px">
          ${AVAILABLE_MODELS.map((m)=>`<option ${(s.model||DEFAULT_MODEL)===m?'selected':''}>${m}</option>`).join('')}
        </select></label>
      <button class="btn" id="saveAi" style="margin-top:8px">保存</button></div>

    <div class="card"><h3 style="margin:0 0 8px">1日の目標</h3>
      ${goalKeys.map((k)=>`<label style="display:block;margin:4px 0">${k}
        <input data-g="${k}" type="number" value="${g[k] ?? ''}" style="width:100%;padding:8px"></label>`).join('')}
      <button class="btn" id="saveGoals" style="margin-top:8px">目標を保存</button></div>

    <div class="card"><h3 style="margin:0 0 8px">バックアップ</h3>
      <button class="btn secondary" id="export">JSONを書き出す</button>
      <input type="file" id="importFile" accept="application/json" hidden>
      <button class="btn secondary" id="import" style="margin-top:8px">JSONを取り込む</button></div>`;

  el.querySelector('#saveAi').onclick = async () => {
    await saveSettings({ ...s, apiKey: el.querySelector('#apiKey').value.trim(), model: el.querySelector('#model').value });
    alert('保存しました');
  };
  el.querySelector('#saveGoals').onclick = async () => {
    const goals = { ...g };
    el.querySelectorAll('input[data-g]').forEach((i)=>{ goals[i.dataset.g] = Number(i.value); });
    await saveGoals(goals); alert('目標を保存しました');
  };

  el.querySelector('#export').onclick = async () => {
    const data = buildExport({ meals: await getAllMeals(), goals: await getGoals(), settings: s });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'diet-backup.json'; a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = el.querySelector('#importFile');
  el.querySelector('#import').onclick = () => importFile.click();
  importFile.onchange = async () => {
    const file = importFile.files[0]; if (!file) return;
    try {
      const parsed = parseImport(await file.text());
      for (const m of parsed.meals) { const { id, ...rest } = m; await addMeal(rest); }
      if (parsed.goals && Object.keys(parsed.goals).length) await saveGoals(parsed.goals);
      alert(`取り込み完了: ${parsed.meals.length}件`);
    } catch (e) { alert(`取り込み失敗: ${e.message}`); }
  };
}
```

- [ ] **Step 2: ui.js を settings対応に修正**

```js
import { renderSettings } from './screens/settings.js';
// if (tab === 'settings') { await renderSettings(el); return; }
```

- [ ] **Step 3: 手動確認**

APIキー保存→撮影画面でキー要求が消える、目標保存→ホームの目標が反映、書き出し/取り込みが動くことを確認。

- [ ] **Step 4: Commit**

```bash
git add js/screens/settings.js js/ui.js
git commit -m "feat: 設定画面(APIキー・モデル・目標・JSONバックアップ)を追加"
```

---

### Task 17: PWA化（manifest・Service Worker・アイコン）

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`

- [ ] **Step 1: manifest.json を作成**

```json
{
  "name": "AIダイエット記録",
  "short_name": "ダイエット",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f6f7f6",
  "theme_color": "#2E7D5B",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: sw.js を作成（静的アセットはcache-first、APIは常にネット）**

```js
const CACHE = 'diet-ai-v1';
const ASSETS = [
  './', './index.html', './css/styles.css', './manifest.json',
  './js/app.js', './js/ui.js', './js/constants.js', './js/nutrition.js',
  './js/schema.js', './js/ai.js', './js/camera.js', './js/db.js', './js/backup.js',
  './js/screens/home.js', './js/screens/capture.js', './js/screens/history.js',
  './js/screens/trends.js', './js/screens/settings.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === 'api.anthropic.com') return; // API呼び出しはキャッシュしない
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

- [ ] **Step 3: アイコンを作成**

192x192 と 512x512 のPNGアイコン（テーマ色 #2E7D5B 背景に🍱等）を `icons/` に配置する。簡易作成は Python:

```bash
/c/Users/jsber/AppData/Local/Programs/Python/Python313/python.exe - <<'PY'
from PIL import Image, ImageDraw, ImageFont
for size in (192, 512):
    img = Image.new('RGB', (size, size), '#2E7D5B')
    d = ImageDraw.Draw(img)
    d.text((size//2, size//2), 'D', fill='white', anchor='mm')
    img.save(f'icons/icon-{size}.png')
PY
```

- [ ] **Step 4: 手動確認**

`python -m http.server 8000` で開き、DevTools > Application > Manifest が読めること、Service Worker が登録されること、オフラインでも画面が開くことを確認。

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js icons/
git commit -m "feat: PWA化(manifest・Service Worker・アイコン)を追加"
```

---

### Task 18: README と全テスト最終確認

**Files:**
- Create: `README.md`

- [ ] **Step 1: README.md を作成**

```markdown
# AIダイエット記録（個人用PWA）

食事写真／栄養成分ラベルをClaude APIで分析し、栄養概算・行動提案・記録・履歴・目標進捗・週次トレンド助言を行う個人用スマホPWA。

## 使い方
1. 設定でAnthropic APIキーを入力（端末のlocalStorageに保存）。
2. 📷から料理またはラベルを撮影 → AIが分析 → 修正して記録。
3. ホームで今日の合計、履歴で過去、トレンドで週次助言。

## 開発
- テスト: `npm install && npm test`
- ローカル起動: `python -m http.server 8000`
- デプロイ: GitHub Pages（hinyan1016）

## 構成
ビルドなしのバニラJS（ESモジュール）。AIはブラウザから直接Claude APIを呼び出し（`anthropic-dangerous-direct-browser-access`）、データはIndexedDBに端末内保存。

## 注意
本アプリの栄養値・助言は概算であり、医療助言ではありません。
```

- [ ] **Step 2: 全テスト実行**

Run: `npm test`
Expected: PASS（nutrition / schema / ai / camera / db / backup / smoke すべて）

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: READMEを追加"
```

---

## Self-Review（計画作成者によるチェック）

**1. 仕様カバレッジ:**
- 写真→分析→提案 → Task 6,7,13 ✅
- その日の合計・履歴 → Task 2,12,14 ✅
- 目標設定と進捗 → Task 3,12,16 ✅
- ラベル読み取り → Task 6（labelモード）,13 ✅
- 週次トレンド助言 → Task 4,15 ✅
- 構成A（直接API・localStorageキー・IndexedDB） → Task 6,9,16 ✅
- スキーマ検証・エラー処理・確信度バッジ → Task 5,7,13 ✅
- PWA・オフライン → Task 17 ✅
- バックアップ → Task 10,16 ✅
- テスト方針（純粋ロジック中心） → Task 2-10 ✅

**2. プレースホルダscan:** UIタスク内の「Task Nで実装」表記は段階的差し替えの意図的なものでコードは各タスクに実体あり。未実装プレースホルダなし。

**3. 型整合:** `aggregateTotals`/`goalProgress`/`summarizeWeek`/`localDateKey`/`validateNutrition`/`buildAnalyzeRequest`/`parseToolResponse`/`analyzeImage`/`buildTrendAdviceRequest`/`getTrendAdvice`/`fitDimensions`/`splitDataUrl`/`resizeToThumbDataUrl`/db関数群、後続タスクでの呼び出し名が定義と一致。NUTRIENT_KEYS の6キーを全体で統一使用。
