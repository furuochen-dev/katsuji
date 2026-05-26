/** @layer 0 避头避尾配置 */
(function (AT) {
  var hangConfig = {
    debugWholeCharPush: false,
  };

  function mergeHangConfig(overrides) {
    if (!overrides || typeof overrides !== 'object') return hangConfig;
    if (overrides.debugWholeCharPush != null) hangConfig.debugWholeCharPush = !!overrides.debugWholeCharPush;
    return hangConfig;
  }

  AT.Config = {
    hangConfig: hangConfig,
    mergeHangConfig: mergeHangConfig,
  };
})(KatsujiInternal);
