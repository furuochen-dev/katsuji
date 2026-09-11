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

export function comboFixedGapPmPx(gapEl) {
  if (!gapEl || gapEl.getAttribute('data-ts-combo-fixed') !== '1') return 0;
  return gapPmPx(gapEl);
}

function isSignificantCharItem(item) {
  if (!item || item.type !== 'char') return false;
  var ch = item.ch;
  return ch !== '\n' && ch !== '\r' && ch !== ' ' && ch !== '\t' && ch !== '\u00a0' && ch !== '\u3000';
}

/** combo 的 −0.5em 只在两侧字都在本行时缩短行宽；折到下一行的那半不算进本行 */
function comboPairBothOnLine(items, gapIndex, startIndex, endIndex) {
  var prev = -1;
  var next = -1;
  for (var i = gapIndex - 1; i >= 0; i--) {
    if (!isSignificantCharItem(items[i])) continue;
    prev = i;
    break;
  }
  for (var k = gapIndex + 1; k < items.length; k++) {
    if (!isSignificantCharItem(items[k])) continue;
    next = k;
    break;
  }
  return prev >= startIndex && next >= 0 && next <= endIndex;
}

export function lineGapPmSumsPx(items, startIndex, endIndex) {
  var gapPm = 0;
  var comboPm = 0;
  for (var j = startIndex; j <= endIndex && j < items.length; j++) {
    if (items[j].type !== 'gap') continue;
    var el = items[j].el;
    if (el.getAttribute('data-ts-combo-fixed') === '1' && !comboPairBothOnLine(items, j, startIndex, endIndex)) {
      continue;
    }
    var px = gapPmPx(el);
    gapPm += px;
    if (el.getAttribute('data-ts-combo-fixed') === '1') comboPm += px;
  }
  return { gapPmPx: gapPm, comboFixedPmPx: comboPm };
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
