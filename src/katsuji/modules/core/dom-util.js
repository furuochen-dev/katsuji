/** @layer 0 DOM 工具 */

/** `rt` / `rp` / `rtc`：注音本身，不当正文 */
export function isRubyAnnotationParent(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('rt, rp, rtc');
}

/** 整个 `<ruby>` 簇（含底、注音） */
export function isInsideRuby(el) {
  if (!el || !el.closest) return false;
  return !!el.closest('ruby, rt, rp, rtc');
}

export function shouldSkipTextParent(el) {
  if (!el) return true;
  var tag = el.tagName;
  if (!tag) return true;
  tag = tag.toUpperCase();
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return true;
  if (el.closest && el.closest('script, style, textarea, noscript, pre, code')) return true;
  if (isRubyAnnotationParent(el)) return true;
  return false;
}

/** 切缝不进 ruby：底和注音都交给 UA */
export function shouldSkipSegmenterParent(el) {
  if (shouldSkipTextParent(el)) return true;
  return isInsideRuby(el);
}

export function parseCssLengthToEm(val, emPx) {
  if (val == null || val === '') return 0;
  var s = String(val).trim();
  var emM = s.match(/^([-+]?\d*\.?\d+)em$/i);
  if (emM) return parseFloat(emM[1]);
  if (s === '0' || s === '0px') return 0;
  var px = parseFloat(s);
  if (isFinite(px) && emPx > 0) return px / emPx;
  return 0;
}
