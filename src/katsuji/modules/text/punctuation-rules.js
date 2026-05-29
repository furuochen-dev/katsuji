/** @layer 0 禁则与组合符号分类 */
export const AFTER_CHARS = (function () {
  var s =
    '，。、；：？！…～' +
    '）】｝〉》」』' +
    ')]}' +
    '\u201D\u2019';
  var set = Object.create(null);
  for (var i = 0; i < s.length; i++) set[s.charAt(i)] = true;
  return set;
})();

export const BEFORE_OPEN_GAP = (function () {
  var s = '（【「『《〈〔［（' + '\u201C\u2018' + '(';
  var o = Object.create(null);
  for (var i = 0; i < s.length; i++) o[s.charAt(i)] = true;
  return o;
})();

var RIGHT_CLOSE_COMBO = (function () {
  var s = '）】｝〉》」』' + ')]}' + '\u201D\u2019';
  var o = Object.create(null);
  for (var i = 0; i < s.length; i++) o[s.charAt(i)] = true;
  return o;
})();

var NON_BRACKET_COMBO = (function () {
  var s = '，。、；：？！…～·' + ',.;:!?';
  var o = Object.create(null);
  for (var i = 0; i < s.length; i++) o[s.charAt(i)] = true;
  return o;
})();

var OPEN_LINE_START = (function () {
  var s = '（【「『《〈〔［（' + '\u201C\u2018';
  var o = Object.create(null);
  for (var i = 0; i < s.length; i++) o[s.charAt(i)] = true;
  return o;
})();

var FORBIDDEN_LINE_START = (function () {
  var s =
    '，。、；：？！…～·' +
    '）】｝〉》」』' +
    ')]}' +
    '\u201D\u2019' +
    '％‰℃°' +
    '—…';
  var o = Object.create(null);
  for (var i = 0; i < s.length; i++) o[s.charAt(i)] = true;
  return o;
})();

export function comboBracketClass(ch) {
  if (BEFORE_OPEN_GAP[ch]) return 'L';
  if (RIGHT_CLOSE_COMBO[ch]) return 'R';
  if (NON_BRACKET_COMBO[ch]) return 'N';
  return null;
}

function isCjkIdeograph(ch) {
  var cp = ch.charCodeAt(0);
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    cp === 0x3007 ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

export function isForbiddenLineStart(ch) {
  if (ch === '\n' || ch === '\r') return false;
  if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') return false;
  if (OPEN_LINE_START[ch]) return false;
  if (/[0-9a-zA-Z]/.test(ch)) return false;
  if (isCjkIdeograph(ch)) return false;
  return FORBIDDEN_LINE_START[ch] === true;
}

export function isBadLineEndOpen(ch) {
  if (OPEN_LINE_START[ch]) return true;
  return ch === '(';
}

/** 行末半角标点候选（闭引/句读等，push 成功时包 ts-half-punct） */
export function isHalfWidthLineEndPunct(ch) {
  if (AFTER_CHARS[ch]) return true;
  return /[,.;:!?]/.test(ch) && NON_BRACKET_COMBO[ch] === true;
}

/** 行内标点计数（含开闭引、句读等） */
export function isPunctuationChar(ch) {
  return AFTER_CHARS[ch] || BEFORE_OPEN_GAP[ch] || comboBracketClass(ch) != null;
}
