/** TYPESET 第 4–5 步的纯规则：连写判定、挪字基数、行跳过。不碰 DOM。 */
import {
  punctGapClass,
  isIllegalOnEdgeStart,
  isSpaceOnEdgeStart,
  isPunctuationChar,
  isHalfPunct,
  isCenterStop,
  isCenterFixed,
  hasCenterFixedChars,
  DEFAULT_HANGABLE_STOPS,
} from '../text/punctuation-rules.js';

export var PULL_MAX_EM = 0.6;
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

/** `不能在行头` = `后有空` ∪ `两侧无空` ∪ `行头不可` */
export function isCannotLineStart(ch) {
  return isIllegalOnEdgeStart(ch);
}

export function isSpaceAfter(ch) {
  return isHalfPunct(ch);
}

export function isHangableStop(ch) {
  return DEFAULT_HANGABLE_STOPS.indexOf(ch) !== -1;
}

/** @param {unknown} raw */
export function resolveHangingPunctuation(raw) {
  if (raw == null || raw === false) {
    return { hangLeft: false, hangLeftIndent: false, hangRight: 'none' };
  }
  if (raw === true) {
    return {
      hangLeft: false,
      hangLeftIndent: true,
      hangRight: hasCenterFixedChars() ? 'exceptCenterFixed' : 'stops',
    };
  }
  if (typeof raw !== 'object') {
    return { hangLeft: false, hangLeftIndent: false, hangRight: 'none' };
  }
  var hangRight = raw.hangRight;
  if (
    hangRight !== 'stops' &&
    hangRight !== 'all' &&
    hangRight !== 'none' &&
    hangRight !== 'exceptCenterFixed'
  ) {
    hangRight = 'none';
  }
  var hangLeft = !!raw.hangLeft;
  var on = hangLeft || hangRight !== 'none' || raw.hangLeftIndent === true;
  var hangLeftIndent = raw.hangLeftIndent == null ? on : !!raw.hangLeftIndent;
  return { hangLeft: hangLeft, hangLeftIndent: hangLeftIndent, hangRight: hangRight };
}

/** 缩进左挂要缩进够 0.5em；全局左挂每行都推。 */
export function shouldProtrudeLineStartOpen(lineIndex, indentEm, hp) {
  var n = hp && hp.hangRight != null ? hp : resolveHangingPunctuation(hp);
  if (n.hangLeft) return true;
  return !!(n.hangLeftIndent && lineIndex === 0 && indentEm >= 0.5);
}

export function isHangable(ch, hangRight) {
  if (hangRight === 'stops') return isHangableStop(ch);
  var after = punctGapClass(ch) === 'after';
  if (hangRight === 'all') return after;
  if (hangRight === 'exceptCenterFixed') return after && !isCenterFixed(ch);
  return false;
}

/** 包半角后相对未包少占的内口：可悬挂 1，收半角 0.5 */
export function wrapHalfEm(ch, hangRight) {
  if (isHangable(ch, hangRight)) return 1;
  if (isHalfPunct(ch) || isCenterStop(ch)) return 0.5;
  return 0;
}

export function hangingPadPlan(hp) {
  var n = resolveHangingPunctuation(hp);
  var on = n.hangLeft || n.hangLeftIndent || n.hangRight !== 'none';
  return { left: on, right: on };
}

export function nextHangPadEm(currentEm) {
  return (Number(currentEm) || 0) + 0.5;
}

/**
 * 正文框行宽：2′ 不当剩余。只加一侧时 contentEm 再减 hangPadEm；
 * 左右都加则内容盒已是正文，hangPadEm 为 0。沟只吃剩余，行宽不低于本行合。
 * @param {number} [hangPadEm]
 * @param {number} [lineEm]
 */
export function lineMaxEm(contentEm, indentEm, lineIndex, hangPadEm, lineEm) {
  var em = contentEm;
  if (lineIndex === 0 && indentEm > 0) em -= indentEm;
  if (hangPadEm > 0) {
    em -= hangPadEm;
    if (lineEm != null && em < lineEm) em = lineEm;
  }
  return em;
}

