/** 量一行视觉宽：缝之间连续正文整段 Range + 空（gap pm）− 半角 span 修正；hang/surplus 用此结果 */
import { win, defaultRoot } from '../env.js';
import { parseCssLengthToEm } from '../core/dom-util.js';
import {
  isVerticalWritingMode,
  flowOf,
  rectInline,
  rectLinePos,
  rectLineThick,
  contentInlinePx,
  readCssPx,
  HANG_START_MAR,
} from '../core/flow.js';
import {
  flattenParagraph,
  findLineFirstCharIndices,
  headCharCountsFromHeads,
  lineStartsAfterBrFromHeads,
  lineEndsBeforeBrFromStarts,
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
  isLayoutWhitespace,
} from '../process/typeset-rules.js';
import { hangPadEmFromBlock } from '../process/hanging-pad.js';
import { hangConfig } from '../core/config.js';
import {
  resolveJukugoName,
  closestJukugoWrapper,
  rubyHasJukugoAttr,
  rubyPairs,
  probeJukugoRunWidthPx,
  jukugoRubiesOnLine,
  contiguousJukugoRunOnLine,
} from '../core/jukugo.js';

export { lineMaxEm };

export function getBlockEmPx(block) {
  if (!block || !win?.getComputedStyle) return 16;
  var fs = parseFloat(win.getComputedStyle(block).fontSize);
  return isFinite(fs) && fs > 0 ? fs : 16;
}

export function getBlockContentWidthPx(block) {
  return contentInlinePx(block);
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
    var marPx = span.style.getPropertyValue(HANG_START_MAR)
      ? parseCssLengthToEm(span.style.getPropertyValue(HANG_START_MAR), emPx) * emPx
      : readCssPx(span, HANG_START_MAR) || -0.5 * emPx;
    return glyphPx + marPx;
  }
  return glyphPx;
}

function measureCharGlyphWidthPx(item, emPx, vertical) {
  var w = rectInline(getItemRect(item), vertical);
  if (w > 0) return w;
  if (item && isLayoutWhitespace(item.ch)) return 0;
  return emPx;
}

/** 连续正文（不含缝）首字→末字一条 Range；避免逐字累加在 WebKit 上虚高。 */
function measureCharRunWidthPx(firstItem, lastItem, emPx, vertical) {
  if (!firstItem || firstItem.type !== 'char') return 0;
  if (!lastItem || lastItem.type !== 'char') lastItem = firstItem;
  if (firstItem === lastItem || (firstItem.node === lastItem.node && firstItem.offset === lastItem.offset)) {
    return measureCharGlyphWidthPx(firstItem, emPx, vertical);
  }
  var documentRef = firstItem.node.ownerDocument;
  if (!documentRef || !documentRef.createRange) {
    return measureCharGlyphWidthPx(firstItem, emPx, vertical);
  }
  var range = documentRef.createRange();
  range.setStart(firstItem.node, firstItem.offset);
  range.setEnd(lastItem.node, lastItem.offset + 1);
  var w = rectInline(range.getBoundingClientRect(), vertical);
  if (w > 0) return w;
  return (
    measureCharGlyphWidthPx(firstItem, emPx, vertical) +
    (lastItem === firstItem ? 0 : measureCharGlyphWidthPx(lastItem, emPx, vertical))
  );
}

function measureHalfEmCharAdjustPx(items, startIndex, endIndex, emPx, vertical) {
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
      glyphPx += measureCharGlyphWidthPx(items[j], emPx, vertical);
    }
    var layoutW = halfEmSpanLayoutPx(span, emPx, glyphPx);
    if (glyphPx > layoutW) total += glyphPx - layoutW;
  }
  return total;
}

function charItemRubyEl(item) {
  if (!item || item.type !== 'char' || !item.node || !item.node.parentElement) return null;
  var el = item.node.parentElement;
  return el.closest ? el.closest('ruby') : null;
}

function rubyFragmentWidthPx(ruby, sampleItem) {
  var vertical = isVerticalWritingMode(ruby);
  var rects = ruby.getClientRects();
  if (!rects.length) return rectInline(ruby.getBoundingClientRect(), vertical);
  if (rects.length === 1) return rectInline(rects[0], vertical);
  var sample = getItemRect(sampleItem);
  var mid = rectLinePos(sample, vertical) + rectLineThick(sample, vertical) / 2;
  var i;
  for (i = 0; i < rects.length; i++) {
    var pos = rectLinePos(rects[i], vertical);
    var thick = rectLineThick(rects[i], vertical);
    if (mid >= pos && mid <= pos + thick) return rectInline(rects[i], vertical);
  }
  var best = rects[0];
  var bestDist = Math.abs(rectLinePos(rects[0], vertical) + rectLineThick(rects[0], vertical) / 2 - mid);
  for (i = 1; i < rects.length; i++) {
    var d = Math.abs(rectLinePos(rects[i], vertical) + rectLineThick(rects[i], vertical) / 2 - mid);
    if (d < bestDist) {
      best = rects[i];
      bestDist = d;
    }
  }
  return rectInline(best, vertical);
}

