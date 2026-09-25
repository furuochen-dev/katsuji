/** @layer 0 避头避尾配置 */
import { defaultStrategyDecider } from '../measure/line-width.js';

export const hangConfig = {
  strategyDecider: defaultStrategyDecider('pull'),
  hangingPunctuation: null,
  jukugo: 'jukugo',
};

export function mergeHangConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return hangConfig;
  if (typeof overrides.strategyDecider === 'function') {
    hangConfig.strategyDecider = overrides.strategyDecider;
  }
  if (overrides.hangingPunctuation !== undefined) {
    hangConfig.hangingPunctuation = overrides.hangingPunctuation;
  }
  if (overrides.jukugo != null && String(overrides.jukugo).trim()) {
    hangConfig.jukugo = String(overrides.jukugo).trim();
  }
  return hangConfig;
}
