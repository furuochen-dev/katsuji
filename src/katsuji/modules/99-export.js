/** @public Katsuji 全局 API */
(function (AT) {
  var hangConfig = AT.Config.hangConfig;
  var mergeHangConfig = AT.Config.mergeHangConfig;
  var Segmenter = AT.Segmenter;
  var ParagraphItems = AT.ParagraphItems;
  var LineWidth = AT.LineWidth;
  var GapPaddingMargin = AT.GapPaddingMargin;
  var Combo = AT.Combo;
  var Surplus = AT.Surplus;
  var LineBreak = AT.LineBreak;
  var Orchestrate = AT.Orchestrate;

  AT.global.Katsuji = {
    config: { hang: hangConfig },
    setHangConfig: mergeHangConfig,
    apply: Segmenter.apply,
    applyHangAvoidance: Orchestrate.applyHangAvoidance,
    applyLineSurplusPaddingByVisualWidth: Surplus.applyLineSurplusPaddingByVisualWidth,
    applyComboSymbols: Combo.applyComboSymbols,
    relaxBuiltinLineBreak: LineBreak.relaxBuiltinLineBreak,
    unrelaxBuiltinLineBreak: LineBreak.unrelaxBuiltinLineBreak,
    buildBlockLayout: LineWidth.buildBlockLayout,
    measureBlockVisualLines: LineWidth.measureBlockVisualLines,
    measureRootVisualLines: LineWidth.measureRootVisualLines,
    measureLineVisualMetricsPx: LineWidth.measureLineVisualMetricsPx,
    flattenParagraph: ParagraphItems.flattenParagraph,
    findLineFirstCharIndices: ParagraphItems.findLineFirstCharIndices,
    lineItemBounds: ParagraphItems.lineItemBounds,
    lineCharsFromItems: ParagraphItems.lineCharsFromItems,
    gapPmPx: GapPaddingMargin.gapPmPx,
    sumLineAllGapPmPx: function (items, startIndex, endIndex) {
      return GapPaddingMargin.lineGapPmSumsPx(items, startIndex, endIndex).gapPmPx;
    },
    comboFixedGapPmPx: GapPaddingMargin.comboFixedGapPmPx,
    setCharWidthMeasurer: LineWidth.setCharWidthMeasurer,
  };
})(KatsujiInternal);