function jukugoName() {
  return resolveJukugoName(hangConfig);
}

function jukugoRunWidthPx(rubies, sampleItem) {
  if (!rubies || !rubies.length) return 0;
  if (rubies.length === 1 && rubyPairs(rubies[0]).length < 2) {
    return rubyFragmentWidthPx(rubies[0], sampleItem);
  }
  return probeJukugoRunWidthPx(rubies);
}

/** 抽/推一串：ruby 整簇按这一行盒宽计一次，其余一字 1em */
export function runClusterGrossEm(items, idxs, emPx) {
  var em = 0;
  var rubySeen = [];
  var name = jukugoName();
  if (!(emPx > 0)) emPx = 1;
  var start = idxs.length ? Math.min.apply(null, idxs) : 0;
  var end = idxs.length ? Math.max.apply(null, idxs) : -1;
  for (var i = 0; i < idxs.length; i++) {
    var item = items[idxs[i]];
    if (!item || item.type !== 'char') continue;
    var ruby = charItemRubyEl(item);
    if (ruby) {
      var wrap = closestJukugoWrapper(ruby, name);
      if (wrap || (rubyHasJukugoAttr(ruby, name) && rubyPairs(ruby).length >= 2)) {
        var run = wrap
          ? contiguousJukugoRunOnLine(ruby, items, start, end, charItemRubyEl, name)
          : [ruby];
        if (!run.length) run = [ruby];
        if (run.some(function (r) { return rubySeen.indexOf(r) >= 0; })) continue;
        for (var ri = 0; ri < run.length; ri++) rubySeen.push(run[ri]);
        var jw = jukugoRunWidthPx(run, item);
        em += jw > 0 ? jw / emPx : 1;
        continue;
      }
      if (rubySeen.indexOf(ruby) >= 0) continue;
      rubySeen.push(ruby);
      var w = rubyFragmentWidthPx(ruby, item);
      em += w > 0 ? w / emPx : 1;
      continue;
    }
    em += 1;
  }
  return em;
}

export function jukugoPullDeltaEm(items, thisStart, thisEnd, pullIdxs, emPx) {
  var name = jukugoName();
  if (!(emPx > 0) || !pullIdxs || !pullIdxs.length) return 0;
  var firstPull = items[pullIdxs[0]];
  if (!firstPull || firstPull.type !== 'char') return 0;
  var pullRuby = charItemRubyEl(firstPull);
  if (!pullRuby) return 0;
  var wrap = closestJukugoWrapper(pullRuby, name);
  if (!wrap) return 0;
  if (rubyHasJukugoAttr(pullRuby, name) && rubyPairs(pullRuby).length >= 2) return 0;
  var extra = [];
  for (var i = 0; i < pullIdxs.length; i++) {
    var pr = charItemRubyEl(items[pullIdxs[i]]);
    if (!pr || closestJukugoWrapper(pr, name) !== wrap) continue;
    if (extra.indexOf(pr) >= 0) continue;
    extra.push(pr);
  }
  if (!extra.length) return 0;
  var prefix = contiguousJukugoRunOnLine(extra[0], items, thisStart, thisEnd, charItemRubyEl, name);
  if (!prefix.length) {
    var onLine = jukugoRubiesOnLine(wrap, items, thisStart, thisEnd, charItemRubyEl, name);
    var node = extra[0].previousSibling;
    while (node) {
      if (isLineGapOrWs(node)) {
        node = node.previousSibling;
        continue;
      }
      if (node.nodeType === 1 && onLine.indexOf(node) >= 0) {
        prefix.unshift(node);
        node = node.previousSibling;
        continue;
      }
      break;
    }
  }
  if (!prefix.length) return 0;
  var before = jukugoRunWidthPx(prefix, firstPull);
  var after = jukugoRunWidthPx(prefix.concat(extra), firstPull);
  var livePull = 0;
  for (var e = 0; e < extra.length; e++) livePull += rubyFragmentWidthPx(extra[e], firstPull);
  return (after - before - livePull) / emPx;
}

