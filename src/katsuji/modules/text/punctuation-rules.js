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

function fillSet(target, str) {
  for (var k in target) delete target[k];
  var s = str == null ? '' : String(str);
  for (var i = 0; i < s.length; i++) target[s.charAt(i)] = true;
}

export function rebuildPunctSets(gapBefore, gapNone, gapAfter, centerStops, centerFixed) {
  fillSet(BEFORE_OPEN_GAP, gapBefore);
  fillSet(GAP_NONE, gapNone);
  fillSet(AFTER_CHARS, gapAfter);
  fillSet(CENTER_STOPS_CHARS, centerStops);
  fillSet(CENTER_FIXED_CHARS, centerFixed);
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

rebuildPunctSets(DEFAULT_GAP_BEFORE, DEFAULT_GAP_NONE, DEFAULT_GAP_AFTER, '', '');

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

/** 行首 `不能在行头` */
export function isIllegalOnEdgeStart(ch) {
  if (ch === '\n' || ch === '\r') return false;
  if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') return false;
  if (/[0-9a-zA-Z]/.test(ch)) return false;
  if (isCjkIdeograph(ch)) return false;
  return !!(AFTER_CHARS[ch] || GAP_NONE[ch] || CENTER_STOPS_CHARS[ch] || CENTER_FIXED_CHARS[ch]);
}

/** 行尾 `前有空`：非法 */
export function isIllegalOnEdgeEnd(ch) {
  return punctGapClass(ch) === 'before';
}

/** 行内标点计数 */
export function isPunctuationChar(ch) {
  return punctGapClass(ch) != null;
}
