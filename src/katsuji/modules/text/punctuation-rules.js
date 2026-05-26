/** @layer 0 禁则与组合符号分类 */
(function (AT) {
  var AFTER_CHARS = (function () {
    var s =
      '，。、；：？！…～' +
      '）】｝〉》」』' +
      ')]}' +
      '\u201D\u2019';
    var set = Object.create(null);
    for (var i = 0; i < s.length; i++) set[s.charAt(i)] = true;
    return set;
  })();

  var BEFORE_OPEN_GAP = (function () {
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

  function comboBracketClass(ch) {
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

  function isForbiddenLineStart(ch) {
    if (ch === '\n' || ch === '\r') return false;
    if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') return false;
    if (OPEN_LINE_START[ch]) return false;
    if (/[0-9a-zA-Z]/.test(ch)) return false;
    if (isCjkIdeograph(ch)) return false;
    return FORBIDDEN_LINE_START[ch] === true;
  }

  function isBadLineEndOpen(ch) {
    if (OPEN_LINE_START[ch]) return true;
    return ch === '(';
  }

  AT.PunctuationRules = {
    AFTER_CHARS: AFTER_CHARS,
    BEFORE_OPEN_GAP: BEFORE_OPEN_GAP,
    comboBracketClass: comboBracketClass,
    isForbiddenLineStart: isForbiddenLineStart,
    isBadLineEndOpen: isBadLineEndOpen,
  };
})(KatsujiInternal);
