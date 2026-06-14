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
