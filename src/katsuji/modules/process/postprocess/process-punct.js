/** 避头 / 避尾：调 ts-gap margin，必要时包半角 span（单次只改一处） */
import { buildBlockLayout, hangMarginEmPerGap } from '../../measure/line-width.js';
import {
  lineItemBounds,
  firstSignificantCharIndexOnLine,
  lastSignificantCharIndexOnLine,
  collectGapsBetween,
  gapElAdjacentAfterChar,
} from '../../measure/paragraph-items.js';
import { isForbiddenLineStart, isBadLineEndOpen, isHalfWidthLineEndPunct } from '../../text/punctuation-rules.js';
import { gapsAlreadyHavePullMargin } from '../../measure/gap-padding-margin.js';
import { wrapCharAsHalfPunct, charItemIsHalfPunctWrapped } from '../../core/punct-wrap.js';

function applyMarginToGaps(gaps, em) {
  for (var g = 0; g < gaps.length; g++) {
    gaps[g].style.paddingLeft = '0';
    gaps[g].style.marginLeft = em;
  }
}

function tryHeadPunctOnLine(layout, L) {
  var items = layout.items;
  var heads = layout.heads;
  if (L < 1) return false;

  var lineStart = heads[L];
  var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
  var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
  if (sig < 0) return false;
  if (!isForbiddenLineStart(items[sig].ch)) return false;

  var prevRange = lineItemBounds(items, heads, L - 1);
  var prevStart = prevRange.startIndex;
  var prevEnd = lineStart - 1;
  if (prevEnd < prevStart) return false;

  var gaps = collectGapsBetween(items, prevStart, prevEnd, true);
  if (gaps.length < 1) return false;
  if (charItemIsHalfPunctWrapped(items[sig]) && gapsAlreadyHavePullMargin(gaps, layout.emPx)) {
    return false;
  }

  var margin = hangMarginEmPerGap(layout, prevStart, prevEnd, {
    pullBaseEm: 0.5,
    pushBaseEm: 1,
    pullGapCount: gaps.length,
    pushGapCount: gaps.length,
  });
  if (!margin.em) return false;

  applyMarginToGaps(gaps, margin.em);
  if (!margin.usedPushFallback && !charItemIsHalfPunctWrapped(items[sig])) {
    wrapCharAsHalfPunct(items[sig]);
  }
  return true;
}

function tryTailPunctOnLine(layout, T) {
  var items = layout.items;
  var heads = layout.heads;

  var ls = heads[T];
  var nxt = T + 1 < heads.length ? heads[T + 1] : items.length;
  var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
  if (lastIdx < 0) return false;
  if (!isBadLineEndOpen(items[lastIdx].ch)) return false;

  var tailGaps = collectGapsBetween(items, ls, nxt - 1, {
    skipComboFixed: true,
    omitBesideCharIndex: lastIdx,
    requireMinAdjustableGaps: 2,
  });
  if (tailGaps.length < 1) return false;

  var tailRange = lineItemBounds(items, heads, T);
  var margin = hangMarginEmPerGap(layout, tailRange.startIndex, tailRange.endIndex, {
    pullBaseEm: 1,
    pushBaseEm: 1,
    pullGapCount: tailGaps.length,
    pushGapCount: tailGaps.length,
  });
  if (!margin.em) return false;

  applyMarginToGaps(tailGaps, margin.em);
  return true;
}

function tryLineEndPunctOnLine(layout, L) {
  var items = layout.items;
  var heads = layout.heads;
  if (heads.length >= 2 && L === heads.length - 2) return false;

  var ls = heads[L];
  var nxt = L + 1 < heads.length ? heads[L + 1] : items.length;
  var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
  if (lastIdx < 0) return false;
  if (!isHalfWidthLineEndPunct(items[lastIdx].ch)) return false;
  if (charItemIsHalfPunctWrapped(items[lastIdx])) return false;

  var range = lineItemBounds(items, heads, L);
  var gaps = collectGapsBetween(items, range.startIndex, range.endIndex, {
    skipComboFixed: true,
  });
  if (gaps.length < 1) return false;

  var margin = hangMarginEmPerGap(layout, range.startIndex, range.endIndex, {
    pullBaseEm: 1,
    pushBaseEm: 0.5,
    pullGapCount: gaps.length,
    pushGapCount: Math.max(gaps.length - 1, 0),
  });
  if (!margin.em) return false;

  var gapsToApply = gaps;
  if (margin.usedPushFallback) {
    var trailGap = gapElAdjacentAfterChar(items, lastIdx);
    if (trailGap) {
      gapsToApply = gaps.filter(function (el) {
        return el !== trailGap;
      });
    }
  }
  if (gapsToApply.length > 0) {
    applyMarginToGaps(gapsToApply, margin.em);
  }
  if (margin.usedPushFallback && !charItemIsHalfPunctWrapped(items[lastIdx])) {
    wrapCharAsHalfPunct(items[lastIdx]);
  }
  return true;
}

export function applyProcessPunct(block) {
  var layout = buildBlockLayout(block);
  if (!layout || !layout.items.length || layout.heads.length < 1) return false;
  var heads = layout.heads;
  for (var L = 0; L < heads.length; L++) {
    if (L >= 1 && tryHeadPunctOnLine(layout, L)) return true;
    if (tryTailPunctOnLine(layout, L)) return true;
    if (tryLineEndPunctOnLine(layout, L)) return true;
  }
  return false;
}
