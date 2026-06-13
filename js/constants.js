// 記録・集計する栄養素のキー（この順・この綴りで全体統一）。
export const NUTRIENT_KEYS = ['kcal', 'protein_g', 'fat_g', 'carb_g', 'salt_g', 'fiber_g'];

export const DEFAULT_MODEL = 'claude-sonnet-4-6';
export const AVAILABLE_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8'];

// 既定の目標値。
// 注: fiber_g は意図的に目標を設けない（食物繊維は記録・集計はするが上限/下限の目標管理対象外）。
//     goalProgress は数値かつ正の目標キーのみを走査するため、欠損していても安全。
// 注: weightTarget は栄養素ではなく体重目標（NUTRIENT_KEYS には含めない別ドメインの値）。
export const DEFAULT_GOALS = {
  kcal: 1800, protein_g: 72, fat_g: 50, carb_g: 200, salt_g: 7, weightTarget: null,
};

export const CONFIDENCE_LEVELS = ['high', 'mid', 'low'];
export const MODES = ['photo', 'label'];
