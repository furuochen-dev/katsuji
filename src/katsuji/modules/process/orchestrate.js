/** 编排 */
(function (AT) {
  var mergeHangConfig = AT.Config.mergeHangConfig;
  var applyComboSymbolsBlock = AT.Combo.applyComboSymbolsBlock;
  var resetGapStyles = AT.Segmenter.resetGapStyles;
  var unwrapHalfPunctInBlock = AT.PunctWrap.unwrapHalfPunctInBlock;
  var applyProcessPunct = AT.ProcessPunct.applyProcessPunct;
  var applyLineSurplusPaddingByVisualWidth = AT.Surplus.applyLineSurplusPaddingByVisualWidth;
  var relaxBuiltinLineBreak = AT.LineBreak.relaxBuiltinLineBreak;

  function applyHangAvoidance(root, options) {
    var g = AT.global;
    root = root || g.document.body;
    options = options || {};
    var hangOpts = mergeHangConfig(options.hang);
    if (options.debugWholeCharPush != null) {
      hangOpts.debugWholeCharPush = !!options.debugWholeCharPush;
    }
    var maxIter = options.maxIterations != null ? options.maxIterations : 24;
    if (options.relaxBuiltinLineBreak !== false) {
      relaxBuiltinLineBreak(root);
      void root.offsetHeight;
    }
    var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
      if (options.applyComboSymbols !== false) {
        applyComboSymbolsBlock(block);
      }
      resetGapStyles(block);
      unwrapHalfPunctInBlock(block);
      var iter = 0;
      while (iter < maxIter) {
        var hit = applyProcessPunct(block, hangOpts);
        if (!hit) break;
        iter++;
      }
      if (options.applyLineSurplusPadding !== false) {
        applyLineSurplusPaddingByVisualWidth(block);
      }
    }
  }

  AT.Orchestrate = {
    applyHangAvoidance: applyHangAvoidance,
  };
})(KatsujiInternal);
