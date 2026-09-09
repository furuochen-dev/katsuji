/** 行边界的空：行首 `前有空` 顶格；行尾 `后有空` 占半宽 */
import {
  lineItemBounds,
  firstSignificantCharIndexOnLine,
  lastSignificantCharIndexOnLine,
  collectGapsBetween,
  gapElAdjacentBeforeChar,
} from '../../measure/paragraph-items.js';
import { isSpaceOnEdgeStart, isSpaceOnEdgeEnd, isIllegalOnEdgeEnd } from '../../text/punctuation-rules.js';
import {
  wrapCharAsLineStartOpen,
  charItemIsHalfPunctWrapped,
  glueLineStartOpenToNext,
  wrapTrailingAfterPunctOnLine,
} from '../../core/punct-wrap.js';
import {
  applyMarginToGaps,
  punctHit,
  decideHangOnGaps,
} from './edge-shared.js';

/** 行首是 `前有空`：去掉前空，0.5em 盒只露右边的墨 */
export function trySpaceOnEdgeStart(layout, L) {
  var items = layout.items;
  var heads = layout.heads;
  var lineStart = heads[L];
  var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
  var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
  if (sig < 0) return false;
  if (!isSpaceOnEdgeStart(items[sig].ch)) return false;
  if (charItemIsHalfPunctWrapped(items[sig])) return false;

  var openGap = gapElAdjacentBeforeChar(items, sig);
  if (openGap) {
    openGap.style.paddingLeft = '0';
    openGap.style.marginLeft = '0';
    openGap.setAttribute('data-ts-line-start-open-gap', '1');
  }
  var charEl = wrapCharAsLineStartOpen(items[sig]) || null;
  if (!charEl && !openGap) return false;
  if (L >= 1 && charEl) glueLineStartOpenToNext(charEl);
  return punctHit('space-start', L, openGap ? [openGap] : [], {
    ch: items[sig].ch,
    charEl: charEl,
  });
}

/** 行尾是 `后有空`：挤或推缝；推出时半角盒字靠左 */
export function trySpaceOnEdgeEnd(layout, L, hangOpts) {
  var items = layout.items;
  var heads = layout.heads;

  var ls = heads[L];
  var nxt = L + 1 < heads.length ? heads[L + 1] : items.length;
  var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
  if (lastIdx < 0) return false;
  if (L === heads.length - 1) return false;
  if (!isSpaceOnEdgeEnd(items[lastIdx].ch)) return false;
  if (charItemIsHalfPunctWrapped(items[lastIdx])) return false;

  var range = lineItemBounds(items, heads, L);
  var interiorGaps = collectGapsBetween(items, range.startIndex, lastIdx, {
    skipComboFixed: true,
  });
  var trailingGaps = collectGapsBetween(items, lastIdx + 1, range.endIndex, {
    skipComboFixed: true,
  });
  var pullGaps = interiorGaps.concat(trailingGaps);
  if (pullGaps.length < 1) return false;

  var pullGapCount = pullGaps.length;
  if (L + 1 < heads.length) {
    var nextEnd = L + 2 < heads.length ? heads[L + 2] : items.length;
    var nextSig = firstSignificantCharIndexOnLine(items, nxt, nextEnd);
    // 挤进会把下一行行首抽到本行行尾；下一行开头是 `前有空` 就不能挤，改推
    if (nextSig >= 0 && isIllegalOnEdgeEnd(items[nextSig].ch)) pullGapCount = 0;
  }

  var margin = decideHangOnGaps(layout, range.startIndex, range.endIndex, hangOpts, {
    pullBaseEm: 1,
    pushBaseEm: 0.5,
    pullGapCount: pullGapCount,
    pushGapCount: interiorGaps.length,
  });
  if (!margin) return false;

  var gapsToApply = margin.usedPushFallback ? interiorGaps : pullGaps;
  var charEl = null;
  if (margin.usedPushFallback) {
    charEl = wrapTrailingAfterPunctOnLine(items, ls, nxt);
  }
  if (gapsToApply.length > 0) {
    applyMarginToGaps(gapsToApply, margin.em);
  }
  return punctHit('space-end', L, gapsToApply, {
    ch: items[lastIdx].ch,
    em: margin.em,
    usedPushFallback: margin.usedPushFallback,
    charEl: charEl,
  });
}

export function applySpaceOnEdge(layout, hangOpts) {
  var heads = layout.heads;
  for (var L = 0; L < heads.length; L++) {
    var hit = trySpaceOnEdgeStart(layout, L);
    if (hit) return hit;
    hit = trySpaceOnEdgeEnd(layout, L, hangOpts);
    if (hit) return hit;
  }
  return false;
}
