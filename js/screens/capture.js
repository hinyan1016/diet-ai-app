import { resizeToThumbDataUrl, splitDataUrl } from '../camera.js';
import { analyzeImage } from '../ai.js';
import { getSettings, addMeal } from '../db.js';
import { DEFAULT_MODEL, NUTRIENT_KEYS } from '../constants.js';
import { esc } from '../utils.js';

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
      resultEl.innerHTML = `<p class="badge-low">エラー: ${esc(err.message)}</p>
        <button class="btn secondary" id="retry">もう一度</button>`;
      resultEl.querySelector('#retry').onclick = () => { fileInput.value = ''; fileInput.click(); };
    }
  };
}

function pickNut(nut) {
  const o = { name: nut.name };
  for (const k of NUTRIENT_KEYS) o[k] = nut[k];
  return o;
}

function showResult(el, nut, thumb, mode, goto) {
  const lowBadge = nut.confidence === 'low' ? '<span class="badge-low">確信度 低</span>' : '';
  el.innerHTML = `
    <img src="${thumb}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover">
    <h3 style="margin:8px 0 4px">${esc(nut.name)} ${lowBadge}</h3>
    <p>🔥 ${nut.kcal} kcal ／ P ${nut.protein_g}g・F ${nut.fat_g}g・C ${nut.carb_g}g ／ 🧂${nut.salt_g}g</p>
    <div class="advice">💡 ${esc(nut.advice)}</div>
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

function showEdit(el, nut, thumb, mode, goto) {
  const fields = [['name', '料理名', 'text'], ...NUTRIENT_KEYS.map((k) => [k, k, 'number'])];
  el.innerHTML = `<div>${fields.map(([k, label, type]) => `
    <label style="display:block;margin:6px 0">${label}
      <input data-k="${k}" type="${type}" value="${esc(nut[k] ?? '')}" style="width:100%;padding:8px">
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
