# AIダイエット記録（個人用PWA）

食事写真／栄養成分ラベルをClaude APIで分析し、栄養概算・行動提案・記録・履歴・目標進捗・週次トレンド助言を行う個人用スマホPWA。

## 使い方
1. 設定でAnthropic APIキーを入力（端末のIndexedDB/localStorageに保存）。
2. 📷から料理またはラベルを撮影 → AIが分析 → 修正して記録。
3. ホームで今日の合計、履歴で過去、トレンドで週次助言。

## 開発
- テスト: `npm install && npm test`
- ローカル起動: `python -m http.server 8000`（その後 http://localhost:8000 ）
- デプロイ: GitHub Pages（hinyan1016）

## 構成
ビルドなしのバニラJS（ESモジュール）。AIはブラウザから直接Claude APIを呼び出し（`anthropic-dangerous-direct-browser-access`）、データはIndexedDBに端末内保存。

| ファイル | 役割 |
|---|---|
| js/constants.js | 栄養キー・既定値・モデルID |
| js/nutrition.js | 集計・目標進捗・週次サマリ（純粋関数） |
| js/schema.js | AI応答スキーマ検証 |
| js/ai.js | Claude API呼び出し・record_nutritionツール |
| js/camera.js | 撮影・サムネ縮小 |
| js/db.js | IndexedDBラッパ |
| js/backup.js | JSON書き出し/取り込み |
| js/utils.js | HTMLエスケープ等 |
| js/ui.js / js/app.js | ルーティング・起点 |
| js/screens/*.js | 5画面 |

## 注意
本アプリの栄養値・助言は概算であり、医療助言ではありません。
