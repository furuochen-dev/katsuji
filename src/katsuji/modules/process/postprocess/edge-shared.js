/** 行边界调整共用：写缝、挤推、命中记录 */
import { hangMarginEmPerGap } from '../../measure/line-width.js';
import { setGapPadEm, setGapMarEm } from '../../core/flow.js';
import { gapShareWeight } from '../typeset-rules.js';

/** unitEm：单位权份额（字符串或数字）。半倍空 ×0.5。 */
export function applyMarginToGaps(gaps, unitEm) {
  var unit =
    typeof unitEm === 'number' ? unitEm : parseFloat(String(unitEm || '').replace(/em$/i, '')) || 0;
  for (var g = 0; g < gaps.length; g++) {
    setGapPadEm(gaps[g], 0);
    setGapMarEm(gaps[g], unit * gapShareWeight(gaps[g]));
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
