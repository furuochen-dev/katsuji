/** 避头 / 避尾：调 ts-gap margin，必要时包半角 span（单次只改一处） */
(function (AT) {
  var hangConfig = AT.Config.hangConfig;
  var buildBlockLayout = AT.LineWidth.buildBlockLayout;
  var hangMarginEmPerGap = AT.LineWidth.hangMarginEmPerGap;
  var lineItemBounds = AT.ParagraphItems.lineItemBounds;
  var firstSignificantCharIndexOnLine = AT.ParagraphItems.firstSignificantCharIndexOnLine;
  var lastSignificantCharIndexOnLine = AT.ParagraphItems.lastSignificantCharIndexOnLine;
  var collectGapsBetween = AT.ParagraphItems.collectGapsBetween;
  var isForbiddenLineStart = AT.PunctuationRules.isForbiddenLineStart;
  var isBadLineEndOpen = AT.PunctuationRules.isBadLineEndOpen;
  var gapsAlreadyHavePullMargin = AT.GapPaddingMargin.gapsAlreadyHavePullMargin;
  var wrapCharAsHalfPunct = AT.PunctWrap.wrapCharAsHalfPunct;
  var wrapCharAsLineEndHalf = AT.PunctWrap.wrapCharAsLineEndHalf;
  var charItemIsHalfPunctWrapped = AT.PunctWrap.charItemIsHalfPunctWrapped;
  var charItemIsLineEndHalfWrapped = AT.PunctWrap.charItemIsLineEndHalfWrapped;

  function applyMarginToGaps(gaps, em) {
    for (var g = 0; g < gaps.length; g++) {
      gaps[g].style.paddingLeft = '0';
      gaps[g].style.marginLeft = em;
    }
  }

  function headHangMarginEm(layout, rangeStart, rangeEnd, gapCount, debugWholeCharPush) {
    var em = hangMarginEmPerGap(layout, rangeStart, rangeEnd, gapCount, {
      pullBaseEm: 0.5,
      pushBaseEm: 1,
      wholeCharMaxMinusLine: debugWholeCharPush,
    });
    if (em || debugWholeCharPush) {
      return { em: em, usedPushFallback: false };
    }
    em = hangMarginEmPerGap(layout, rangeStart, rangeEnd, gapCount, {
      pullBaseEm: 0.5,
      pushBaseEm: 1,
      wholeCharMaxMinusLine: true,
    });
    return { em: em, usedPushFallback: !!em };
  }

  function tryHeadPunctOnce(layout, hangOpts) {
    var debugWholeCharPush = !!hangOpts.debugWholeCharPush;
    var items = layout.items;
    var heads = layout.heads;
    if (heads.length < 2) return false;

    for (var L = 1; L < heads.length; L++) {
      var lineStart = heads[L];
      var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
      var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
      if (sig < 0) continue;
      if (!isForbiddenLineStart(items[sig].ch)) continue;

      var prevRange = lineItemBounds(items, heads, L - 1);
      var prevStart = prevRange.startIndex;
      var prevEnd = lineStart - 1;
      if (prevEnd < prevStart) continue;

      var gaps = collectGapsBetween(items, prevStart, prevEnd, true);
      if (gaps.length < 1) continue;
      if (
        !debugWholeCharPush &&
        charItemIsHalfPunctWrapped(items[sig]) &&
        gapsAlreadyHavePullMargin(gaps, layout.emPx)
      ) {
        continue;
      }

      var margin = headHangMarginEm(layout, prevStart, prevEnd, gaps.length, debugWholeCharPush);
      if (!margin.em) continue;

      applyMarginToGaps(gaps, margin.em);
      if (!debugWholeCharPush && !margin.usedPushFallback && !charItemIsHalfPunctWrapped(items[sig])) {
        wrapCharAsHalfPunct(items[sig]);
      }
      return true;
    }
    return false;
  }

  function tryTailPunctOnce(layout, hangOpts) {
    var debugWholeCharPush = !!hangOpts.debugWholeCharPush;
    var items = layout.items;
    var heads = layout.heads;

    for (var T = 0; T < heads.length; T++) {
      var ls = heads[T];
      var nxt = T + 1 < heads.length ? heads[T + 1] : items.length;
      var lastIdx = lastSignificantCharIndexOnLine(items, ls, nxt);
      if (lastIdx < 0) continue;
      if (!isBadLineEndOpen(items[lastIdx].ch)) continue;

      var tailGaps = collectGapsBetween(items, ls, nxt - 1, {
        skipComboFixed: true,
        omitBesideCharIndex: lastIdx,
        requireMinAdjustableGaps: 2,
      });
      if (tailGaps.length < 1) continue;

      var tailRange = lineItemBounds(items, heads, T);
      var tailEm = hangMarginEmPerGap(
        layout,
        tailRange.startIndex,
        tailRange.endIndex,
        tailGaps.length,
        {
          pullBaseEm: 1,
          pushBaseEm: 1,
          wholeCharMaxMinusLine: debugWholeCharPush,
        }
      );
      if (!tailEm) continue;

      applyMarginToGaps(tailGaps, tailEm);
      if (debugWholeCharPush && !charItemIsLineEndHalfWrapped(items[lastIdx])) {
        wrapCharAsLineEndHalf(items[lastIdx]);
      }
      return true;
    }
    return false;
  }

  function applyProcessPunct(block, hangOpts) {
    hangOpts = hangOpts || hangConfig;
    var layout = buildBlockLayout(block);
    if (!layout || !layout.items.length || layout.heads.length < 1) return false;
    return tryHeadPunctOnce(layout, hangOpts) || tryTailPunctOnce(layout, hangOpts);
  }

  AT.ProcessPunct = {
    applyProcessPunct: applyProcessPunct,
  };
})(KatsujiInternal);
