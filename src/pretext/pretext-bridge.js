/**
 * 把 pretext 字符量宽注入 Katsuji（需在 dist/katsuji.js 之后、type=module 加载）。
 */
import { createCharWidthMeasurer } from './line-char-width.js';

function attachPretextLineWidth(Katsuji) {
  if (!Katsuji || !Katsuji.setCharWidthMeasurer) return;
  Katsuji.setCharWidthMeasurer(createCharWidthMeasurer());
}

function detachPretextLineWidth(Katsuji) {
  if (!Katsuji || !Katsuji.setCharWidthMeasurer) return;
  Katsuji.setCharWidthMeasurer(null);
}

attachPretextLineWidth(globalThis.Katsuji);

export { attachPretextLineWidth, detachPretextLineWidth };
