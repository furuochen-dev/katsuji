/** TYPESET 第 4–5 步的纯规则：连写判定、挪字基数、行跳过。不碰 DOM。 */
import {
  punctGapClass,
  isIllegalOnEdgeStart,
  isSpaceOnEdgeStart,
  AFTER_CHARS,
} from '../text/punctuation-rules.js';

export var PULL_MAX_EM = 0.5;
export var PULL_MAX_SLACK_EM = 0.01;
export var HANG_STRATEGY_TIE_EPS = 1e-6;
export var GAP_SHARE_MIN_EM = 0.01;

export function isLayoutWhitespace(ch) {
  return ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000';
}

export function significantChars(str) {
  var out = [];
  var s = str == null ? '' : String(str);
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (!isLayoutWhitespace(ch)) out.push(ch);
  }
  return out;
}

export function firstSignificantChar(chars) {
  for (var i = 0; i < chars.length; i++) {
    if (!isLayoutWhitespace(chars[i])) return chars[i];
  }
  return null;
}

export function lastSignificantChar(chars) {
  for (var i = chars.length - 1; i >= 0; i--) {
    if (!isLayoutWhitespace(chars[i])) return chars[i];
  }
  return null;
}

/** `不能在行头` = `后有空` + `两侧无空` */
export function isCannotLineStart(ch) {
  return isIllegalOnEdgeStart(ch);
}

export function isSpaceAfter(ch) {
  return AFTER_CHARS[ch] === true;
}

/** 第 1 步：缝插在哪一侧。none / 汉字 / 西文都不插。 */
export function gapInsertSide(ch) {
  var cls = punctGapClass(ch);
  if (cls === 'before') return 'before';
  if (cls === 'after') return 'after';
  return null;
}

/**
 * 成对：`后有空` 后紧跟任意标点，或任意标点后紧跟 `前有空`。
 * @returns {null|'after-before'|'single'} after-before = 4.1，只锁前一条缝
 */
export function comboPairKind(leftCh, rightCh) {
  var p = punctGapClass(leftCh);
  var n = punctGapClass(rightCh);
  if (p == null || n == null) return null;
  if (p !== 'after' && n !== 'before') return null;
  if (p === 'after' && n === 'before') return 'after-before';
  return 'single';
}

export function isComboPair(leftCh, rightCh) {
  return comboPairKind(leftCh, rightCh) != null;
}

/** 4.1 两条缝只锁第一条；4.2 锁中间那一条。 */
export function comboGapsToLockCount(gapCountBetween, kind) {
  if (!kind || !(gapCountBetween > 0)) return 0;
  return 1;
}

export function comboDeductionEm(leftCh, rightCh) {
  return isComboPair(leftCh, rightCh) ? 0.5 : 0;
}

export function comboRunInternalDeductionEm(chars) {
  var em = 0;
  for (var i = 0; i < chars.length - 1; i++) {
    em += comboDeductionEm(chars[i], chars[i + 1]);
  }
  return em;
}

/** 未顶格、未包半角：一字 1em */
export function charGrossEm() {
  return 1;
}

export function runGrossEm(chars) {
  return chars.length * charGrossEm();
}

/**
 * 挪完之后的占宽。
 * pull：扣接缝（行尾+串首）和串内连写；末字收半角则 −0.5。
 * push：只扣接缝（串尾+原下行行头）；串内已在「合」里。新行尾收半角或前字已是半角盒则 +0.5。
 */
export function opticalMoveEm(movedChars, opts) {
  opts = opts || {};
  var chars = movedChars || [];
  var em = runGrossEm(chars);
  if (opts.deductInternalCombo) em -= comboRunInternalDeductionEm(chars);
  if (opts.junctionLeft && chars.length) em -= comboDeductionEm(opts.junctionLeft, chars[0]);
  if (opts.junctionRight && chars.length) {
    em -= comboDeductionEm(chars[chars.length - 1], opts.junctionRight);
  }
  if (opts.wrapLastHalf) em -= 0.5;
  if (opts.wrapNewEndHalf) em += 0.5;
  if (opts.prevAlreadyHalf) em += 0.5;
  return em;
}

