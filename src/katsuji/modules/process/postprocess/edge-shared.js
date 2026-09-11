/** 行边界调整共用：写缝、挤推、命中记录 */
import { hangMarginEmPerGap } from '../../measure/line-width.js';

export function applyMarginToGaps(gaps, em) {
  for (var g = 0; g < gaps.length; g++) {
    gaps[g].style.paddingLeft = '0';
    gaps[g].style.marginLeft = em;
  }
}

export function punctHit(kind, lineIndex, gaps, extra) {
  extra = extra || {};
  extra.kind = kind;
  extra.lineIndex = lineIndex;
  extra.gaps = gaps;
  return extra;
}

export function withStrategyDecider(hangOpts, opts) {
  if (hangOpts && typeof hangOpts.strategyDecider === 'function') {
    return Object.assign({ strategyDecider: hangOpts.strategyDecider }, opts);
  }
  return opts;
}

/** @returns {{ em: string, usedPushFallback: boolean }|null} */
export function decideHangOnGaps(layout, startIndex, endIndex, hangOpts, amounts) {
  var margin = hangMarginEmPerGap(
    layout,
    startIndex,
    endIndex,
    withStrategyDecider(hangOpts, amounts),
  );
  if (!margin.em) return null;
  return margin;
}