/** 第 1 步：缝插在哪一侧。置中固定 / none / 汉字 / 西文都不插。 */
export function gapInsertSide(ch) {
  if (isCenterFixed(ch) || punctGapClass(ch) === 'none') return null;
  if (isCenterStop(ch)) return 'both';
  var cls = punctGapClass(ch);
  if (cls === 'before') return 'before';
  if (cls === 'after') return 'after';
  return null;
}

/**
 * 成对：收半角后紧跟标点则收左；置中点号/固定后紧跟前有空则收右。
 * @returns {null|'after-before'|'single'|'wrap-right'}
 */
export function comboPairKind(leftCh, rightCh) {
  if (!isPunctuationChar(leftCh) || !isPunctuationChar(rightCh)) return null;
  var n = punctGapClass(rightCh);
  if (isHalfPunct(leftCh)) {
    if (n === 'before') return 'after-before';
    return 'single';
  }
  if ((isCenterStop(leftCh) || isCenterFixed(leftCh)) && n === 'before') return 'wrap-right';
  if ((isCenterStop(leftCh) || isCenterFixed(leftCh)) && isHalfPunct(rightCh)) return 'wrap-right';
  if (isCenterStop(leftCh) || isCenterFixed(leftCh)) return null;
  var p = punctGapClass(leftCh);
  if (p == null || n == null) return null;
  if (p !== 'after' && n !== 'before') return null;
  if (p === 'after' && n === 'before') return 'after-before';
  return 'single';
}

export function isComboPair(leftCh, rightCh) {
  return comboPairKind(leftCh, rightCh) != null;
}

/** 4.1 两条缝只删第一条；4.2 删中间那一条。 */
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
  if (opts.wrapLastHalf) em -= opts.wrapLastEm != null ? opts.wrapLastEm : 0.5;
  if (opts.wrapNewEndHalf) em += opts.wrapNewEndEm != null ? opts.wrapNewEndEm : 0.5;
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

/** 5.2 压入：行头连续 `前有空`（0+）+ 再一个不是 `前有空` 的字 + 其后连续 `不能在行头` */
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
  if (i < nextLineChars.length) {
    run.push(nextLineChars[i]);
    i += 1;
  }
  i = skipWs(nextLineChars, i, 1);
  while (i < nextLineChars.length) {
    var tail = nextLineChars[i];
    if (isLayoutWhitespace(tail)) {
      i += 1;
      continue;
    }
    if (!isCannotLineStart(tail)) break;
    run.push(tail);
    i += 1;
  }
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

export function shouldWrapMovedLastHalf(movedChars, hangRight) {
  if (!movedChars || !movedChars.length) return false;
  var ch = movedChars[movedChars.length - 1];
  return isHangable(ch, hangRight || 'none') || isHalfPunct(ch) || isCenterStop(ch);
}

/** 行尾已包盒：后缝锁死 */
export function shouldLockLineEndAfterGap(ch, hangRight) {
  return shouldWrapMovedLastHalf([ch], hangRight);
}

