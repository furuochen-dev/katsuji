/** 行宽余量匀到可调缝的 padding。不进默认流水线，需要时自己调 `applyLineSurplusPaddingByVisualWidth`。 */
import { buildBlockLayout, measureLineVisualMetricsPx } from '../../measure/line-width.js';
import {
  lineItemBounds,
  collectGapsBetween,
  isParagraphLastLine,
} from '../../measure/paragraph-items.js';
import { addGapPaddingEm } from '../../measure/gap-padding-margin.js';
import { wrapTrailingAfterPunctOnLine } from '../../core/punct-wrap.js';

function lineVisualWidthEm(layout, startIndex, endIndex) {
  return (
    measureLineVisualMetricsPx(layout.block, layout.items, startIndex, endIndex).lineWidthPx /
    layout.emPx
  );
}

function applySurplusOnLine(layout, L) {
  if (isParagraphLastLine(layout, L)) return null;
  var range = lineItemBounds(layout.items, layout.heads, L);
  if (wrapTrailingAfterPunctOnLine(layout.items, range.startIndex, range.endIndex + 1)) {
    layout = buildBlockLayout(layout.block);
    if (!layout) return null;
    if (isParagraphLastLine(layout, L)) return null;
    range = lineItemBounds(layout.items, layout.heads, L);
  }
  var visualEm = lineVisualWidthEm(layout, range.startIndex, range.endIndex);
  var surplusEm = layout.maxEm - visualEm;
  if (!(surplusEm > 1e-6)) return null;
  var adjGaps = collectGapsBetween(layout.items, range.startIndex, range.endIndex, {
    skipComboFixed: true,
    omitLineEnd: true,
    omitLineStart: true,
  });
  if (adjGaps.length < 1) return null;
  var addEm = surplusEm / adjGaps.length - 0.0005;
  for (var g = 0; g < adjGaps.length; g++) {
    addGapPaddingEm(adjGaps[g], addEm, layout.emPx);
  }
  return {
    lineIndex: L,
    gaps: adjGaps,
    surplusEm: surplusEm,
    addEm: addEm,
  };
}

export function applyLineSurplusPaddingByVisualWidth(block) {
  var layout = buildBlockLayout(block);
  if (!layout) return;
  for (var L = 0; L < layout.heads.length; L++) {
    applySurplusOnLine(layout, L);
    layout = buildBlockLayout(block);
    if (!layout) return;
  }
}
