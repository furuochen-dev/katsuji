/** 第 5 步：行尾禁则（5.1）或撑行（5.2） */
import {
  lineItemBounds,
  lastSignificantCharIndexOnLine,
  collectLineEndHangGaps,
  isParagraphLastLine,
} from '../measure/paragraph-items.js';
import { AFTER_CHARS } from '../text/punctuation-rules.js';
import { wrapCharAsHalfPunct, charItemIsHalfPunctWrapped } from '../core/punct-wrap.js';
import { applyMarginToGaps, decideHangOnGaps, punctHit } from './postprocess/edge-shared.js';
import { lockComboGap } from './preprocess/combo.js';
import {
  computeLineEndBases,
  collectPull51,
  collectPush51,
  collectPull52,
  collectPush52,
  nextLineStartsForbidden,
  isLayoutWhitespace,
  comboPairKind,
} from './typeset-rules.js';

function significantCharIndices(items, start, endExcl) {
  var out = [];
  for (var i = start; i < endExcl && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    if (isLayoutWhitespace(items[i].ch)) continue;
    out.push(i);
  }
  return out;
}

function charsOf(items, idxs) {
  var out = [];
  for (var i = 0; i < idxs.length; i++) out.push(items[idxs[i]].ch);
  return out;
}

function idxBeforeSuffix(idxs, suffixLen) {
  if (idxs.length <= suffixLen) return -1;
  return idxs[idxs.length - suffixLen - 1];
}

export function applyLineEndOnLine(layout, L, hangOpts) {
  if (!layout || isParagraphLastLine(layout, L)) return false;
  var items = layout.items;
  var heads = layout.heads;
  if (L + 1 >= heads.length) return false;

  var thisStart = heads[L];
  var nextStart = heads[L + 1];
  var nextEnd = L + 2 < heads.length ? heads[L + 2] : items.length;
  var thisIdxs = significantCharIndices(items, thisStart, nextStart);
  var nextIdxs = significantCharIndices(items, nextStart, nextEnd);
  var thisChars = charsOf(items, thisIdxs);
  var nextChars = charsOf(items, nextIdxs);

  var pushCharsPlan = nextLineStartsForbidden(nextChars) ? collectPush51(thisChars) : collectPush52(thisChars);
  var newEndIdx = idxBeforeSuffix(thisIdxs, pushCharsPlan.length);
  var newEndAlreadyHalf = newEndIdx >= 0 && charItemIsHalfPunctWrapped(items[newEndIdx]);
  var bases = computeLineEndBases(thisChars, nextChars, { newEndAlreadyHalf: newEndAlreadyHalf });

  var range = lineItemBounds(items, heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(items, thisStart, nextStart);
  var hangGaps = collectLineEndHangGaps(items, range, lastIdx);
  var pullGaps = hangGaps.pullGaps;
  var pushGaps = hangGaps.pushGaps;

  var margin = decideHangOnGaps(layout, range.startIndex, range.endIndex, hangOpts, {
    pullBaseEm: bases.pullBaseEm,
    pushBaseEm: bases.pushBaseEm,
    pullGapCount: pullGaps.length,
    pushGapCount: pushGaps.length,
  });

  var wrapNewEnd =
    (!margin || margin.usedPushFallback) &&
    newEndIdx >= 0 &&
    AFTER_CHARS[items[newEndIdx].ch] &&
    !charItemIsHalfPunctWrapped(items[newEndIdx]);

  if (!margin && !wrapNewEnd) return false;

  var charEl = null;
  if (wrapNewEnd) {
    charEl = wrapCharAsHalfPunct(items[newEndIdx]) || null;
  } else if (margin && !margin.usedPushFallback) {
    var pullChars = bases.branch === '5.1' ? collectPull51(nextChars) : collectPull52(nextChars);
    if (pullChars.length) {
      var lastPull = nextIdxs[pullChars.length - 1];
      if (
        lastPull != null &&
        AFTER_CHARS[items[lastPull].ch] &&
        !charItemIsHalfPunctWrapped(items[lastPull])
      ) {
        charEl = wrapCharAsHalfPunct(items[lastPull]) || null;
      }
    }
  }

  var appliedGaps = margin
    ? margin.usedPushFallback
      ? pushGaps
      : pullGaps
    : [];
  if (margin && margin.em && margin.em !== '0em') applyMarginToGaps(appliedGaps, margin.em);
  if (margin && !margin.usedPushFallback && hangGaps.trailingGaps.length && lastIdx >= 0) {
    var pullHead = bases.pullChars && bases.pullChars[0];
    if (pullHead && comboPairKind(items[lastIdx].ch, pullHead)) {
      lockComboGap(hangGaps.trailingGaps[0]);
    }
  }
  return punctHit('line-end', L, appliedGaps, {
    branch: bases.branch,
    em: margin ? margin.em : null,
    usedPushFallback: !!(margin && margin.usedPushFallback) || !margin,
    pullBaseEm: bases.pullBaseEm,
    pushBaseEm: bases.pushBaseEm,
    charEl: charEl,
  });
}