/** 行尾已推出：前缝锁死 */
export function shouldLockLineEndBeforeGap(ch, hangRight) {
  return isHangable(ch, hangRight || 'none');
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
 * @param {{ newEndAlreadyHalf?: boolean, hangRight?: string }} [opts] 推完后的新行尾若已是半角盒，合里不再加包盒；可挂仍加推出 0.5
 */
export function computeLineEndBases(thisLineChars, nextLineChars, opts) {
  opts = opts || {};
  var thisEnd = lastSignificantChar(thisLineChars);
  var nextStart = firstSignificantChar(nextLineChars);
  var alreadyHalf = !!opts.newEndAlreadyHalf;
  var hangRight = opts.hangRight || 'none';

  function wrapLastOpts(chars) {
    var wrap = shouldWrapMovedLastHalf(chars, hangRight);
    return {
      wrapLastHalf: wrap,
      wrapLastEm: wrap ? wrapHalfEm(chars[chars.length - 1], hangRight) : 0,
    };
  }

  function wrapNewEndOpts(newEndCh) {
    if (!newEndCh || !shouldWrapMovedLastHalf([newEndCh], hangRight)) {
      return { wrapNewEndHalf: false, wrapNewEndEm: 0 };
    }
    var full = wrapHalfEm(newEndCh, hangRight);
    if (alreadyHalf) {
      var extra = isHangable(newEndCh, hangRight) ? Math.max(0, full - 0.5) : 0;
      return { wrapNewEndHalf: extra > 0, wrapNewEndEm: extra };
    }
    return { wrapNewEndHalf: true, wrapNewEndEm: full };
  }

  if (nextLineStartsForbidden(nextLineChars)) {
    var pull51 = collectPull51(nextLineChars);
    var push51 = collectPush51(thisLineChars);
    var newEnd51 = charBeforeSuffix(thisLineChars, push51);
    return {
      branch: '5.1',
      pullChars: pull51,
      pushChars: push51,
      pullBaseEm: opticalMoveEm(
        pull51,
        Object.assign(
          { junctionLeft: thisEnd, deductInternalCombo: true },
          wrapLastOpts(pull51),
        ),
      ),
      pushBaseEm: opticalMoveEm(
        push51,
        Object.assign(
          { junctionRight: nextStart, deductInternalCombo: false },
          wrapNewEndOpts(newEnd51),
        ),
      ),
    };
  }

  var pull52 = collectPull52(nextLineChars);
  var push52 = collectPush52(thisLineChars);
  var newEnd52 = charBeforeSuffix(thisLineChars, push52);
  return {
    branch: '5.2',
    pullChars: pull52,
    pushChars: push52,
    pullBaseEm: opticalMoveEm(
      pull52,
      Object.assign(
        { junctionLeft: thisEnd, deductInternalCombo: true },
        wrapLastOpts(pull52),
      ),
    ),
    pushBaseEm: opticalMoveEm(
      push52,
      Object.assign(
        { junctionRight: nextStart, deductInternalCombo: false },
        wrapNewEndOpts(newEnd52),
      ),
    ),
  };
}

/** 压入量 = 基数 + 合 − 行宽；推出量 = 基数 + 行宽 − 合 */
export function hangAmountsEm(lineEm, maxEm, pullBaseEm, pushBaseEm) {
  return {
    pullAmountEm: pullBaseEm + lineEm - maxEm,
    pushAmountEm: pushBaseEm + maxEm - lineEm,
  };
}

/** 第 4 步收完本行后缀被折到下行：第 5 步仍用收之前的行尾和原下行行头 */
export function restoreLineCharsIfComboSplit(beforeThis, beforeNext, afterThis, afterNext) {
  if (!beforeThis || !afterThis || afterThis.length >= beforeThis.length) return null;
  for (var i = 0; i < afterThis.length; i++) {
    if (afterThis[i] !== beforeThis[i]) return null;
  }
  var dropped = beforeThis.slice(afterThis.length);
  if (!dropped.length || !afterNext || afterNext.length < dropped.length) return null;
  for (var j = 0; j < dropped.length; j++) {
    if (afterNext[j] !== dropped[j]) return null;
  }
  return { thisChars: beforeThis.slice(), nextChars: (beforeNext || []).slice() };
}

/** 视觉行只剩本串前缀：字被折走，剩余不摊 */
export function lineLostIntendedRun(currentChars, intendedChars) {
  if (!intendedChars || !intendedChars.length || !currentChars) return false;
  if (currentChars.length >= intendedChars.length) return false;
  for (var i = 0; i < currentChars.length; i++) {
    if (currentChars[i] !== intendedChars[i]) return false;
  }
  return true;
}

export function lineStepPlan(lineIndex, lineCount) {
  return {
    step3: true,
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
