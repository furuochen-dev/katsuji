/** 行宽余量匀 padding */
(function (AT) {
  var buildBlockLayout = AT.LineWidth.buildBlockLayout;
  var lineVisualWidthEm = AT.LineWidth.lineVisualWidthEm;
  var lineItemBounds = AT.ParagraphItems.lineItemBounds;
  var collectGapsBetween = AT.ParagraphItems.collectGapsBetween;
  var addGapPaddingEm = AT.GapPaddingMargin.addGapPaddingEm;

  function applyLineSurplusPaddingByVisualWidth(block) {
    var layout = buildBlockLayout(block);
    if (!layout) return;
    for (var L = 0; L < layout.heads.length; L++) {
      if (layout.heads.length >= 2 && L === layout.heads.length - 2) continue;
      var range = lineItemBounds(layout.items, layout.heads, L);
      var visualEm = lineVisualWidthEm(layout, range.startIndex, range.endIndex);
      var surplusEm = layout.maxEm - visualEm;
      if (!(surplusEm > 1e-6)) continue;
      var adjGaps = collectGapsBetween(layout.items, range.startIndex, range.endIndex, {
        skipComboFixed: true,
        omitLineEnd: true,
      });
      if (adjGaps.length < 1) continue;
      var addEm = surplusEm / adjGaps.length - 0.0005;
      for (var g = 0; g < adjGaps.length; g++) {
        addGapPaddingEm(adjGaps[g], addEm, layout.emPx);
      }
    }
  }

  AT.Surplus = {
    applyLineSurplusPaddingByVisualWidth: applyLineSurplusPaddingByVisualWidth,
  };
})(KatsujiInternal);
