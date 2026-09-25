/** 编排：整篇 1–2 步之后，每段从前往后一行做完 3–5 */
import { mergeHangConfig } from '../core/config.js';
import { resetGapStyles, resetAllGapStyles, restoreMissingGaps } from './preprocess/segmenter.js';
import { unwrapHalfPunctInBlock, unwrapNoneRuns } from '../core/punct-wrap.js';
import { unmergeJukugoInBlock } from '../core/jukugo.js';
import { glueTwoEmKeepPairs } from './preprocess/combo.js';
import { relaxBuiltinLineBreak } from './preprocess/line-break.js';
import { defaultRoot } from '../env.js';
import { buildBlockLayout } from '../measure/line-width.js';
import { processLine } from './process-line.js';
import { applyHangGutter, clearHangGutter } from './hanging-pad.js';
import { resolveHangingPunctuation } from './typeset-rules.js';

function hangingFromOptions(options, hangOpts) {
  if (options && options.hangingPunctuation != null) return options.hangingPunctuation;
  if (hangOpts && hangOpts.hangingPunctuation != null) return hangOpts.hangingPunctuation;
  return null;
}

function hangOptsFromOptions(options) {
  if (options && options.jukugo != null) mergeHangConfig({ jukugo: options.jukugo });
  var hangOpts = Object.assign({}, mergeHangConfig(options && options.hang));
  hangOpts.hangingPunctuation = hangingFromOptions(options, hangOpts);
  return hangOpts;
}

function eachTypesetBlock(root, fn) {
  var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
    if (fn(block, b) === true) return;
  }
}

function typesetBlocks(root) {
  var out = [];
  eachTypesetBlock(root, function (block) {
    out.push(block);
  });
  return out;
}

function prepareBlock(block, hangingPunctuation) {
  clearHangGutter(block);
  resetGapStyles(block);
  unwrapHalfPunctInBlock(block);
  unmergeJukugoInBlock(block);
  restoreMissingGaps(block);
  glueTwoEmKeepPairs(block);
  applyHangGutter(block, hangingPunctuation);
}

export function applyHangAvoidance(root, options) {
  root = defaultRoot(root);
  if (!root) return;
  options = options || {};
  var hangOpts = hangOptsFromOptions(options);
  var hangingPunctuation = hangOpts.hangingPunctuation;
  if (options.relaxBuiltinLineBreak !== false) {
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }
  eachTypesetBlock(root, function (block) {
    prepareBlock(block, hangingPunctuation);
    var L = 0;
    while (true) {
      var layout = buildBlockLayout(block);
      if (!layout || L >= layout.heads.length) break;
      processLine(block, L, hangOpts);
      L += 1;
    }
  });
}

/** 清掉避头尾 / 连写 / 行宽余量，保留 apply() 插入的 ts-gap */
export function resetHangAdjustments(root) {
  root = defaultRoot(root);
  if (!root) return;
  eachTypesetBlock(root, function (block) {
    clearHangGutter(block);
    resetAllGapStyles(block);
    unwrapHalfPunctInBlock(block);
    unmergeJukugoInBlock(block);
    unwrapNoneRuns(block);
    restoreMissingGaps(block);
  });
  if (root.nodeType === 1) {
    root.removeAttribute('data-ts-step-phase');
    root.removeAttribute('data-ts-step-block');
    root.removeAttribute('data-ts-step-line');
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }
}

/**
 * 单步：一次做完一行的第 3–5 步。
 * @returns {object|null} 本步结果；没有更多行时为 null
 */
export function stepHangAvoidance(root, options) {
  root = defaultRoot(root);
  if (!root) return null;
  options = options || {};
  var hangOpts = hangOptsFromOptions(options);
  var hangingPunctuation = hangOpts.hangingPunctuation;

  if (options.relaxBuiltinLineBreak !== false) {
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }

  if (root.getAttribute && root.getAttribute('data-ts-step-phase') !== 'lines') {
    eachTypesetBlock(root, function (block) {
      prepareBlock(block, hangingPunctuation);
    });
    if (root.nodeType === 1) {
      root.setAttribute('data-ts-step-phase', 'lines');
      root.setAttribute('data-ts-step-block', '0');
      root.setAttribute('data-ts-step-line', '0');
    }
  }

  var blocks = typesetBlocks(root);
  var b = parseInt(root.getAttribute && root.getAttribute('data-ts-step-block'), 10) || 0;
  var L = parseInt(root.getAttribute && root.getAttribute('data-ts-step-line'), 10) || 0;

  while (b < blocks.length) {
    var block = blocks[b];
    var layout = buildBlockLayout(block);
    if (!layout || L >= layout.heads.length) {
      b += 1;
      L = 0;
      continue;
    }
    var hit = processLine(block, L, hangOpts);
    var blockIndex = b;
    L += 1;
    var after = buildBlockLayout(block);
    if (!after || L >= after.heads.length) {
      b += 1;
      L = 0;
    }
    if (root.nodeType === 1) {
      root.setAttribute('data-ts-step-block', String(b));
      root.setAttribute('data-ts-step-line', String(L));
    }
    if (hit) {
      hit.block = block;
      hit.blockIndex = blockIndex;
      return hit;
    }
  }
  return null;
}
