/** 量一行视觉宽：字（pretext/DOM）+ 空（gap pm）− 半角 span 修正；hang/surplus 用此结果 */
import { win, defaultRoot } from '../env.js';
import { parseCssLengthToEm } from '../core/dom-util.js';
import {
  flattenParagraph,
  findLineFirstCharIndices,
  lineItemBounds,
  lineCharsFromItems,
  getItemRect,
} from './paragraph-items.js';
import { lineGapPmSumsPx } from './gap-padding-margin.js';

let measureTextCharWidthPxHook = null;

export function getBlockEmPx(block) {
  if (!block || !win?.getComputedStyle) return 16;
  var fs = parseFloat(win.getComputedStyle(block).fontSize);
  return isFinite(fs) && fs > 0 ? fs : 16;
}

export function getBlockContentWidthPx(block) {
  if (!block) return 0;
  return block.clientWidth || 0;
}

function charItemHalfSpanEl(item) {
  if (!item || item.type !== 'char') return null;
  var par = item.node && item.node.parentElement;
  if (!par || !par.classList) return null;
  if (par.classList.contains('ts-half-punct') || par.classList.contains('ts-line-end-half')) return par;
  return null;
}

function halfEmSpanLayoutPx(span, emPx, pretW) {
  if (!span) return pretW;
  if (span.classList.contains('ts-half-punct')) {
    return 0.5 * emPx;
  }
  if (span.classList.contains('ts-line-end-half')) {
    var marPx = span.style.marginLeft
      ? parseCssLengthToEm(span.style.marginLeft, emPx) * emPx
      : win?.getComputedStyle
        ? parseFloat(win.getComputedStyle(span).marginLeft) || 0
        : -0.5 * emPx;
    return pretW + marPx;
  }
  return pretW;
}

function measureCharGlyphWidthPx(item, block, emPx) {
  if (measureTextCharWidthPxHook) {
    return measureTextCharWidthPxHook(item.ch, block) || 0;
  }
  var w = getItemRect(item).width;
  return w > 0 ? w : emPx;
}

function measureHalfEmCharAdjustPx(items, startIndex, endIndex, block, emPx) {
  var total = 0;
  var spanSeen = [];
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var span = charItemHalfSpanEl(items[i]);
    if (!span) continue;
    if (spanSeen.indexOf(span) >= 0) continue;
    spanSeen.push(span);
    var pretW = 0;
    for (var j = startIndex; j <= endIndex && j < items.length; j++) {
      if (items[j].type !== 'char') continue;
      if (charItemHalfSpanEl(items[j]) !== span) continue;
      pretW += measureCharGlyphWidthPx(items[j], block, emPx);
    }
    var layoutW = halfEmSpanLayoutPx(span, emPx, pretW);
    if (pretW > layoutW) total += pretW - layoutW;
  }
  return total;
}

function measureLineCharsPx(items, startIndex, endIndex, block, emPx, row) {
  if (measureTextCharWidthPxHook) {
    var w = measureTextCharWidthPxHook(row.text, block);
    return w != null ? w : 0;
  }
  var total = 0;
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    total += getItemRect(items[i]).width;
  }
  return total;
}

export function measureLineVisualMetricsPx(block, items, startIndex, endIndex) {
  var row = lineCharsFromItems(items, startIndex, endIndex);
  var gaps = lineGapPmSumsPx(items, startIndex, endIndex);
  var emPx = getBlockEmPx(block);
  var charPx = measureLineCharsPx(items, startIndex, endIndex, block, emPx, row);
  var halfEmAdjustPx = measureHalfEmCharAdjustPx(items, startIndex, endIndex, block, emPx);
  return {
    text: row.text,
    charCount: row.charCount,
    charWidthPx: charPx,
    gapPmPx: gaps.gapPmPx,
    comboFixedPmPx: gaps.comboFixedPmPx,
    halfEmCharAdjustPx: halfEmAdjustPx,
    lineWidthPx: charPx + gaps.gapPmPx - halfEmAdjustPx,
  };
}

function lineVisualWidthEm(layout, startIndex, endIndex) {
  return (
    measureLineVisualMetricsPx(layout.block, layout.items, startIndex, endIndex).lineWidthPx /
    layout.emPx
  );
}

export function buildBlockLayout(block) {
  void block.offsetHeight;
  var emPx = getBlockEmPx(block);
  var maxPx = getBlockContentWidthPx(block);
  if (emPx <= 0 || maxPx <= 0) return null;
  var items = flattenParagraph(block);
  var heads = findLineFirstCharIndices(items);
  return {
    block: block,
    emPx: emPx,
    maxPx: maxPx,
    maxEm: maxPx / emPx,
    items: items,
    heads: heads,
  };
}

function measureLineVisualMetricsForLine(layout, lineIndex) {
  var range = lineItemBounds(layout.items, layout.heads, lineIndex);
  var m = measureLineVisualMetricsPx(layout.block, layout.items, range.startIndex, range.endIndex);
  return {
    lineIndex: lineIndex,
    text: m.text,
    charCount: m.charCount,
    charWidthPx: m.charWidthPx,
    gapPmPx: m.gapPmPx,
    comboFixedPmPx: m.comboFixedPmPx,
    halfEmCharAdjustPx: m.halfEmCharAdjustPx,
    adjustableGapPmPx: m.gapPmPx - m.comboFixedPmPx,
    lineWidthPx: m.lineWidthPx,
    lineVisualEm: m.lineWidthPx / layout.emPx,
  };
}

export function measureBlockVisualLines(block) {
  var layout = buildBlockLayout(block);
  if (!layout) {
    return { block: block, emPx: 0, maxPx: 0, maxEm: 0, lines: [] };
  }
  var lines = [];
  for (var L = 0; L < layout.heads.length; L++) {
    lines.push(measureLineVisualMetricsForLine(layout, L));
  }
  return {
    block: block,
    emPx: layout.emPx,
    maxPx: layout.maxPx,
    maxEm: layout.maxEm,
    lines: lines,
  };
}

export function measureRootVisualLines(root, selector) {
  root = defaultRoot(root);
  var sel = selector || 'p, h1, h2, h3, h4, h5, h6, li';
  var nodes = root.querySelectorAll(sel);
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    var block = nodes[i];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
    out.push(measureBlockVisualLines(block));
  }
  return out;
}

export function hangMarginEmPerGap(layout, startIndex, endIndex, gapCount, marginOpts) {
  if (!layout || gapCount < 1) return null;
  marginOpts = marginOpts || {};
  var pullBaseEm = marginOpts.pullBaseEm != null ? marginOpts.pullBaseEm : 1;
  var pushBaseEm = marginOpts.pushBaseEm != null ? marginOpts.pushBaseEm : 1;
  var pushOut = marginOpts.wholeCharMaxMinusLine === true;
  var lineEm = lineVisualWidthEm(layout, startIndex, endIndex);
  var amountEm = pushOut ? pushBaseEm + layout.maxEm - lineEm : pullBaseEm + lineEm - layout.maxEm;
  var share = pushOut ? amountEm / gapCount : -amountEm / gapCount - 0.0002;
  if (!isFinite(share)) return null;
  return share.toFixed(6).replace(/\.?0+$/, '') + 'em';
}

export function setCharWidthMeasurer(fn) {
  measureTextCharWidthPxHook = typeof fn === 'function' ? fn : null;
}
