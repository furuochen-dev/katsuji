/** 量 ts-gap 的 padding-inline-start + margin-inline-start；surplus 写 padding */
import { gapPmPx as flowGapPmPx, readGapPadEm, setGapPadEm } from '../core/flow.js';

export function gapPmPx(gapEl) {
  return flowGapPmPx(gapEl);
}

/** 连写已改成半角盒+删缝，不再有不可调 combo 缝 */
export function comboFixedGapPmPx() {
  return 0;
}

export function lineGapPmSumsPx(items, startIndex, endIndex) {
  var gapPm = 0;
  for (var j = startIndex; j <= endIndex && j < items.length; j++) {
    if (items[j].type !== 'gap') continue;
    gapPm += gapPmPx(items[j].el);
  }
  return { gapPmPx: gapPm, comboFixedPmPx: 0 };
}

export function readGapPaddingEm(gapEl, emPx) {
  return readGapPadEm(gapEl, emPx);
}

export function addGapPaddingEm(gapEl, deltaEm, emPx) {
  var next = readGapPaddingEm(gapEl, emPx) + deltaEm;
  setGapPadEm(gapEl, Math.abs(next) < 1e-9 ? 0 : next);
}
