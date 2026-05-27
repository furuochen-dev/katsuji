/** @layer 0 避头避尾配置 */
export const hangConfig = {
  debugWholeCharPush: false,
};

export function mergeHangConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return hangConfig;
  if (overrides.debugWholeCharPush != null) hangConfig.debugWholeCharPush = !!overrides.debugWholeCharPush;
  return hangConfig;
}
