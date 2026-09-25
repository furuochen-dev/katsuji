/** 第 5 步：行尾禁则（5.1）或撑行（5.2） */
import {
  lineItemBounds,
  lastSignificantCharIndexOnLine,
  collectLineEndHangGaps,
  isParagraphLastLine,
  gapElAdjacentBeforeChar,
  gapElAdjacentAfterChar,
} from '../measure/paragraph-items.js';
import {
  wrapLineEndPunct,
  charItemIsHalfPunctWrapped,
  charItemHalfPunctSpan,
  protrudeHalfPunctEnd,
  unwrapHalfSpan,
} from '../core/punct-wrap.js';
import { willMergeJukugoOnLine } from '../core/jukugo.js';
import { applyMarginToGaps, decideHangOnGaps, punctHit } from './postprocess/edge-shared.js';
import { applyComboPairsOnPullRun } from './preprocess/combo.js';
import {
  buildBlockLayout,
  measureLineVisualMetricsPx,
  blockLineMaxEm,
  runClusterGrossEm,
  jukugoPullDeltaEm,
  jukugoPushDeltaEm,
  charItemRubyEl,
} from '../measure/line-width.js';
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
  shouldWrapMovedLastHalf,
  shouldLockLineEndAfterGap,
  shouldLockLineEndBeforeGap,
  restoreLineCharsIfComboSplit,
  lineLostIntendedRun,
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

export function snapshotLinePair(layout, L) {
  if (!layout || L < 0 || L + 1 >= layout.heads.length) return null;
  var items = layout.items;
  var thisStart = layout.heads[L];
  var nextStart = layout.heads[L + 1];
  var nextEnd = L + 2 < layout.heads.length ? layout.heads[L + 2] : items.length;
  return {
    thisChars: charsOf(items, significantCharIndices(items, thisStart, nextStart)),
    nextChars: charsOf(items, significantCharIndices(items, nextStart, nextEnd)),
  };
}

function findCharRunIndices(items, start, endExcl, run) {
  if (!run || !run.length) return [];
  var idxs = significantCharIndices(items, start, endExcl);
  var chars = charsOf(items, idxs);
  var at = chars.join('').indexOf(run.join(''));
  if (at < 0) return [];
  return idxs.slice(at, at + run.length);
}

function idxBeforeSuffix(idxs, suffixLen) {
  if (idxs.length <= suffixLen) return -1;
  return idxs[idxs.length - suffixLen - 1];
}

function lockEdgeGap(el) {
  if (!el) return null;
  el.style.paddingLeft = '0';
  el.style.marginLeft = '0';
  el.setAttribute('data-ts-line-end-gap', '1');
  return el;
}

function isLockedGap(el) {
  return !!(el && el.getAttribute && el.getAttribute('data-ts-line-end-gap') === '1');
}

function withoutGap(gaps, el) {
  if (!el) return gaps;
  var out = [];
  for (var i = 0; i < gaps.length; i++) {
    if (gaps[i] !== el) out.push(gaps[i]);
  }
  return out;
}

function lockLineEndPunctGaps(items, charIdx, hangRight, hung) {
  if (charIdx == null || charIdx < 0 || !items[charIdx] || items[charIdx].type !== 'char') return;
  var ch = items[charIdx].ch;
  if (shouldLockLineEndAfterGap(ch, hangRight)) {
    lockEdgeGap(gapElAdjacentAfterChar(items, charIdx));
  }
  if (hung) lockEdgeGap(gapElAdjacentBeforeChar(items, charIdx));
}

function unlockEdgeGap(el) {
  if (!el || !el.getAttribute || el.getAttribute('data-ts-line-end-gap') !== '1') return;
  el.removeAttribute('data-ts-line-end-gap');
  el.style.paddingLeft = '';
  el.style.marginLeft = '';
}

/** 挂出去的行尾标点若已折到下行行头：拆盒、解锁缝。 */
export function restoreDisplacedHangs(block) {
  if (!block) return 0;
  var spans = block.querySelectorAll('[data-ts-hang-end="1"]');
  if (!spans.length) return 0;
  var layout = buildBlockLayout(block);
  if (!layout) return 0;
  var keep = [];
  for (var L = 0; L < layout.heads.length; L++) {
    var range = lineItemBounds(layout.items, layout.heads, L);
    var lastIdx = lastSignificantCharIndexOnLine(layout.items, range.startIndex, range.endIndex + 1);
    if (lastIdx < 0) continue;
    var span = charItemHalfPunctSpan(layout.items[lastIdx]);
    if (span && span.getAttribute('data-ts-hang-end') === '1' && keep.indexOf(span) < 0) {
      keep.push(span);
    }
  }
  var n = 0;
  for (var s = 0; s < spans.length; s++) {
    if (keep.indexOf(spans[s]) >= 0) continue;
    var prev = spans[s].previousSibling;
    var next = spans[s].nextSibling;
    while (prev && prev.nodeType === 3) prev = prev.previousSibling;
    while (next && next.nodeType === 3) next = next.nextSibling;
    if (prev && prev.classList && prev.classList.contains('ts-gap')) unlockEdgeGap(prev);
    if (next && next.classList && next.classList.contains('ts-gap')) unlockEdgeGap(next);
    unwrapHalfSpan(spans[s]);
    n += 1;
  }
  return n;
}

