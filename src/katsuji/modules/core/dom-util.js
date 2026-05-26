/** @layer 0 DOM 工具 */
(function (AT) {
  var g = AT.global;

  function shouldSkipTextParent(el) {
    if (!el) return true;
    var tag = el.tagName;
    if (!tag) return true;
    tag = tag.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return true;
    if (el.closest && el.closest('script, style, textarea, noscript, pre, code')) return true;
    return false;
  }

  function parseCssLengthToEm(val, emPx) {
    if (val == null || val === '') return 0;
    var s = String(val).trim();
    var emM = s.match(/^([-+]?\d*\.?\d+)em$/i);
    if (emM) return parseFloat(emM[1]);
    if (s === '0' || s === '0px') return 0;
    var px = parseFloat(s);
    if (isFinite(px) && emPx > 0) return px / emPx;
    return 0;
  }

  AT.DomUtil = {
    shouldSkipTextParent: shouldSkipTextParent,
    parseCssLengthToEm: parseCssLengthToEm,
  };
})(KatsujiInternal);
