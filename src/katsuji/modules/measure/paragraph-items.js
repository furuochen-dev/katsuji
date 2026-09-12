/** 段落 → 行项序列（char/gap）+ 视觉分行 + 按界收 gap */
import { doc } from '../env.js';
import { shouldSkipTextParent } from '../core/dom-util.js';

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
    if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA' || node.tagName === 'NOSCRIPT')
      return;
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

export function getItemRect(item) {
  if (item.type === 'char') {
    var documentRef = item.node.ownerDocument || doc;
    var range = documentRef.createRange();
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

export function findLineFirstCharIndices(items) {
  var heads = [];
  var prevTop = null;
  var prevH = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var r = getItemRect(items[i]);
    if (prevTop === null) {
      heads.push(i);
    } else {
      var tol = Math.max(5, Math.max(r.height, prevH) * 0.35);
      if (Math.abs(r.top - prevTop) > tol) heads.push(i);
    }
    prevTop = r.top;
    prevH = r.height;
  }
  var kept = [];
  for (var L = 0; L < heads.length; L++) {
    var lineEnd = L + 1 < heads.length ? heads[L + 1] : items.length;
    if (firstSignificantCharIndexOnLine(items, heads[L], lineEnd) >= 0) kept.push(heads[L]);
  }
  return kept;
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
    if (ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') {
      continue;
    }
    return i;
  }
  return -1;
}

export function lastSignificantCharIndexOnLine(items, lineStart, lineEndExcl) {
  var end = Math.min(lineEndExcl, items.length);
  for (var i = end - 1; i >= lineStart; i--) {
    if (items[i].type !== 'char') continue;
    var ch2 = items[i].ch;
    if (ch2 === '\n' || ch2 === '\r' || ch2 === ' ' || ch2 === '\t' || ch2 === '\u00a0' || ch2 === '\u3000') {
      continue;
    }
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
 * 第 5 步可调缝：压入含行尾 `后有空` 后面那条（抽上来后变接缝）；
 * 推出只动行内，行最末按推完留下来的最后一字（stayEndIdx）算。
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
    pullGaps: interiorGaps.concat(trailingGaps),
    pushGaps: pushGaps,
  };
}
