/** @layer 0 禁则与组合符号分类（按 ts-gap 侧） */

export var DEFAULT_GAP_BEFORE = '（【「『《〈〔［' + '\u201C\u2018' + '(';
export var DEFAULT_GAP_NONE = '…～％‰℃°—';
/** 打开右挂且 stops 时的 `可悬挂`。西文 `,` `.` 不进这版 */
export var DEFAULT_HANGABLE_STOPS = '，。、';
export var DEFAULT_GAP_AFTER =
  '，。、；：？！' +
  '）】｝〉》」』' +
  ')]}' +
  '\u201D\u2019' +
  '·' +
  ';:!?';

/** 2. 左边有空：左括、左引、《 等 */
export const BEFORE_OPEN_GAP = Object.create(null);

/** 3. 两侧皆无空 */
export const GAP_NONE = Object.create(null);

/** 1. 右边有空：句读、闭括、半角标点等 */
export const AFTER_CHARS = Object.create(null);

/** `punctAlign: 'center'` 填入；默认无字 */
export var CENTER_ALIGN_STOPS = '，。、；：·';
export var CENTER_ALIGN_FIXED = '？！';
export const CENTER_STOPS_CHARS = Object.create(null);
export const CENTER_FIXED_CHARS = Object.create(null);

/** 两字一体的一个码位；两个相同码位成一对。不跟 gapNone / 置中走 */
export var DEFAULT_TWO_EM_KEEP = '…—';
export const TWO_EM_KEEP_CHARS = Object.create(null);

/** JIS 严格填入；默认无字。不是标点，不插缝 */
export var DEFAULT_NO_LINE_START =
  'ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶー々〻ゝゞヽヾ';
export const NO_LINE_START_CHARS = Object.create(null);

function fillSet(target, str) {
  for (var k in target) delete target[k];
  var s = str == null ? '' : String(str);
  for (var i = 0; i < s.length; i++) target[s.charAt(i)] = true;
}

export function rebuildPunctSets(gapBefore, gapNone, gapAfter, centerStops, centerFixed, twoEmKeep, noLineStart) {
  fillSet(BEFORE_OPEN_GAP, gapBefore);
  fillSet(GAP_NONE, gapNone);
  fillSet(AFTER_CHARS, gapAfter);
  fillSet(CENTER_STOPS_CHARS, centerStops);
  fillSet(CENTER_FIXED_CHARS, centerFixed);
  fillSet(TWO_EM_KEEP_CHARS, twoEmKeep != null ? twoEmKeep : DEFAULT_TWO_EM_KEEP);
  fillSet(NO_LINE_START_CHARS, noLineStart != null ? noLineStart : '');
}

export function inPunctTable(ch, table) {
  return !!(table && table[ch]);
}

export function isCenterStop(ch) {
  return !!CENTER_STOPS_CHARS[ch];
}

export function isCenterFixed(ch) {
  return !!CENTER_FIXED_CHARS[ch];
}

export function hasCenterFixedChars() {
  for (var k in CENTER_FIXED_CHARS) {
    if (CENTER_FIXED_CHARS[k]) return true;
  }
  return false;
}

/** 在 `后有空`，且不在两张置中表 */
export function isHalfPunct(ch) {
  return !!AFTER_CHARS[ch] && !CENTER_STOPS_CHARS[ch] && !CENTER_FIXED_CHARS[ch];
}

/** 在 `两字一体` 表 */
export function isTwoEmKeepChar(ch) {
  return !!TWO_EM_KEEP_CHARS[ch];
}

/** 在 `行头不可` 表 */
export function isNoLineStartChar(ch) {
  return !!NO_LINE_START_CHARS[ch];
}

/** 相邻两个相同码位才成一对 `……` 或 `——` */
export function isTwoEmKeepPair(a, b) {
  return !!a && a === b && isTwoEmKeepChar(a);
}

/**
 * 从左每两个相同两字一体字收一段。`chars` 为字符串或字数组。
 * @returns {{ start: number, end: number, ch: string }[]}
 */
export function twoEmKeepRuns(chars) {
  var s = '';
  if (typeof chars === 'string') s = chars;
  else if (chars && chars.length) {
    for (var k = 0; k < chars.length; k++) s += chars[k];
  }
  var runs = [];
  var i = 0;
  while (i < s.length) {
    if (i + 1 < s.length && isTwoEmKeepPair(s.charAt(i), s.charAt(i + 1))) {
      runs.push({ start: i, end: i + 1, ch: s.charAt(i) });
      i += 2;
    } else {
      i += 1;
    }
  }
  return runs;
}

rebuildPunctSets(DEFAULT_GAP_BEFORE, DEFAULT_GAP_NONE, DEFAULT_GAP_AFTER, '', '', DEFAULT_TWO_EM_KEEP, '');

/** @returns {'after'|'before'|'none'|null} 1=after 2=before 3=none */
export function punctGapClass(ch) {
  if (BEFORE_OPEN_GAP[ch]) return 'before';
  if (GAP_NONE[ch]) return 'none';
  if (AFTER_CHARS[ch]) return 'after';
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

/** 行首 `前有空`：合法，去掉左边的前空 */
export function isSpaceOnEdgeStart(ch) {
  return punctGapClass(ch) === 'before';
}

/** 行尾 `后有空`：可收成半宽（置中点号另走挂，不走这句） */
export function isSpaceOnEdgeEnd(ch) {
  return isHalfPunct(ch);
}

/** 行首 `不能在行头` = `后有空` ∪ `两侧无空` ∪ `行头不可`。置中是 `后有空` 子集，不另查 */
export function isIllegalOnEdgeStart(ch) {
  if (ch === '\n' || ch === '\r') return false;
  if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') return false;
  if (/[0-9a-zA-Z]/.test(ch)) return false;
  if (isCjkIdeograph(ch)) return false;
  return !!(AFTER_CHARS[ch] || GAP_NONE[ch] || NO_LINE_START_CHARS[ch]);
}

/** 行尾 `前有空`：非法 */
export function isIllegalOnEdgeEnd(ch) {
  return punctGapClass(ch) === 'before';
}

/** 行内标点计数 */
export function isPunctuationChar(ch) {
  return punctGapClass(ch) != null;
}
