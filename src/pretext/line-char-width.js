/**
 * pretext 字符量宽；行宽合计（含 ts-gap）在 katsuji.js 的 measureBlockLineWidths。
 */
import { prepareWithSegments, walkLineRanges } from '@chenglou/pretext';

const HUGE_MAX_WIDTH = 1e9;

export function fontStringFromElement(el) {
  var s = getComputedStyle(el);
  return (
    s.fontStyle +
    ' ' +
    s.fontVariant +
    ' ' +
    s.fontWeight +
    ' ' +
    s.fontSize +
    ' ' +
    s.fontFamily
  );
}

export function prepareOptionsFromElement(el) {
  var s = getComputedStyle(el);
  var ls = parseFloat(s.letterSpacing);
  if (!Number.isFinite(ls) || ls === 0) return undefined;
  return { letterSpacing: ls };
}

export function measureTextCharWidthPx(text, font, options) {
  if (!text) return 0;
  var prepared = prepareWithSegments(text, font, options);
  var width = 0;
  walkLineRanges(prepared, HUGE_MAX_WIDTH, function (line) {
    width = line.width;
  });
  return width;
}

export function createCharWidthMeasurer() {
  return function (text, block) {
    return measureTextCharWidthPx(
      text,
      fontStringFromElement(block),
      prepareOptionsFromElement(block)
    );
  };
}
