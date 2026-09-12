/** @layer 0 避头避尾配置 */
import { defaultStrategyDecider } from '../measure/line-width.js';

export const hangConfig = {
  strategyDecider: defaultStrategyDecider('pull'),
  hangingPunctuation: null,
};

export function mergeHangConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return hangConfig;
  if (typeof overrides.strategyDecider === 'function') {
    hangConfig.strategyDecider = overrides.strategyDecider;
  }
  if (overrides.hangingPunctuation !== undefined) {
    hangConfig.hangingPunctuation = overrides.hangingPunctuation;
  }
  return hangConfig;
}
