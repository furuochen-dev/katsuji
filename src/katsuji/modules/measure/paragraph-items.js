/** 段落 → 行项序列（char/gap）+ 视觉分行 + 按界收 gap */
import { doc } from '../env.js';
import { shouldSkipTextParent } from '../core/dom-util.js';
import { rectLinePos, rectLineThick } from '../core/flow.js';

export function flattenParagraph(block) {
  var items = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (shouldSkipTextParent(node.parentElement)) return;
      var tv = node.nodeValue;
      for (var j = 0; j < tv.length; j++) {
        items.push({ type: 'char', node: node, offset: j, ch: tv.charAt(j) });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    var tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return;
    if (tag === 'RT' || tag === 'RP' || tag === 'RTC') return;
    if (tag === 'BR') {
      // 作者 <br>：硬断行界。引擎自插的 br.ts-br 不记入 item 流。
      if (!(node.classList && node.classList.contains('ts-br'))) {
        items.push({ type: 'br', el: node });
      }
      return;
    }
    if (node.classList && node.classList.contains('ts-gap')) {
      items.push({ type: 'gap', el: node });
      return;
    }
    var c = node.firstChild;
    while (c) {
      walk(c);
      c = c.nextSibling;
    }
  }

  var ch = block.firstChild;
  while (ch) {
    walk(ch);
    ch = ch.nextSibling;
  }
  return items;
}

function isHeadChar(ch) {
  return ch !== '\n' && ch !== '\r' && ch !== ' ' && ch !== '\t' && ch !== '\u00a0' && ch !== '\u3000';
}

export function significantCharCountBefore(items, itemIndex) {
  var n = 0;
  var end = itemIndex < 0 ? items.length : Math.min(itemIndex, items.length);
  for (var i = 0; i < end; i++) {
    if (items[i].type !== 'char') continue;
    if (!isHeadChar(items[i].ch)) continue;
    n++;
  }
  return n;
}

export function itemIndexAtSignificantChar(items, charCount) {
  var n = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    if (!isHeadChar(items[i].ch)) continue;
    if (n === charCount) return i;
    n++;
  }
  return -1;
}

export function headCharCountsFromHeads(items, heads) {
  var out = [];
  for (var i = 0; i < heads.length; i++) out.push(significantCharCountBefore(items, heads[i]));
  return out;
}

var measureRange = null;

export function getItemRect(item) {
  if (item.type === 'char') {
    var documentRef = item.node.ownerDocument || doc;
    if (!measureRange || measureRange.startContainer.ownerDocument !== documentRef) {
      measureRange = documentRef.createRange();
    }
    var range = measureRange;
    range.setStart(item.node, item.offset);
    range.setEnd(item.node, item.offset + 1);
    var r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      range.setStart(item.node, item.offset);
      range.setEnd(item.node, Math.min(item.offset + 1, item.node.nodeValue.length));
      r = range.getBoundingClientRect();
    }
    return r;
  }
  return item.el.getBoundingClientRect();
}

function measureHeadsFrom(items, vertical, startAt, prefixHeads) {
  var heads = prefixHeads ? prefixHeads.slice() : [];
  var prevPos = null;
  var prevThick = 0;
  var vert = !!vertical;
  for (var i = startAt; i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    if (!isHeadChar(items[i].ch)) continue;
    var r = getItemRect(items[i]);
    if (prevPos === null) {
      heads.push(i);
    } else {
      var thick = rectLineThick(r, vert);
      var tol = Math.max(5, Math.max(thick, prevThick) * 0.35);
      if (Math.abs(rectLinePos(r, vert) - prevPos) > tol) heads.push(i);
    }
    prevPos = rectLinePos(r, vert);
    prevThick = rectLineThick(r, vert);
  }
  var kept = [];
  for (var L = 0; L < heads.length; L++) {
    var lineEnd = L + 1 < heads.length ? heads[L + 1] : items.length;
    if (firstSignificantCharIndexOnLine(items, heads[L], lineEnd) >= 0) kept.push(heads[L]);
  }
  return kept;
}

/** frozenHeadCharCounts：已排完行的行头（第几个实字）。从最后一项起重新量。 */
export function findLineFirstCharIndices(items, vertical, frozenHeadCharCounts) {
  var frozen = frozenHeadCharCounts && frozenHeadCharCounts.length ? frozenHeadCharCounts : null;
  if (frozen) {
    var prefix = [];
    var ok = true;
    for (var f = 0; f < frozen.length; f++) {
      var idx = itemIndexAtSignificantChar(items, frozen[f]);
      if (idx < 0) {
        ok = false;
        break;
      }
      prefix.push(idx);
    }
    if (ok) {
      return measureHeadsFrom(items, vertical, prefix[prefix.length - 1], prefix.slice(0, -1));
    }
  }
  return measureHeadsFrom(items, vertical, 0, []);
}

export function lineItemBounds(items, heads, lineIndex) {
  var startIndex = lineIndex <= 0 ? 0 : heads[lineIndex];
  var endIndex = lineIndex + 1 < heads.length ? heads[lineIndex + 1] - 1 : items.length - 1;
  return { lineIndex: lineIndex, startIndex: startIndex, endIndex: endIndex };
}

export function isParagraphFirstLine(L) {
  return L === 0;
}

