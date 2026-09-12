/** 量 ts-gap 的 paddingLeft + marginLeft（px/em），surplus 写 padding */
import { win } from '../env.js';
import { parseCssLengthToEm } from '../core/dom-util.js';

export function gapPmPx(gapEl) {
  if (!gapEl || !win?.getComputedStyle) return 0;
  var cs = win.getComputedStyle(gapEl);
  var pad = parseFloat(cs.paddingLeft);
  var mar = parseFloat(cs.marginLeft);
  if (!isFinite(pad)) pad = 0;
  if (!isFinite(mar)) mar = 0;
  return pad + mar;
}

/** 连写已改成半角盒+删缝，不再有不可调 combo 缝 */
export function comboFixedGapPmPx() {
  return 0;
}

export function lineGapPmSumsPx(items, startIndex, endIndex) {
  var gapPm = 0;
  for (var j = startIndex; j <= endIndex && j < items.length; j++) {
    if (items[j].type !== 'gap') continue;
    gapPm += gapPmPx(items[j].el);
  }
  return { gapPmPx: gapPm, comboFixedPmPx: 0 };
}

export function readGapPaddingEm(gapEl, emPx) {
  var inline = gapEl.style.paddingLeft;
  if (inline) return parseCssLengthToEm(inline, emPx);
  if (!win?.getComputedStyle) return 0;
  return parseCssLengthToEm(win.getComputedStyle(gapEl).paddingLeft, emPx);
}

export function addGapPaddingEm(gapEl, deltaEm, emPx) {
  var next = readGapPaddingEm(gapEl, emPx) + deltaEm;
  if (Math.abs(next) < 1e-9) gapEl.style.paddingLeft = '0';
  else gapEl.style.paddingLeft = next.toFixed(6).replace(/\.?0+$/, '') + 'em';
}
