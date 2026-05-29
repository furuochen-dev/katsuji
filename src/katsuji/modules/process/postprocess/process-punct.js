/** 避头 / 避尾：调 ts-gap margin，必要时包半角 span（单次只改一处） */
import { hangConfig } from '../../core/config.js';
import { buildBlockLayout, hangMarginEmPerGap } from '../../measure/line-width.js';
import {
  lineItemBounds,
  firstSignificantCharIndexOnLine,
  lastSignificantCharIndexOnLine,
  collectGapsBetween,
} from '../../measure/paragraph-items.js';
import { isForbiddenLineStart, isBadLineEndOpen } from '../../text/punctuation-rules.js';
import { gapsAlreadyHavePullMargin } from '../../measure/gap-padding-margin.js';
import {
  wrapCharAsHalfPunct,
  wrapCharAsLineEndHalf,
  charItemIsHalfPunctWrapped,
  charItemIsLineEndHalfWrapped,
} from '../../core/punct-wrap.js';

function applyMarginToGaps(gaps, em) {
  for (var g = 0; g < gaps.length; g++) {
    gaps[g].style.paddingLeft = '0';
    gaps[g].style.marginLeft = em;
  }
}

function tryHeadPunctOnce(layout, hangOpts) {
  var debugWholeCharPush = !!hangOpts.debugWholeCharPush;
  var items = layout.items;
  var heads = layout.heads;
  if (heads.length < 2) return false;

  for (var L = 1; L < heads.length; L++) {
    var lineStart = heads[L];
    var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
    var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
    if (sig < 0) continue;
    if (!isForbiddenLineStart(items[sig].ch)) continue;

    var prevRange = lineItemBounds(items, heads, L - 1);
    var prevStart = prevRange.startIndex;
    var prevEnd = lineStart - 1;
    if (prevEnd < prevStart) continue;

    var gaps = collectGapsBetween(items, prevStart, prevEnd, true);
    if (gaps.length < 1) continue;
    if (
      !debugWholeCharPush &&
      charItemIsHalfPunctWrapped(items[sig]) &&
      gapsAlreadyHavePullMargin(gaps, layout.emPx)
    ) {
      continue;
    }

    var margin = hangMarginEmPerGap(layout, prevStart, prevEnd, gaps.length, {
      pullBaseEm: 0.5,
      pushBaseEm: 1,
    });
    if (!margin.em) continue;

    applyMarginToGaps(gaps, margin.em);
    if (!debugWholeCharPush && !margin.usedPushFallback && !charItemIsHalfPunctWrapped(items[sig])) {
      wrapCharAsHalfPunct(items[sig]);
    }
    return true;
  }
  return false;
}

function tryTailPunctOnce(layout, hangOpts) {
  var debugWholeCharPush = !!hangOpts.debugWholeCharPush;
  var items = layout.items;
  var heads = layout.heads;

  for (var T = 0; T < heads.length; T++) {
    var ls = heads[T];
    var nxt = T + 1 < heads.length ? heads[T + 1] : items.length;
    var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
    if (lastIdx < 0) continue;
    if (!isBadLineEndOpen(items[lastIdx].ch)) continue;

    var tailGaps = collectGapsBetween(items, ls, nxt - 1, {
      skipComboFixed: true,
      omitBesideCharIndex: lastIdx,
      requireMinAdjustableGaps: 2,
    });
    if (tailGaps.length < 1) continue;

    var tailRange = lineItemBounds(items, heads, T);
    var margin = hangMarginEmPerGap(layout, tailRange.startIndex, tailRange.endIndex, tailGaps.length, {
      pullBaseEm: 1,
      pushBaseEm: 1,
    });
    if (!margin.em) continue;

    applyMarginToGaps(tailGaps, margin.em);
    if (debugWholeCharPush && !charItemIsLineEndHalfWrapped(items[lastIdx])) {
      wrapCharAsLineEndHalf(items[lastIdx]);
    }
    return true;
  }
  return false;
}

export function applyProcessPunct(block, hangOpts) {
  hangOpts = hangOpts || hangConfig;
  var layout = buildBlockLayout(block);
  if (!layout || !layout.items.length || layout.heads.length < 1) return false;
  return tryHeadPunctOnce(layout, hangOpts) || tryTailPunctOnce(layout, hangOpts);
}
