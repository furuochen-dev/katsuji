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

function fillSet(target, str) {
  for (var k in target) delete target[k];
  for (var i = 0; i < str.length; i++) target[str.charAt(i)] = true;
}

export function rebuildPunctSets(gapBefore, gapNone, gapAfter) {
  fillSet(BEFORE_OPEN_GAP, gapBefore);
  fillSet(GAP_NONE, gapNone);
  fillSet(AFTER_CHARS, gapAfter);
}

rebuildPunctSets(DEFAULT_GAP_BEFORE, DEFAULT_GAP_NONE, DEFAULT_GAP_AFTER);

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

/** 行尾 `后有空`：可收成半宽 */
export function isSpaceOnEdgeEnd(ch) {
  return AFTER_CHARS[ch] === true;
}

/** 行首 `不能在行头` */
export function isIllegalOnEdgeStart(ch) {
  if (ch === '\n' || ch === '\r') return false;
  if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') return false;
  if (/[0-9a-zA-Z]/.test(ch)) return false;
  if (isCjkIdeograph(ch)) return false;
  var cls = punctGapClass(ch);
  return cls === 'after' || cls === 'none';
}

/** 行尾 `前有空`：非法 */
export function isIllegalOnEdgeEnd(ch) {
  return punctGapClass(ch) === 'before';
}

/** 行内标点计数 */
export function isPunctuationChar(ch) {
  return punctGapClass(ch) != null;
}