function skipWs(chars, i, dir) {
  while (i >= 0 && i < chars.length && isLayoutWhitespace(chars[i])) i += dir;
  return i;
}

/** 5.1 压入：下行行头连续 `不能在行头`，碰到可行头的字就停 */
export function collectPull51(nextLineChars) {
  var run = [];
  var i = skipWs(nextLineChars, 0, 1);
  while (i < nextLineChars.length) {
    var ch = nextLineChars[i];
    if (isLayoutWhitespace(ch)) {
      i += 1;
      continue;
    }
    if (!isCannotLineStart(ch)) break;
    run.push(ch);
    i += 1;
  }
  return run;
}

/** 5.1 推出：行尾连续 `不能在行头`（0+）+ 再往前一个可行头的字 */
export function collectPush51(thisLineChars) {
  var trailing = [];
  var i = skipWs(thisLineChars, thisLineChars.length - 1, -1);
  while (i >= 0) {
    var ch = thisLineChars[i];
    if (isLayoutWhitespace(ch)) {
      i -= 1;
      continue;
    }
    if (!isCannotLineStart(ch)) break;
    trailing.unshift(ch);
    i -= 1;
  }
  i = skipWs(thisLineChars, i, -1);
  if (i >= 0) trailing.unshift(thisLineChars[i]);
  return trailing;
}

/** 5.2 压入：行头连续 `前有空`（0+）+ 再一个不是 `前有空` 的字 */
export function collectPull52(nextLineChars) {
  var run = [];
  var i = skipWs(nextLineChars, 0, 1);
  while (i < nextLineChars.length) {
    var ch = nextLineChars[i];
    if (isLayoutWhitespace(ch)) {
      i += 1;
      continue;
    }
    if (!isSpaceOnEdgeStart(ch)) break;
    run.push(ch);
    i += 1;
  }
  i = skipWs(nextLineChars, i, 1);
  if (i < nextLineChars.length) run.push(nextLineChars[i]);
  return run;
}

/** 5.2 推出：行尾连续 `前有空`（0+） */
export function collectPush52(thisLineChars) {
  var run = [];
  var i = skipWs(thisLineChars, thisLineChars.length - 1, -1);
  while (i >= 0) {
    var ch = thisLineChars[i];
    if (isLayoutWhitespace(ch)) {
      i -= 1;
      continue;
    }
    if (!isSpaceOnEdgeStart(ch)) break;
    run.unshift(ch);
    i -= 1;
  }
  return run;
}

export function nextLineStartsForbidden(nextLineChars) {
  var ch = firstSignificantChar(nextLineChars);
  return ch != null && isCannotLineStart(ch);
}

export function shouldWrapMovedLastHalf(movedChars) {
  if (!movedChars || !movedChars.length) return false;
  return isSpaceAfter(movedChars[movedChars.length - 1]);
}

export function charBeforeSuffix(thisLineChars, suffixChars) {
  var sig = [];
  for (var i = 0; i < thisLineChars.length; i++) {
    if (!isLayoutWhitespace(thisLineChars[i])) sig.push(thisLineChars[i]);
  }
  if (!suffixChars.length) return lastSignificantChar(sig);
  if (sig.length <= suffixChars.length) return null;
  return sig[sig.length - suffixChars.length - 1];
}

/**
 * @param {string[]} thisLineChars
 * @param {string[]} nextLineChars
 * @param {{ newEndAlreadyHalf?: boolean }} [opts] 推完后的新行尾若已是半角盒，合里已减过，基数不再 +0.5
 */
