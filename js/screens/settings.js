import { getSettings, saveSettings, getGoals, saveGoals, getAllMeals, addMeal } from '../db.js';
import { buildExport, parseImport } from '../backup.js';
import { AVAILABLE_PROVIDERS, PROVIDER_LABELS, modelsForProvider, defaultModelForProvider, DEFAULT_PROVIDER, DEFAULT_GOALS } from '../constants.js';
import { esc } from '../utils.js';

const KEY_HELP = {
  claude: 'console.anthropic.com で発行（要クレジット）',
  gemini: 'aistudio.google.com/apikey で発行（Googleログイン・無料枠あり）',
};

export async function renderSettings(el) {
  const s = (await getSettings()) || {};
  const g = (await getGoals()) || DEFAULT_GOALS;
  const provider = s.provider || DEFAULT_PROVIDER;
  const goalKeys = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g'];

  const providerOptions = AVAILABLE_PROVIDERS
    .map((p) => `<option value="${esc(p)}" ${p === provider ? 'selected' : ''}>${esc(PROVIDER_LABELS[p])}</option>`).join('');

  el.innerHTML = `
    <div class="card"><h3 style="margin:0 0 8px">AI設定</h3>
      <label style="display:block">プロバイダ
        <select id="provider" style="width:100%;padding:8px">${providerOptions}</select></label>
      <label style="display:block;margin-top:8px">モデル
        <select id="model" style="width:100%;padding:8px"></select></label>
      <label style="display:block;margin-top:8px">APIキー
        <input id="apiKey" type="password" value="${esc(s.apiKey || '')}" style="width:100%;padding:8px"></label>
      <p class="muted" id="keyHelp" style="margin-top:4px"></p>
      <button class="btn" id="saveAi" style="margin-top:8px">保存</button></div>

    <div class="card"><h3 style="margin:0 0 8px">1日の目標</h3>
      ${goalKeys.map((k) => `<label style="display:block;margin:4px 0">${k}
        <input data-g="${k}" type="number" value="${g[k] ?? ''}" style="width:100%;padding:8px"></label>`).join('')}
      <button class="btn" id="saveGoals" style="margin-top:8px">目標を保存</button></div>

    <div class="card"><h3 style="margin:0 0 8px">バックアップ</h3>
      <button class="btn secondary" id="export">JSONを書き出す</button>
      <input type="file" id="importFile" accept="application/json" hidden>
      <button class="btn secondary" id="import" style="margin-top:8px">JSONを取り込む</button></div>`;

  const providerSel = el.querySelector('#provider');
  const modelSel = el.querySelector('#model');
  const keyHelp = el.querySelector('#keyHelp');

  function fillModels(p, selected) {
    const models = modelsForProvider(p);
    const chosen = selected && models.includes(selected) ? selected : defaultModelForProvider(p);
    modelSel.innerHTML = models.map((m) => `<option ${m === chosen ? 'selected' : ''}>${esc(m)}</option>`).join('');
    keyHelp.textContent = 'APIキーは ' + KEY_HELP[p];
  }
  fillModels(provider, s.model);
  providerSel.onchange = () => fillModels(providerSel.value, null);

  el.querySelector('#saveAi').onclick = async () => {
    await saveSettings({
      ...s,
      provider: providerSel.value,
      model: modelSel.value,
      apiKey: el.querySelector('#apiKey').value.trim(),
    });
    alert('保存しました');
  };
  el.querySelector('#saveGoals').onclick = async () => {
    const goals = { ...g };
    el.querySelectorAll('input[data-g]').forEach((i) => { goals[i.dataset.g] = Number(i.value); });
    await saveGoals(goals); alert('目標を保存しました');
  };

  el.querySelector('#export').onclick = async () => {
    const freshSettings = (await getSettings()) || {};
    const data = buildExport({ meals: await getAllMeals(), goals: await getGoals(), settings: freshSettings });
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