export function isParagraphLastLine(layout, L) {
  for (var i = layout.heads.length - 1; i >= 0; i--) {
    var range = lineItemBounds(layout.items, layout.heads, i);
    if (firstSignificantCharIndexOnLine(layout.items, range.startIndex, range.endIndex + 1) >= 0) {
      return L === i;
    }
  }
  return false;
}

/** 行头之前的 item 流里是否夹着作者 <br>（相对上一行头）。 */
export function lineStartsAfterBrFromHeads(items, heads) {
  var out = [];
  for (var L = 0; L < heads.length; L++) {
    var from = L === 0 ? 0 : heads[L - 1];
    var to = heads[L];
    var after = false;
    for (var i = from; i < to; i++) {
      if (items[i].type === 'br') {
        after = true;
        break;
      }
    }
    out.push(after);
  }
  return out;
}

export function lineEndsBeforeBrFromStarts(lineStartsAfterBr) {
  var out = [];
  for (var L = 0; L < lineStartsAfterBr.length; L++) {
    out.push(L + 1 < lineStartsAfterBr.length ? !!lineStartsAfterBr[L + 1] : false);
  }
  return out;
}

/** 段末，或作者 <br> 前一行：同硬断行尾，不做第 5 / 5′。 */
export function isHardLineEnd(layout, L) {
  if (!layout) return false;
  if (layout.lineEndsBeforeBr && layout.lineEndsBeforeBr[L]) return true;
  return isParagraphLastLine(layout, L);
}

export function lineCharsFromItems(items, startIndex, endIndex) {
  var text = '';
  var count = 0;
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    text += items[i].ch;
    count++;
  }
  return { text: text, charCount: count };
}

export function firstSignificantCharIndexOnLine(items, lineStart, lineEnd) {
  for (var i = lineStart; i < lineEnd && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var ch = items[i].ch;
    if (!isHeadChar(ch)) continue;
    return i;
  }
  return -1;
}

export function lastSignificantCharIndexOnLine(items, lineStart, lineEndExcl) {
  var end = Math.min(lineEndExcl, items.length);
  for (var i = end - 1; i >= lineStart; i--) {
    if (items[i].type !== 'char') continue;
    var ch2 = items[i].ch;
    if (!isHeadChar(ch2)) continue;
    return i;
  }
  return -1;
}

export function gapElAdjacentBeforeChar(items, charIndex) {
  if (charIndex > 0 && items[charIndex - 1].type === 'gap') return items[charIndex - 1].el;
  return null;
}

export function gapElAdjacentAfterChar(items, charIndex) {
  if (charIndex + 1 < items.length && items[charIndex + 1].type === 'gap') {
    return items[charIndex + 1].el;
  }
  return null;
}

export function lastAdjustableGapElInRange(items, startIncl, endIncl) {
  for (var j = endIncl; j >= startIncl && j < items.length; j--) {
    if (items[j].type !== 'gap') continue;
    return items[j].el;
  }
  return null;
}

export function collectGapsBetween(items, startIncl, endIncl, opts) {
  opts = opts || {};
  var end = endIncl;
  if (opts.omitLineEnd && end >= startIncl && items[end].type === 'gap') end--;
  if (opts.omitLineStart && startIncl <= end && items[startIncl].type === 'gap') {
    startIncl += 1;
  }
  if (end < startIncl) return [];

  var omitGapEl = opts.omitGapEl || null;
  if (opts.omitBesideCharIndex != null && opts.omitBesideCharIndex >= 0) {
    omitGapEl =
      gapElAdjacentBeforeChar(items, opts.omitBesideCharIndex) ||
      lastAdjustableGapElInRange(items, startIncl, end);
  }

  var out = [];
  for (var j = startIncl; j <= end && j < items.length; j++) {
    if (items[j].type !== 'gap') continue;
    if (items[j].el.getAttribute('data-ts-line-start-open-gap') === '1') continue;
    if (items[j].el.getAttribute('data-ts-line-end-gap') === '1') continue;
    out.push(items[j].el);
  }

  if (opts.requireMinAdjustableGaps != null && out.length < opts.requireMinAdjustableGaps) {
    return [];
  }
  if (!omitGapEl) return out;

  var filtered = [];
  for (var k = 0; k < out.length; k++) {
    if (out[k] === omitGapEl) continue;
    filtered.push(out[k]);
  }
  return filtered;
}

/**
 * 第 5 步可调缝：压入、推出都只走行内；行尾后面那条不摊。
 * 推出行最末按推完留下来的最后一字（stayEndIdx）算。
 * @param {number} [stayEndIdx] 推完后留在本行的最后一字；缺省等于 lastIdx
 */
export function collectLineEndHangGaps(items, range, lastIdx, stayEndIdx) {
  var interiorGaps = [];
  var trailingGaps = [];
  var pushGaps = [];
  if (lastIdx >= 0 && range) {
    interiorGaps = collectGapsBetween(items, range.startIndex, lastIdx, {
      omitLineStart: true,
    });
    trailingGaps = collectGapsBetween(items, lastIdx + 1, range.endIndex, {});
  }
  var pushEnd = stayEndIdx != null ? stayEndIdx : lastIdx;
  if (pushEnd >= 0 && range) {
    pushGaps = collectGapsBetween(items, range.startIndex, pushEnd, {
      omitLineStart: true,
    });
  }
  return {
    interiorGaps: interiorGaps,
    trailingGaps: trailingGaps,
    pullGaps: interiorGaps,
    pushGaps: pushGaps,
  };
}
