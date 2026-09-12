/** 量一行视觉宽：DOM 逐字宽 + 空（gap pm）− 半角 span 修正；hang/surplus 用此结果 */
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
import {
  hangAmountsEm,
  decideHangStrategy,
  GAP_SHARE_MIN_EM,
  lineMaxEm,
} from '../process/typeset-rules.js';
import { hangPadEmFromBlock } from '../process/hanging-pad.js';

export { lineMaxEm };

export function getBlockEmPx(block) {
  if (!block || !win?.getComputedStyle) return 16;
  var fs = parseFloat(win.getComputedStyle(block).fontSize);
  return isFinite(fs) && fs > 0 ? fs : 16;
}

export function getBlockContentWidthPx(block) {
  if (!block) return 0;
  var w = block.clientWidth || 0;
  if (!win || !win.getComputedStyle) return w;
  var cs = win.getComputedStyle(block);
  var pl = parseFloat(cs.paddingLeft) || 0;
  var pr = parseFloat(cs.paddingRight) || 0;
  return Math.max(0, w - pl - pr);
}

export function getBlockIndentEm(block, emPx) {
  if (!block || !win || !win.getComputedStyle || !(emPx > 0)) return 0;
  var indent = parseCssLengthToEm(win.getComputedStyle(block).textIndent, emPx);
  return indent > 0 ? indent : 0;
}

function charItemHalfSpanEl(item) {
  if (!item || item.type !== 'char') return null;
  var el = item.node && item.node.parentElement;
  while (el) {
    if (el.classList && (el.classList.contains('ts-half-punct') || el.classList.contains('ts-line-end-half'))) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function halfEmSpanLayoutPx(span, emPx, glyphPx) {
  if (!span) return glyphPx;
  if (span.getAttribute('data-ts-hang-end') === '1' || span.getAttribute('data-ts-hang-start') === '1') {
    return 0;
  }
  if (span.classList.contains('ts-half-punct')) {
    return 0.5 * emPx;
  }
  if (span.classList.contains('ts-line-end-half')) {
    var marPx = span.style.marginLeft
      ? parseCssLengthToEm(span.style.marginLeft, emPx) * emPx
      : win?.getComputedStyle
        ? parseFloat(win.getComputedStyle(span).marginLeft) || 0
        : -0.5 * emPx;
    return glyphPx + marPx;
  }
  return glyphPx;
}

function measureCharGlyphWidthPx(item, emPx) {
  var w = getItemRect(item).width;
  return w > 0 ? w : emPx;
}

function measureHalfEmCharAdjustPx(items, startIndex, endIndex, emPx) {
  var total = 0;
  var spanSeen = [];
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var span = charItemHalfSpanEl(items[i]);
    if (!span) continue;
    if (spanSeen.indexOf(span) >= 0) continue;
    spanSeen.push(span);
    var glyphPx = 0;
    for (var j = startIndex; j <= endIndex && j < items.length; j++) {
      if (items[j].type !== 'char') continue;
      if (charItemHalfSpanEl(items[j]) !== span) continue;
      glyphPx += measureCharGlyphWidthPx(items[j], emPx);
    }
    var layoutW = halfEmSpanLayoutPx(span, emPx, glyphPx);
    if (glyphPx > layoutW) total += glyphPx - layoutW;
  }
  return total;
}

function measureLineCharsPx(items, startIndex, endIndex) {
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
  var charPx = measureLineCharsPx(items, startIndex, endIndex);
  var halfEmAdjustPx = measureHalfEmCharAdjustPx(items, startIndex, endIndex, emPx);
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
    indentEm: getBlockIndentEm(block, emPx),
    hangPadEm: hangPadEmFromBlock(block),
    items: items,
    heads: heads,
  };
}

export function blockLineMaxEm(layout, lineIndex) {
  var range = lineItemBounds(layout.items, layout.heads, lineIndex);
  var lineEm = lineVisualWidthEm(layout, range.startIndex, range.endIndex);
  return lineMaxEm(layout.maxEm, layout.indentEm || 0, lineIndex, layout.hangPadEm || 0, lineEm);
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

/** @param {'push'|'pull'} tieBreak per-gap 差低于 HANG_STRATEGY_TIE_EPS 时采用 */
/** @returns {(pullAmountEm: number, pullGapCount: number, pushAmountEm: number, pushGapCount: number) => 'push'|'pull'|'none'} */
export function defaultStrategyDecider(tieBreak) {
  return function (pullAmountEm, pullGapCount, pushAmountEm, pushGapCount) {
    return decideHangStrategy(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount, tieBreak);
  };
}

/** @returns {{ em: string|null, usedPushFallback: boolean }} */
export function hangMarginEmPerGap(layout, startIndex, endIndex, marginOpts) {
  var none = { em: null, usedPushFallback: false };
  marginOpts = marginOpts || {};
  var pullGapCount =
    marginOpts.pullGapCount != null ? marginOpts.pullGapCount : marginOpts.gapCount;
  var pushGapCount =
    marginOpts.pushGapCount != null ? marginOpts.pushGapCount : marginOpts.gapCount;
  if (!layout) return none;
  var pullBaseEm = marginOpts.pullBaseEm != null ? marginOpts.pullBaseEm : 1;
  var pushBaseEm = marginOpts.pushBaseEm != null ? marginOpts.pushBaseEm : 1;
  var lineEm = lineVisualWidthEm(layout, startIndex, endIndex);
  var maxEm = marginOpts.maxEm != null ? marginOpts.maxEm : layout.maxEm;
  if (marginOpts.maxEm == null && marginOpts.lineIndex != null) {
    maxEm = blockLineMaxEm(layout, marginOpts.lineIndex);
  }
  var amounts = hangAmountsEm(lineEm, maxEm, pullBaseEm, pushBaseEm);
  var pullAmountEm = amounts.pullAmountEm;
  var pushAmountEm = amounts.pushAmountEm;
  var decide =
    typeof marginOpts.strategyDecider === 'function'
      ? marginOpts.strategyDecider
      : defaultStrategyDecider('pull');
  var decision = decide(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount);
  if (decision === 'none') return none;
  var usePush = decision === 'push';
  var amountEm = usePush ? pushAmountEm : pullAmountEm;
  var gapCount = usePush ? pushGapCount : pullGapCount;
  if (decision === 'pull' && amountEm <= 0) {
    return { em: '0em', usedPushFallback: false };
  }
  if (decision === 'pull' && amountEm < GAP_SHARE_MIN_EM) {
    return { em: '0em', usedPushFallback: false };
  }
  if (!(amountEm > 0) || gapCount < 1) return none;
  var share = usePush ? amountEm / gapCount - 0.001 : -amountEm / gapCount - 0.001;
  if (!isFinite(share) || Math.abs(share) < GAP_SHARE_MIN_EM) return none;
  return {
    em: share.toFixed(6).replace(/\.?0+$/, '') + 'em',
    usedPushFallback: usePush,
  };
}
