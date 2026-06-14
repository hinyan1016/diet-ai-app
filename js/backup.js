export function buildExport({ meals, goals, settings }, exportedAt = new Date().toISOString()) {
  const safeSettings = { ...(settings || {}) };
  delete safeSettings.apiKey; // 秘密情報はバックアップに含めない
  return {
    version: 1,
    exportedAt,
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
  // 多層防御: 取り込み側でも apiKey は復元しない（改変済みバックアップ対策）
  const settings = { ...(obj.settings || {}) };
  delete settings.apiKey;
  return {
    meals: Array.isArray(obj.meals) ? obj.meals : [],
    goals: obj.goals || {},
    settings,
  };
}
