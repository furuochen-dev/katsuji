/** 行宽余量匀到可调缝的 padding。不进默认流水线，需要时自己调 `applyLineSurplusPaddingByVisualWidth`。 */
import { buildBlockLayout, measureLineVisualMetricsPx } from '../../measure/line-width.js';
import {
  lineItemBounds,
  collectGapsBetween,
  isHardLineEnd,
} from '../../measure/paragraph-items.js';
import { addGapPaddingEm } from '../../measure/gap-padding-margin.js';
import { wrapTrailingAfterPunctOnLine } from '../../core/punct-wrap.js';
import { applyPunctForElement, restorePunctFromConfig } from '../../core/punct-config.js';
import { gapsShareWeightSum, gapShareWeight, GAP_SHARE_MIN_EM } from '../typeset-rules.js';

function lineVisualWidthEm(layout, startIndex, endIndex) {
  return (
    measureLineVisualMetricsPx(layout.block, layout.items, startIndex, endIndex).lineWidthPx /
    layout.emPx
  );
}

function applySurplusOnLine(layout, L) {
  if (isHardLineEnd(layout, L)) return null;
  var range = lineItemBounds(layout.items, layout.heads, L);
  if (wrapTrailingAfterPunctOnLine(layout.items, range.startIndex, range.endIndex + 1)) {
    layout = buildBlockLayout(layout.block);
    if (!layout) return null;
    if (isHardLineEnd(layout, L)) return null;
    range = lineItemBounds(layout.items, layout.heads, L);
  }
  var visualEm = lineVisualWidthEm(layout, range.startIndex, range.endIndex);
  var surplusEm = layout.maxEm - visualEm;
  if (!(surplusEm > 1e-6)) return null;
  var adjGaps = collectGapsBetween(layout.items, range.startIndex, range.endIndex, {
    omitLineEnd: true,
    omitLineStart: true,
  });
  if (adjGaps.length < 1) return null;
  var weight = gapsShareWeightSum(adjGaps);
  if (!(weight > 0)) return null;
  var unitEm = surplusEm / weight - 0.0005;
  if (!(Math.abs(unitEm) >= GAP_SHARE_MIN_EM)) return null;
  for (var g = 0; g < adjGaps.length; g++) {
    addGapPaddingEm(adjGaps[g], unitEm * gapShareWeight(adjGaps[g]), layout.emPx);
  }
  return {
    lineIndex: L,
    gaps: adjGaps,
    surplusEm: surplusEm,
    addEm: unitEm,
  };
}

export function applyLineSurplusPaddingByVisualWidth(block) {
  applyPunctForElement(block);
  var layout = buildBlockLayout(block);
  if (!layout) {
    restorePunctFromConfig();
    return;
  }
  for (var L = 0; L < layout.heads.length; L++) {
    applySurplusOnLine(layout, L);
    layout = buildBlockLayout(block);
    if (!layout) {
      restorePunctFromConfig();
      return;
    }
  }
  restorePunctFromConfig();
}