/** 压入后合短于行宽：剩余摊进行内缝，顶到正文右缘（不是沟）。
 * 悬挂时盒占内口 0，也靠这一摊才顶在行边进沟。
 * 抽完下行可能变成段末，仍要摊；段末短行本身不会走到第 5 步。 */
export function fillLineLeftover(layout, L, intendedThisChars) {
  var next = buildBlockLayout(layout.block);
  if (!next || L < 0 || L >= next.heads.length) return { gaps: [], addEm: 0 };
  var range = lineItemBounds(next.items, next.heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(next.items, range.startIndex, range.endIndex + 1);
  var interior = collectLineEndHangGaps(next.items, range, lastIdx, lastIdx).pushGaps;
  if (!interior.length) return { gaps: [], addEm: 0 };
  var current = charsOf(
    next.items,
    significantCharIndices(next.items, range.startIndex, range.endIndex + 1),
  );
  if (lineLostIntendedRun(current, intendedThisChars)) return { gaps: [], addEm: 0 };
  var metrics = measureLineVisualMetricsPx(next.block, next.items, range.startIndex, range.endIndex);
  var leftover = blockLineMaxEm(next, L) - metrics.lineWidthPx / next.emPx;
  if (!(leftover >= GAP_SHARE_MIN_EM)) return { gaps: [], addEm: 0 };
  var addEm = leftover / interior.length - 0.001;
  if (!(addEm >= GAP_SHARE_MIN_EM)) return { gaps: [], addEm: 0 };
  for (var g = 0; g < interior.length; g++) addGapPaddingEm(interior[g], addEm, next.emPx);
  return { gaps: interior, addEm: addEm };
}

/** 抽完或抽不动：还在行尾的可挂字仍要挂（抽上来的若是宽 ruby，UA 折不回来）。 */
function hangRemainingLineEnd(layout, L, hp) {
  if (!layout || !layout.block) return null;
  var next = buildBlockLayout(layout.block);
  if (!next || L < 0 || L >= next.heads.length) return null;
  var range = lineItemBounds(next.items, next.heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(next.items, range.startIndex, range.endIndex + 1);
  if (lastIdx < 0) return null;
  var item = next.items[lastIdx];
  if (!item || item.type !== 'char' || !isHangable(item.ch, hp.hangRight)) return null;
  var span = wrapLineEndPunct(item, hp.hangRight);
  if (!span) return null;
  if (span.getAttribute('data-ts-hang-end') === '1') return null;
  protrudeHalfPunctEnd(span);
  lockLineEndPunctGaps(next.items, lastIdx, hp.hangRight, true);
  return span;
}

export function applyLineEndOnLine(layout, L, hangOpts, lineCharsHint) {
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
  var restored =
    lineCharsHint &&
    restoreLineCharsIfComboSplit(
      lineCharsHint.thisChars,
      lineCharsHint.nextChars,
      thisChars,
      nextChars,
    );
  if (restored) {
    thisChars = restored.thisChars;
    nextChars = restored.nextChars;
    var foundThis = findCharRunIndices(items, thisStart, items.length, thisChars);
    if (foundThis.length) {
      thisIdxs = foundThis;
      var afterThis = foundThis[foundThis.length - 1] + 1;
      var foundNext = findCharRunIndices(items, afterThis, items.length, nextChars);
      if (foundNext.length) nextIdxs = foundNext;
    }
  }

  var pushCharsPlan = nextLineStartsForbidden(nextChars) ? collectPush51(thisChars) : collectPush52(thisChars);
  var newEndIdx = idxBeforeSuffix(thisIdxs, pushCharsPlan.length);
  var newEndAlreadyHalf = newEndIdx >= 0 && charItemIsHalfPunctWrapped(items[newEndIdx]);
  var hp = resolveHangingPunctuation(hangOpts && hangOpts.hangingPunctuation);
  var bases = computeLineEndBases(thisChars, nextChars, {
    newEndAlreadyHalf: newEndAlreadyHalf,
    hangRight: hp.hangRight,
  });
  var pullPlan = bases.pullChars || [];
  var pullMeasureIdxs = [];
  for (var pmi = 0; pmi < pullPlan.length; pmi++) {
    if (nextIdxs[pmi] != null) pullMeasureIdxs.push(nextIdxs[pmi]);
  }
  if (pullMeasureIdxs.length && layout.emPx > 0) {
    bases.pullBaseEm += runClusterGrossEm(items, pullMeasureIdxs, layout.emPx) - pullMeasureIdxs.length;
    bases.pullBaseEm += jukugoPullDeltaEm(
      items,
      thisStart,
      nextStart - 1,
      pullMeasureIdxs,
      layout.emPx,
    );
  }
  var pushMeasureIdxs = [];
  if (pushCharsPlan.length) {
    pushMeasureIdxs = thisIdxs.slice(-pushCharsPlan.length);
  }
  if (pushMeasureIdxs.length && layout.emPx > 0) {
    bases.pushBaseEm += runClusterGrossEm(items, pushMeasureIdxs, layout.emPx) - pushMeasureIdxs.length;
    bases.pushBaseEm += jukugoPushDeltaEm(
      items,
      thisStart,
      nextStart - 1,
      pushMeasureIdxs,
      layout.emPx,
    );
  }

  var range = lineItemBounds(items, heads, L);
  var lastIdx = lastSignificantCharIndexOnLine(items, thisStart, nextStart);
  var hangGaps = collectLineEndHangGaps(items, range, lastIdx, newEndIdx);
  var pullGaps = hangGaps.pullGaps;
  var pushGaps = hangGaps.pushGaps;
  if (newEndIdx >= 0 && items[newEndIdx] && items[newEndIdx].type === 'char') {
    if (shouldLockLineEndBeforeGap(items[newEndIdx].ch, hp.hangRight)) {
      pushGaps = withoutGap(pushGaps, gapElAdjacentBeforeChar(items, newEndIdx));
    }
  }

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
    shouldWrapMovedLastHalf([items[newEndIdx].ch], hp.hangRight);

  if (!margin && !wrapNewEnd) {
    lockLineEndPunctGaps(items, lastIdx, hp.hangRight, false);
    return false;
  }

  var charEl = null;
  var hangCh = null;
  var lockIdx = wrapNewEnd ? newEndIdx : lastIdx;
  if (wrapNewEnd) {
    hangCh = items[newEndIdx].ch;
    charEl = wrapLineEndPunct(items[newEndIdx], hp.hangRight) || null;
  } else if (margin && !margin.usedPushFallback) {
    var pullChars = bases.branch === '5.1' ? collectPull51(nextChars) : collectPull52(nextChars);
    if (pullChars.length) {
      var lastPull = nextIdxs[pullChars.length - 1];
      if (
        lastPull != null &&
        !charItemIsHalfPunctWrapped(items[lastPull]) &&
        shouldWrapMovedLastHalf([items[lastPull].ch], hp.hangRight)
      ) {
        hangCh = items[lastPull].ch;
        charEl = wrapLineEndPunct(items[lastPull], hp.hangRight) || null;
        lockIdx = lastPull;
      }
    }
  }
  var hung = false;
  if (charEl && hangCh && isHangable(hangCh, hp.hangRight)) {
    protrudeHalfPunctEnd(charEl);
    hung = true;
  }
  lockLineEndPunctGaps(items, lockIdx, hp.hangRight, hung);

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
  var unlocked = [];
  for (var ui = 0; ui < appliedGaps.length; ui++) {
    if (appliedGaps[ui] && appliedGaps[ui].parentNode && !isLockedGap(appliedGaps[ui])) {
      unlocked.push(appliedGaps[ui]);
    }
  }
  appliedGaps = unlocked;
  if (margin && margin.em && margin.em !== '0em') applyMarginToGaps(appliedGaps, margin.em);
  var fill = { gaps: [], addEm: 0 };
  if (margin && !margin.usedPushFallback && !willMergeJukugoOnLine(layout, L, hangOpts, charItemRubyEl)) {
    if (layout.block) void layout.block.offsetHeight;
    fill = fillLineLeftover(layout, L, ((restored || lineCharsHint) && (restored || lineCharsHint).thisChars) || thisChars);
    for (var f = 0; f < fill.gaps.length; f++) {
      if (appliedGaps.indexOf(fill.gaps[f]) < 0) appliedGaps.push(fill.gaps[f]);
    }
  }
  if (layout.block) void layout.block.offsetHeight;
  var remain = hangRemainingLineEnd(layout, L, hp);
  if (remain) {
    charEl = remain;
    hung = true;
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