export function computeLineEndBases(thisLineChars, nextLineChars, opts) {
  opts = opts || {};
  var thisEnd = lastSignificantChar(thisLineChars);
  var nextStart = firstSignificantChar(nextLineChars);
  var alreadyHalf = !!opts.newEndAlreadyHalf;

  if (nextLineStartsForbidden(nextLineChars)) {
    var pull51 = collectPull51(nextLineChars);
    var push51 = collectPush51(thisLineChars);
    var newEnd51 = charBeforeSuffix(thisLineChars, push51);
    return {
      branch: '5.1',
      pullChars: pull51,
      pushChars: push51,
      pullBaseEm: opticalMoveEm(pull51, {
        junctionLeft: thisEnd,
        deductInternalCombo: true,
        wrapLastHalf: shouldWrapMovedLastHalf(pull51),
      }),
      pushBaseEm: opticalMoveEm(push51, {
        junctionRight: nextStart,
        deductInternalCombo: false,
        wrapNewEndHalf: !!(newEnd51 && isSpaceAfter(newEnd51) && !alreadyHalf),
      }),
    };
  }

  var pull52 = collectPull52(nextLineChars);
  var push52 = collectPush52(thisLineChars);
  var newEnd52 = charBeforeSuffix(thisLineChars, push52);
  return {
    branch: '5.2',
    pullChars: pull52,
    pushChars: push52,
    pullBaseEm: opticalMoveEm(pull52, {
      junctionLeft: thisEnd,
      deductInternalCombo: true,
      wrapLastHalf: shouldWrapMovedLastHalf(pull52),
    }),
    pushBaseEm: opticalMoveEm(push52, {
      junctionRight: nextStart,
      deductInternalCombo: false,
      wrapNewEndHalf: !!(newEnd52 && isSpaceAfter(newEnd52) && !alreadyHalf),
    }),
  };
}

/** 压入量 = 基数 + 合 − 行宽；推出量 = 基数 + 行宽 − 合 */
export function hangAmountsEm(lineEm, maxEm, pullBaseEm, pushBaseEm) {
  return {
    pullAmountEm: pullBaseEm + lineEm - maxEm,
    pushAmountEm: pushBaseEm + maxEm - lineEm,
  };
}

export function lineStepPlan(lineIndex, lineCount) {
  return {
    step3: lineIndex > 0,
    step4: true,
    step5: lineCount > 1 && lineIndex < lineCount - 1,
  };
}

/** @param {'push'|'pull'} [tieBreak] */
export function decideHangStrategy(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount, tieBreak) {
  if (tieBreak !== 'push' && tieBreak !== 'pull') tieBreak = 'pull';
  var canPush = pushGapCount >= 1 && pushAmountEm > 0;
  var canPull =
    pullAmountEm <= PULL_MAX_EM + PULL_MAX_SLACK_EM &&
    (pullAmountEm <= 0 || pullGapCount >= 1);
  if (!canPush && !canPull) return 'none';
  if (!canPush) return 'pull';
  if (!canPull) return 'push';
  if (pullGapCount < 1 || pullAmountEm <= 0) return 'pull';
  var pullPerGap = Math.abs(pullAmountEm / pullGapCount);
  var pushPerGap = Math.abs(pushAmountEm / pushGapCount);
  if (Math.abs(pushPerGap - pullPerGap) < HANG_STRATEGY_TIE_EPS) return tieBreak;
  if (pushPerGap < pullPerGap) return 'push';
  if (pushPerGap > pullPerGap) return 'pull';
  return 'none';
}

export function hangShareEm(decision, pullAmountEm, pushAmountEm, pullGapCount, pushGapCount) {
  if (decision !== 'push' && decision !== 'pull') return null;
  var amountEm = decision === 'push' ? pushAmountEm : pullAmountEm;
  var gapCount = decision === 'push' ? pushGapCount : pullGapCount;
  if (decision === 'pull' && amountEm <= 0) return 0;
  if (gapCount < 1) return null;
  if (decision === 'pull' && amountEm < GAP_SHARE_MIN_EM) return 0;
  if (!(amountEm > 0)) return null;
  var share = decision === 'push' ? amountEm / gapCount - 0.001 : -amountEm / gapCount - 0.001;
  if (!isFinite(share) || Math.abs(share) < GAP_SHARE_MIN_EM) return null;
  return share;
}
