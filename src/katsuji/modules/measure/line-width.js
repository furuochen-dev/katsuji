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

function charItemRubyEl(item) {
  if (!item || item.type !== 'char' || !item.node || !item.node.parentElement) return null;
  var el = item.node.parentElement;
  return el.closest ? el.closest('ruby') : null;
}

function rubyFragmentWidthPx(ruby, sampleItem) {
  var rects = ruby.getClientRects();
  if (!rects.length) return ruby.getBoundingClientRect().width;
  if (rects.length === 1) return rects[0].width;
  var sample = getItemRect(sampleItem);
  var midY = sample.top + sample.height / 2;
  var i;
  for (i = 0; i < rects.length; i++) {
    if (midY >= rects[i].top && midY <= rects[i].bottom) return rects[i].width;
  }
  var best = rects[0];
  var bestDist = Math.abs(rects[0].top + rects[0].height / 2 - midY);
  for (i = 1; i < rects.length; i++) {
    var d = Math.abs(rects[i].top + rects[i].height / 2 - midY);
    if (d < bestDist) {
      best = rects[i];
      bestDist = d;
    }
  }
  return best.width;
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

function measureLineCharsPx(items, startIndex, endIndex) {
  var total = 0;
  var rubySeen = [];
  var name = jukugoName();
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var ruby = charItemRubyEl(items[i]);
    if (ruby) {
      var wrap = closestJukugoWrapper(ruby, name);
      if (wrap || (rubyHasJukugoAttr(ruby, name) && rubyPairs(ruby).length >= 2)) {
        var run = wrap
          ? contiguousJukugoRunOnLine(ruby, items, startIndex, endIndex, charItemRubyEl, name)
          : [ruby];
        if (!run.length) run = [ruby];
        if (run.some(function (r) { return rubySeen.indexOf(r) >= 0; })) continue;
        for (var ri = 0; ri < run.length; ri++) rubySeen.push(run[ri]);
        total += jukugoRunWidthPx(run, items[i]);
        continue;
      }
      if (rubySeen.indexOf(ruby) >= 0) continue;
      rubySeen.push(ruby);
      total += rubyFragmentWidthPx(ruby, items[i]);
      continue;
    }
    total += getItemRect(items[i]).width;
  }
  return total;
}

export { charItemRubyEl };

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