function isLineGapOrWs(node) {
  if (!node) return false;
  if (node.nodeType === 3) return !String(node.nodeValue || '').replace(/\s+/g, '');
  if (node.nodeType !== 1) return true;
  return !!(node.classList && node.classList.contains('ts-gap'));
}

export function jukugoPushDeltaEm(items, thisStart, thisEnd, pushIdxs, emPx) {
  var name = jukugoName();
  if (!(emPx > 0) || !pushIdxs || !pushIdxs.length) return 0;
  var lastPush = items[pushIdxs[pushIdxs.length - 1]];
  if (!lastPush || lastPush.type !== 'char') return 0;
  var pushRuby = charItemRubyEl(lastPush);
  if (!pushRuby) return 0;
  var wrap = closestJukugoWrapper(pushRuby, name);
  if (!wrap) return 0;
  if (rubyHasJukugoAttr(pushRuby, name) && rubyPairs(pushRuby).length >= 2) return 0;
  var extra = [];
  for (var i = 0; i < pushIdxs.length; i++) {
    var pr = charItemRubyEl(items[pushIdxs[i]]);
    if (!pr || closestJukugoWrapper(pr, name) !== wrap) continue;
    if (extra.indexOf(pr) >= 0) continue;
    extra.push(pr);
  }
  if (!extra.length) return 0;
  var onLine = contiguousJukugoRunOnLine(pushRuby, items, thisStart, thisEnd, charItemRubyEl, name);
  if (!onLine.length) return 0;
  var prefix = [];
  for (var j = 0; j < onLine.length; j++) {
    if (extra.indexOf(onLine[j]) < 0) prefix.push(onLine[j]);
  }
  if (!prefix.length) return 0;
  var before = jukugoRunWidthPx(prefix, lastPush);
  var after = jukugoRunWidthPx(prefix.concat(extra), lastPush);
  var livePush = 0;
  for (var e = 0; e < extra.length; e++) livePush += rubyFragmentWidthPx(extra[e], lastPush);
  return (after - before - livePush) / emPx;
}

function measureLineCharsPx(items, startIndex, endIndex, vertical, emPx) {
  var total = 0;
  var rubySeen = [];
  var name = jukugoName();
  var vert = !!vertical;
  var i = startIndex;
  while (i <= endIndex && i < items.length) {
    var item = items[i];
    if (item.type === 'gap' || item.type === 'br') {
      i += 1;
      continue;
    }
    if (item.type !== 'char') {
      i += 1;
      continue;
    }
    if (isLayoutWhitespace(item.ch)) {
      i += 1;
      continue;
    }

    var ruby = charItemRubyEl(item);
    if (ruby) {
      var wrap = closestJukugoWrapper(ruby, name);
      if (wrap || (rubyHasJukugoAttr(ruby, name) && rubyPairs(ruby).length >= 2)) {
        var jrun = wrap
          ? contiguousJukugoRunOnLine(ruby, items, startIndex, endIndex, charItemRubyEl, name)
          : [ruby];
        if (!jrun.length) jrun = [ruby];
        if (!jrun.some(function (r) { return rubySeen.indexOf(r) >= 0; })) {
          for (var ri = 0; ri < jrun.length; ri++) rubySeen.push(jrun[ri]);
          total += jukugoRunWidthPx(jrun, item);
        }
      } else if (rubySeen.indexOf(ruby) < 0) {
        rubySeen.push(ruby);
        total += rubyFragmentWidthPx(ruby, item);
      }
      i += 1;
      continue;
    }

    // 半角盒仍按盒内逐字墨宽计入（供 halfAdj 扣回布局宽）；不并进整段 Range
    var half = charItemHalfSpanEl(item);
    if (half) {
      while (i <= endIndex && i < items.length) {
        if (items[i].type !== 'char') break;
        if (charItemHalfSpanEl(items[i]) !== half) break;
        if (!isLayoutWhitespace(items[i].ch)) {
          total += measureCharGlyphWidthPx(items[i], emPx, vert);
        }
        i += 1;
      }
      continue;
    }

    // 缝 / ruby / 半角盒之间的连续正文：一条 Range
    var first = item;
    var last = item;
    i += 1;
    while (i <= endIndex && i < items.length) {
      var next = items[i];
      if (next.type === 'gap' || next.type === 'br') break;
      if (next.type !== 'char') break;
      if (charItemRubyEl(next)) break;
      if (charItemHalfSpanEl(next)) break;
      if (!isLayoutWhitespace(next.ch)) last = next;
      i += 1;
    }
    total += measureCharRunWidthPx(first, last, emPx, vert);
  }
  return total;
}

