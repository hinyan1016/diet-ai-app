// innerHTML に動的な文字列を埋める際のHTMLエスケープ（描画崩れ・自己XSS防止）
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
