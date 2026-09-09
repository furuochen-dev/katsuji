/** 行宽余量匀 padding */
import { buildBlockLayout, measureLineVisualMetricsPx } from '../../measure/line-width.js';
import {
  lineItemBounds,
  collectGapsBetween,
  firstSignificantCharIndexOnLine,
} from '../../measure/paragraph-items.js';
import { addGapPaddingEm } from '../../measure/gap-padding-margin.js';
import { wrapTrailingAfterPunctOnLine } from '../../core/punct-wrap.js';

function lineVisualWidthEm(layout, startIndex, endIndex) {
  return (
    measureLineVisualMetricsPx(layout.block, layout.items, startIndex, endIndex).lineWidthPx /
    layout.emPx
  );
}

function lastSignificantLineIndex(layout) {
  for (var L = layout.heads.length - 1; L >= 0; L--) {
    var range = lineItemBounds(layout.items, layout.heads, L);
    if (firstSignificantCharIndexOnLine(layout.items, range.startIndex, range.endIndex + 1) >= 0) {
      return L;
    }
  }
  return -1;
}

function isLastSignificantLine(layout, L) {
  return L === lastSignificantLineIndex(layout);
}

function applySurplusOnLine(layout, L) {
  if (isLastSignificantLine(layout, L)) return null;
  var range = lineItemBounds(layout.items, layout.heads, L);
  if (wrapTrailingAfterPunctOnLine(layout.items, range.startIndex, range.endIndex + 1)) {
    layout = buildBlockLayout(layout.block);
    if (!layout) return null;
    if (isLastSignificantLine(layout, L)) return null;
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

function surplusDoneSet(block) {
  var done = Object.create(null);
  var raw = block.getAttribute('data-ts-surplus-done') || '';
  if (!raw) return done;
  var parts = raw.split(',');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] !== '') done[parts[i]] = true;
  }
  return done;
}

function markSurplusLineDone(block, lineIndex) {
  var done = surplusDoneSet(block);
  done[String(lineIndex)] = true;
  var keys = [];
  for (var k in done) keys.push(k);
  block.setAttribute('data-ts-surplus-done', keys.join(','));
}

export function clearSurplusDone(block) {
  block.removeAttribute('data-ts-surplus-done');
}

/** 下一行未齐的行宽填满（每行只填一次，与整段一次扫描相同）；没有可填的行时返回 null */
export function applyNextLineSurplusPadding(block) {
  var layout = buildBlockLayout(block);
  if (!layout) return null;
  var done = surplusDoneSet(block);
  for (var L = 0; L < layout.heads.length; L++) {
    if (done[String(L)]) continue;
    markSurplusLineDone(block, L);
    var hit = applySurplusOnLine(layout, L);
    layout = buildBlockLayout(block);
    if (hit) return hit;
    if (!layout) return null;
  }
  return null;
}
