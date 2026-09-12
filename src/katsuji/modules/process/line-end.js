/** 第 5 步：行尾禁则（5.1）或撑行（5.2） */
import {
  lineItemBounds,
  lastSignificantCharIndexOnLine,
  collectLineEndHangGaps,
  isParagraphLastLine,
} from '../measure/paragraph-items.js';
import { AFTER_CHARS } from '../text/punctuation-rules.js';
import { wrapCharAsHalfPunct, charItemIsHalfPunctWrapped, protrudeHalfPunctEnd } from '../core/punct-wrap.js';
import { applyMarginToGaps, decideHangOnGaps, punctHit } from './postprocess/edge-shared.js';
import { applyComboPairsOnPullRun } from './preprocess/combo.js';
import { buildBlockLayout, measureLineVisualMetricsPx, blockLineMaxEm } from '../measure/line-width.js';
import { addGapPaddingEm } from '../measure/gap-padding-margin.js';
import {
  computeLineEndBases,
  collectPull51,
  collectPush51,
  collectPull52,
  collectPush52,
  nextLineStartsForbidden,
  isLayoutWhitespace,
  resolveHangingPunctuation,
  isHangable,
  GAP_SHARE_MIN_EM,
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

/** 压入后合短于行宽：剩余摊进行内缝，顶到正文右缘（不是沟）。
 * 悬挂时盒占内口 0，也靠这一摊才顶在行边进沟。
 * 抽完下行可能变成段末，仍要摊；段末短行本身不会走到第 5 步。 */
function fillLineLeftover(layout, L) {
  var next = buildBlockLayout(layout.block);
  if (!next || L < 0 || L >= next.heads.length) return { gaps: [], addEm: 0 };
  var range = lineItemBounds(next.items, next.heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(next.items, range.startIndex, range.endIndex + 1);
  var interior = collectLineEndHangGaps(next.items, range, lastIdx, lastIdx).pushGaps;
  if (!interior.length) return { gaps: [], addEm: 0 };
  var visualEm =
    measureLineVisualMetricsPx(next.block, next.items, range.startIndex, range.endIndex).lineWidthPx /
    next.emPx;
  var leftover = blockLineMaxEm(next, L) - visualEm;
  if (!(leftover >= GAP_SHARE_MIN_EM)) return { gaps: [], addEm: 0 };
  var addEm = leftover / interior.length - 0.001;
  if (!(addEm >= GAP_SHARE_MIN_EM)) return { gaps: [], addEm: 0 };
  for (var g = 0; g < interior.length; g++) addGapPaddingEm(interior[g], addEm, next.emPx);
  return { gaps: interior, addEm: addEm };
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
  var hp = resolveHangingPunctuation(hangOpts && hangOpts.hangingPunctuation);
  var bases = computeLineEndBases(thisChars, nextChars, {
    newEndAlreadyHalf: newEndAlreadyHalf,
    hangRight: hp.hangRight,
  });

  var range = lineItemBounds(items, heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(items, thisStart, nextStart);
  var hangGaps = collectLineEndHangGaps(items, range, lastIdx, newEndIdx);
  var pullGaps = hangGaps.pullGaps;
  var pushGaps = hangGaps.pushGaps;

  var margin = decideHangOnGaps(layout, range.startIndex, range.endIndex, hangOpts, {
    pullBaseEm: bases.pullBaseEm,
    pushBaseEm: bases.pushBaseEm,
    pullGapCount: pullGaps.length,
    pushGapCount: pushGaps.length,
    lineIndex: L,
  });

  var wrapNewEnd =
    (!margin || margin.usedPushFallback) &&
    newEndIdx >= 0 &&
    AFTER_CHARS[items[newEndIdx].ch] &&
    !charItemIsHalfPunctWrapped(items[newEndIdx]);

  if (!margin && !wrapNewEnd) return false;

  var charEl = null;
  var hangCh = null;
  if (wrapNewEnd) {
    hangCh = items[newEndIdx].ch;
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
        hangCh = items[lastPull].ch;
        charEl = wrapCharAsHalfPunct(items[lastPull]) || null;
      }
    }
  }
  if (charEl && hangCh && isHangable(hangCh, hp.hangRight)) {
    protrudeHalfPunctEnd(charEl);
  }

  var appliedGaps = margin
    ? margin.usedPushFallback
      ? pushGaps
      : pullGaps
    : [];
  if (margin && !margin.usedPushFallback) {
    var pullIdxs = [];
    var pullLen = (bases.pullChars || []).length;
    for (var pi = 0; pi < pullLen; pi++) {
      if (nextIdxs[pi] != null) pullIdxs.push(nextIdxs[pi]);
    }
    applyComboPairsOnPullRun(items, lastIdx, pullIdxs);
    var still = [];
    for (var gi = 0; gi < appliedGaps.length; gi++) {
      if (appliedGaps[gi] && appliedGaps[gi].parentNode) still.push(appliedGaps[gi]);
    }
    appliedGaps = still;
  }
  if (margin && margin.em && margin.em !== '0em') applyMarginToGaps(appliedGaps, margin.em);
  var fill = { gaps: [], addEm: 0 };
  if (margin && !margin.usedPushFallback) {
    fill = fillLineLeftover(layout, L);
    for (var f = 0; f < fill.gaps.length; f++) {
      if (appliedGaps.indexOf(fill.gaps[f]) < 0) appliedGaps.push(fill.gaps[f]);
    }
  }
  return punctHit('line-end', L, appliedGaps, {
    branch: bases.branch,
    em: margin ? margin.em : null,
    usedPushFallback: !!(margin && margin.usedPushFallback) || !margin,
    pullBaseEm: bases.pullBaseEm,
    pushBaseEm: bases.pushBaseEm,
    fillEm: fill.addEm || null,
    charEl: charEl,
  });
}
