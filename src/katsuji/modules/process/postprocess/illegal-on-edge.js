/** 行边界的非法符号：行首 `不能在行头`；行尾 `前有空` */
import {
  lineItemBounds,
  firstSignificantCharIndexOnLine,
  lastSignificantCharIndexOnLine,
  collectGapsBetween,
} from '../../measure/paragraph-items.js';
import { isIllegalOnEdgeStart, isIllegalOnEdgeEnd, AFTER_CHARS } from '../../text/punctuation-rules.js';
import { wrapCharAsHalfPunct, charItemIsHalfPunctWrapped, wrapTrailingAfterPunctOnLine } from '../../core/punct-wrap.js';
import { gapsAlreadyHavePullMargin } from '../../measure/gap-padding-margin.js';
import { applyHangToGaps, applyMarginToGaps, decideHangOnGaps, punctHit } from './edge-shared.js';

function illegalStartRunEm(items, sig, lineEnd) {
  var em = 0;
  for (var i = sig; i < lineEnd && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var ch = items[i].ch;
    if (ch === '\n' || ch === '\r') continue;
    if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') break;
    if (!isIllegalOnEdgeStart(ch)) break;
    em += AFTER_CHARS[ch] ? 0.5 : 1;
  }
  return em > 0 ? em : 1;
}

/** 行首是 `不能在行头`：改上一行的缝。`后有空` 且挤进时包半角盒 */
export function tryIllegalOnEdgeStart(layout, L, hangOpts) {
  var items = layout.items;
  var heads = layout.heads;
  if (L < 1) return false;

  var lineStart = heads[L];
  var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
  var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
  if (sig < 0) return false;
  if (!isIllegalOnEdgeStart(items[sig].ch)) return false;

  var prevRange = lineItemBounds(items, heads, L - 1);
  var prevStart = prevRange.startIndex;
  var prevEnd = lineStart - 1;
  if (prevEnd < prevStart) return false;

  var gaps = collectGapsBetween(items, prevStart, prevEnd, true);
  if (gaps.length < 1) return false;
  if (gapsAlreadyHavePullMargin(gaps, layout.emPx)) {
    return false;
  }

  var sigCh = items[sig].ch;
  var margin = decideHangOnGaps(layout, prevStart, prevEnd, hangOpts, {
    pullBaseEm: illegalStartRunEm(items, sig, nextLineStart),
    pushBaseEm: 1,
    pullGapCount: gaps.length,
    pushGapCount: gaps.length,
  });
  if (!margin) return false;

  var charEl = null;
  if (margin.usedPushFallback) {
    charEl = wrapTrailingAfterPunctOnLine(items, prevStart, lineStart);
  } else if (AFTER_CHARS[sigCh] && !charItemIsHalfPunctWrapped(items[sig])) {
    charEl = wrapCharAsHalfPunct(items[sig]) || null;
  }
  applyMarginToGaps(gaps, margin.em);
  return punctHit('illegal-start', L, gaps, {
    ch: sigCh,
    em: margin.em,
    usedPushFallback: margin.usedPushFallback,
    charEl: charEl,
  });
}

/** 行尾是 `前有空`：只改本行的缝，不包半角盒 */
export function tryIllegalOnEdgeEnd(layout, L, hangOpts) {
  var items = layout.items;
  var heads = layout.heads;

  var ls = heads[L];
  var nxt = L + 1 < heads.length ? heads[L + 1] : items.length;
  var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
  if (lastIdx < 0) return false;
  if (!isIllegalOnEdgeEnd(items[lastIdx].ch)) return false;

  var gaps = collectGapsBetween(items, ls, nxt - 1, {
    skipComboFixed: true,
    omitBesideCharIndex: lastIdx,
    requireMinAdjustableGaps: 2,
  });
  if (gaps.length < 1) return false;

  var range = lineItemBounds(items, heads, L);
  var margin = applyHangToGaps(layout, range.startIndex, range.endIndex, gaps, hangOpts, {
    pullBaseEm: 1,
    pushBaseEm: 1,
    pullGapCount: gaps.length,
    pushGapCount: gaps.length,
  });
  if (!margin) return false;

  return punctHit('illegal-end', L, gaps, {
    ch: items[lastIdx].ch,
    em: margin.em,
    usedPushFallback: margin.usedPushFallback,
  });
}

export function applyIllegalOnEdge(layout, hangOpts) {
  var heads = layout.heads;
  for (var L = 0; L < heads.length; L++) {
    var hit = tryIllegalOnEdgeStart(layout, L, hangOpts);
    if (hit) return hit;
    hit = tryIllegalOnEdgeEnd(layout, L, hangOpts);
    if (hit) return hit;
  }
  return false;
}
