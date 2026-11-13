export const stickers = Object.freeze([
  { id: 'zoa-daisy', name: '雛菊ZOA', index: 0 },
  { id: 'zoa-flower-scarf', name: '領巾小花', index: 1 },
  { id: 'zoa-cloud-nap', name: '午睡雲朵', index: 2 },
  { id: 'zoa-paw-hug', name: '肉球抱抱', index: 3 },
  { id: 'zoa-box-hide', name: '紙箱躲貓', index: 4 },
  { id: 'zoa-crown', name: '皇冠小貓', index: 5 },
  { id: 'zoa-daisy-pillow', name: '雛菊抱枕', index: 6 },
  { id: 'zoa-yarn', name: '毛線時光', index: 7 },
  { id: 'zoa-friends', name: 'ZOA與朋友', index: 8 },
].map(Object.freeze));

const stickerById = new Map(stickers.map(sticker => [sticker.id, sticker]));
const legacyStickers = new Set(['🐈', '🐾', '🐱', '🌷', '☕', '🍰', '🌱', '🧶', '💌', '🌙', '🍓', '✨']);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

export function isValidSticker(value) {
  return typeof value === 'string' && (stickerById.has(value) || legacyStickers.has(value));
}

export function renderSticker(value, extraClass = '') {
  const sticker = stickerById.get(value);
  if (!sticker) return escapeHTML(value);
  const position = `${(sticker.index % 3) * 50}% ${Math.floor(sticker.index / 3) * 50}%`;
  const className = extraClass ? `zoa-sticker ${escapeHTML(extraClass)}` : 'zoa-sticker';
  return `<span class="${className}" role="img" aria-label="${escapeHTML(sticker.name)}" style="background-position:${position}"></span>`;
}
