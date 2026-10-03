/** 兼容层：按 writing-mode 读行宽、分行，并用逻辑属性写缝和半角盒。 */
import { win } from '../env.js';

export var GAP_PAD = 'padding-inline-start';
export var GAP_MAR = 'margin-inline-start';
export var HANG_END_MAR = 'margin-inline-end';
export var HANG_START_MAR = 'margin-inline-start';

export function writingModeOf(el) {
  if (!el || !win || !win.getComputedStyle) return 'horizontal-tb';
  var m = String(win.getComputedStyle(el).writingMode || '').toLowerCase();
  if (m === 'vertical-rl' || m === 'vertical-lr') return m;
  return 'horizontal-tb';
}

export function isVerticalWritingMode(el) {
  var m = writingModeOf(el);
  return m === 'vertical-rl' || m === 'vertical-lr';
}

export function flowOf(el) {
  return { vertical: isVerticalWritingMode(el) };
}

export function rectInline(rect, vertical) {
  if (!rect) return 0;
  return vertical ? rect.height : rect.width;
}

export function rectLinePos(rect, vertical) {
  if (!rect) return 0;
  return vertical ? rect.left : rect.top;
}

export function rectLineThick(rect, vertical) {
  if (!rect) return 0;
  return vertical ? rect.width : rect.height;
}

/** clientWidth/Height 是整数 CSS px；减 2px 给 UA 折行留子像素余量（Chrome 竖排约需 2）。 */
export function contentInlinePx(block) {
  if (!block) return 0;
  var vertical = isVerticalWritingMode(block);
  var box = vertical ? block.clientHeight || 0 : block.clientWidth || 0;
  if (!win || !win.getComputedStyle) return Math.max(0, box - 2);
  var cs = win.getComputedStyle(block);
  var a = parseFloat(cs.getPropertyValue(GAP_PAD)) || 0;
  var b = parseFloat(cs.getPropertyValue('padding-inline-end')) || 0;
  return Math.max(0, box - a - b - 2);
}

export function setCssEm(el, prop, em) {
  if (!el) return;
  if (em == null || em === '') {
    el.style.removeProperty(prop);
    return;
  }
  if (typeof em === 'number') {
    if (Math.abs(em) < 1e-9) el.style.setProperty(prop, '0');
    else el.style.setProperty(prop, em.toFixed(6).replace(/\.?0+$/, '') + 'em');
    return;
  }
  el.style.setProperty(prop, String(em));
}

export function readCssPx(el, prop) {
  if (!el || !win || !win.getComputedStyle) return 0;
  var n = parseFloat(win.getComputedStyle(el).getPropertyValue(prop));
  return isFinite(n) ? n : 0;
}

export function gapPmPx(el) {
  return readCssPx(el, GAP_PAD) + readCssPx(el, GAP_MAR);
}

export function readGapPadEm(el, emPx) {
  if (!el) return 0;
  var inline = el.style.getPropertyValue(GAP_PAD);
  if (inline) {
    if (emPx > 0 && /px$/i.test(inline)) return (parseFloat(inline) || 0) / emPx;
    var emM = String(inline).trim().match(/^([-+]?\d*\.?\d+)em$/i);
    if (emM) return parseFloat(emM[1]);
    if (inline === '0' || inline === '0px') return 0;
  }
  if (!win || !win.getComputedStyle || !(emPx > 0)) return 0;
  return readCssPx(el, GAP_PAD) / emPx;
}

export function setGapPadEm(el, em) {
  setCssEm(el, GAP_PAD, em);
}

export function setGapMarEm(el, em) {
  setCssEm(el, GAP_MAR, em);
}

export function clearGapEdge(el) {
  if (!el || !el.style) return;
  el.style.paddingLeft = '';
  el.style.marginLeft = '';
  setCssEm(el, GAP_PAD, 0);
  setCssEm(el, GAP_MAR, 0);
}

export function resetGapEdge(el) {
  if (!el || !el.style) return;
  el.style.paddingLeft = '';
  el.style.marginLeft = '';
  el.style.removeProperty(GAP_PAD);
  el.style.removeProperty(GAP_MAR);
}

export function setHangEnd(el) {
  if (!el) return el;
  el.style.setProperty(HANG_END_MAR, '-0.5em');
  return el;
}

export function setHangStart(el) {
  if (!el) return el;
  el.style.setProperty(HANG_START_MAR, '-0.5em');
  return el;
}

export function applyHalfBoxStyle(span) {
  if (!span) return span;
  span.style.display = 'inline-block';
  span.style.textAlign = 'start';
  span.style.textIndent = '0';
  span.style.verticalAlign = 'baseline';
  span.style.overflow = 'visible';
  span.style.boxSizing = 'content-box';
  span.style.setProperty('inline-size', '0.5em');
  span.style.setProperty('min-inline-size', '0');
  return span;
}

export function setInlineShift(el, em) {
  setCssEm(el, HANG_START_MAR, em);
}

export function copyHostInlineSize(clone, host) {
  if (!clone || !host) return;
  if (win && win.getComputedStyle) {
    clone.style.writingMode = win.getComputedStyle(host).writingMode;
  }
  var px = contentInlinePx(host);
  if (!(px > 0)) {
    var r = host.getBoundingClientRect && host.getBoundingClientRect();
    px = r ? rectInline(r, isVerticalWritingMode(host)) : 0;
  }
  if (px > 0) clone.style.setProperty('inline-size', px + 'px');
}
