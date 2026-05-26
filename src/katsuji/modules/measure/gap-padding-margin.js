/** 量 ts-gap 的 paddingLeft + marginLeft（px/em），surplus 写 padding */
(function (AT) {
  var g = AT.global;
  var parseCssLengthToEm = AT.DomUtil.parseCssLengthToEm;

  function gapPmPx(gapEl) {
    if (!gapEl || !g.getComputedStyle) return 0;
    var cs = g.getComputedStyle(gapEl);
    var pad = parseFloat(cs.paddingLeft);
    var mar = parseFloat(cs.marginLeft);
    if (!isFinite(pad)) pad = 0;
    if (!isFinite(mar)) mar = 0;
    return pad + mar;
  }

  function comboFixedGapPmPx(gapEl) {
    if (!gapEl || gapEl.getAttribute('data-ts-combo-fixed') !== '1') return 0;
    return gapPmPx(gapEl);
  }

  function lineGapPmSumsPx(items, startIndex, endIndex) {
    var gapPm = 0;
    var comboPm = 0;
    for (var j = startIndex; j <= endIndex && j < items.length; j++) {
      if (items[j].type !== 'gap') continue;
      var px = gapPmPx(items[j].el);
      gapPm += px;
      if (items[j].el.getAttribute('data-ts-combo-fixed') === '1') comboPm += px;
    }
    return { gapPmPx: gapPm, comboFixedPmPx: comboPm };
  }

  function gapMarginEm(gapEl, emPx) {
    var inline = gapEl.style.marginLeft;
    if (inline) return parseCssLengthToEm(inline, emPx);
    if (!g.getComputedStyle || emPx <= 0) return 0;
    var mar = parseFloat(g.getComputedStyle(gapEl).marginLeft);
    if (!isFinite(mar)) return 0;
    return mar / emPx;
  }

  function readGapPaddingEm(gapEl, emPx) {
    var inline = gapEl.style.paddingLeft;
    if (inline) return parseCssLengthToEm(inline, emPx);
    if (!g.getComputedStyle) return 0;
    return parseCssLengthToEm(g.getComputedStyle(gapEl).paddingLeft, emPx);
  }

  function addGapPaddingEm(gapEl, deltaEm, emPx) {
    var next = readGapPaddingEm(gapEl, emPx) + deltaEm;
    if (Math.abs(next) < 1e-9) gapEl.style.paddingLeft = '0';
    else gapEl.style.paddingLeft = next.toFixed(6).replace(/\.?0+$/, '') + 'em';
  }

  function gapsAlreadyHavePullMargin(gaps, emPx) {
    for (var i = 0; i < gaps.length; i++) {
      if (gapMarginEm(gaps[i], emPx) < -1e-6) return true;
    }
    return false;
  }

  AT.GapPaddingMargin = {
    gapPmPx: gapPmPx,
    comboFixedGapPmPx: comboFixedGapPmPx,
    lineGapPmSumsPx: lineGapPmSumsPx,
    gapMarginEm: gapMarginEm,
    readGapPaddingEm: readGapPaddingEm,
    addGapPaddingEm: addGapPaddingEm,
    gapsAlreadyHavePullMargin: gapsAlreadyHavePullMargin,
  };
})(KatsujiInternal);