export { charItemRubyEl };

export function measureLineVisualMetricsPx(block, items, startIndex, endIndex) {
  var row = lineCharsFromItems(items, startIndex, endIndex);
  var gaps = lineGapPmSumsPx(items, startIndex, endIndex);
  var emPx = getBlockEmPx(block);
  var vertical = isVerticalWritingMode(block);
  var charPx = measureLineCharsPx(items, startIndex, endIndex, vertical, emPx);
  var halfEmAdjustPx = measureHalfEmCharAdjustPx(items, startIndex, endIndex, emPx, vertical);
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

export function buildBlockLayout(block, opts) {
  opts = opts || {};
  void block.offsetHeight;
  var emPx = opts.emPx > 0 ? opts.emPx : getBlockEmPx(block);
  var maxPx = opts.maxPx > 0 ? opts.maxPx : getBlockContentWidthPx(block);
  if (emPx <= 0 || maxPx <= 0) return null;
  var items = flattenParagraph(block);
  var vertical = opts.vertical != null ? !!opts.vertical : isVerticalWritingMode(block);
  var heads = findLineFirstCharIndices(items, vertical, opts.frozenHeadCharCounts);
  var lineStartsAfterBr = lineStartsAfterBrFromHeads(items, heads);
  return {
    block: block,
    flow: opts.flow || flowOf(block),
    emPx: emPx,
    maxPx: maxPx,
    maxEm: maxPx / emPx,
    indentEm: opts.indentEm != null ? opts.indentEm : getBlockIndentEm(block, emPx),
    hangPadEm: opts.hangPadEm != null ? opts.hangPadEm : hangPadEmFromBlock(block),
    items: items,
    heads: heads,
    headCharCounts: headCharCountsFromHeads(items, heads),
    lineStartsAfterBr: lineStartsAfterBr,
    lineEndsBeforeBr: lineEndsBeforeBrFromStarts(lineStartsAfterBr),
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

/** @param {'push'|'pull'} tieBreak 单位权差低于 HANG_STRATEGY_TIE_EPS 时采用 */
/** @returns {(pullAmountEm: number, pullGapCount: number, pushAmountEm: number, pushGapCount: number) => 'push'|'pull'|'none'} */
export function defaultStrategyDecider(tieBreak) {
  return function (pullAmountEm, pullGapCount, pushAmountEm, pushGapCount) {
    return decideHangStrategy(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount, tieBreak);
  };
}

/** @returns {{ em: string|null, usedPushFallback: boolean }}
 * em 是单位权份额；半倍空再 ×0.5。 */
export function hangMarginEmPerGap(layout, startIndex, endIndex, marginOpts) {
  var none = { em: null, usedPushFallback: false };
  marginOpts = marginOpts || {};
  var pullGapCount =
    marginOpts.pullGapCount != null ? marginOpts.pullGapCount : marginOpts.gapCount;
  var pushGapCount =
    marginOpts.pushGapCount != null ? marginOpts.pushGapCount : marginOpts.gapCount;
  var pullWeight =
    marginOpts.pullGapWeight != null ? marginOpts.pullGapWeight : pullGapCount;
  var pushWeight =
    marginOpts.pushGapWeight != null ? marginOpts.pushGapWeight : pushGapCount;
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
  var decision =
    typeof marginOpts.strategyDecider === 'function'
      ? marginOpts.strategyDecider(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount)
      : decideHangStrategy(
          pullAmountEm,
          pullGapCount,
          pushAmountEm,
          pushGapCount,
          'pull',
          pullWeight,
          pushWeight,
        );
  if (decision === 'none') return none;
  var usePush = decision === 'push';
  var amountEm = usePush ? pushAmountEm : pullAmountEm;
  var gapCount = usePush ? pushGapCount : pullGapCount;
  var weight = usePush ? pushWeight : pullWeight;
  if (decision === 'pull' && amountEm <= 0) {
    return { em: '0em', usedPushFallback: false };
  }
  if (decision === 'pull' && amountEm < GAP_SHARE_MIN_EM) {
    return { em: '0em', usedPushFallback: false };
  }
  if (!(amountEm > 0) || gapCount < 1 || !(weight > 0)) return none;
  var share = usePush ? amountEm / weight - 0.001 : -amountEm / weight - 0.001;
  if (!isFinite(share) || Math.abs(share) < GAP_SHARE_MIN_EM) return none;
  return {
    em: share.toFixed(6).replace(/\.?0+$/, '') + 'em',
    usedPushFallback: usePush,
  };
}
