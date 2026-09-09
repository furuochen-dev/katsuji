/** 编排 */
import { mergeHangConfig } from '../core/config.js';
import { applyComboSymbolsBlock } from './preprocess/combo.js';
import { resetGapStyles, resetAllGapStyles } from './preprocess/segmenter.js';
import { unwrapHalfPunctInBlock, unwrapNoneRuns } from '../core/punct-wrap.js';
import { applyProcessPunct } from './postprocess/process-punct.js';
import {
  applyLineSurplusPaddingByVisualWidth,
  applyNextLineSurplusPadding,
  clearSurplusDone,
} from './postprocess/surplus.js';
import { relaxBuiltinLineBreak } from './preprocess/line-break.js';
import { defaultRoot } from '../env.js';

function eachTypesetBlock(root, fn) {
  var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
    if (fn(block, b) === true) return;
  }
}

export function applyHangAvoidance(root, options) {
  root = defaultRoot(root);
  if (!root) return;
  options = options || {};
  var hangOpts = mergeHangConfig(options.hang);
  var maxIter = options.maxIterations != null ? options.maxIterations : 24;
  if (options.relaxBuiltinLineBreak !== false) {
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }
  eachTypesetBlock(root, function (block) {
    if (options.applyComboSymbols !== false) {
      applyComboSymbolsBlock(block);
    }
    resetGapStyles(block);
    unwrapHalfPunctInBlock(block);
    var iter = 0;
    while (iter < maxIter) {
      var hit = applyProcessPunct(block, hangOpts);
      if (!hit) break;
      iter++;
    }
  });
  eachTypesetBlock(root, function (block) {
    if (options.applyLineSurplusPadding !== false) {
      applyLineSurplusPaddingByVisualWidth(block);
    }
  });
}

/** 清掉避头尾 / 连写 / 行宽余量，保留 apply() 插入的 ts-gap */
export function resetHangAdjustments(root) {
  root = defaultRoot(root);
  if (!root) return;
  eachTypesetBlock(root, function (block) {
    resetAllGapStyles(block);
    unwrapHalfPunctInBlock(block);
    unwrapNoneRuns(block);
    clearSurplusDone(block);
  });
  if (root.nodeType === 1) {
    root.removeAttribute('data-ts-step-phase');
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }
}

function stepOneHang(root, hangOpts) {
  var found = null;
  eachTypesetBlock(root, function (block, b) {
    var hit = applyProcessPunct(block, hangOpts);
    if (!hit) return;
    hit.block = block;
    hit.blockIndex = b;
    found = hit;
    return true;
  });
  return found;
}

function stepOneSurplus(root) {
  var found = null;
  eachTypesetBlock(root, function (block, b) {
    var hit = applyNextLineSurplusPadding(block);
    if (!hit) return;
    hit.kind = 'surplus';
    hit.block = block;
    hit.blockIndex = b;
    found = hit;
    return true;
  });
  return found;
}

function beginSurplusPhase(root, surplusOn) {
  if (root.nodeType === 1) root.setAttribute('data-ts-step-phase', 'surplus');
  return surplusOn ? stepOneSurplus(root) : null;
}

/**
 * 单步：组合符号 → 行边界空 / 行边界非法 → 行宽填满。
 * @returns {object|null} 本步结果；没有更多调整时为 null
 */
export function stepHangAvoidance(root, options) {
  root = defaultRoot(root);
  if (!root) return null;
  options = options || {};
  var hangOpts = mergeHangConfig(options.hang);
  var surplusOn = options.applyLineSurplusPadding !== false;
  var phase = root.getAttribute && root.getAttribute('data-ts-step-phase');

  if (phase === 'surplus') {
    return surplusOn ? stepOneSurplus(root) : null;
  }

  if (options.relaxBuiltinLineBreak !== false) {
    relaxBuiltinLineBreak(root);
    void root.offsetHeight;
  }

  if (options.applyComboSymbols !== false) {
    var comboHit = null;
    eachTypesetBlock(root, function (block, b) {
      var applied = applyComboSymbolsBlock(block, 1);
      if (!applied.length) return;
      comboHit = {
        kind: 'combo',
        block: block,
        blockIndex: b,
        lineIndex: -1,
        gaps: applied,
        count: applied.length,
      };
      return true;
    });
    if (comboHit) return comboHit;
  }

  var found = stepOneHang(root, hangOpts);
  if (found) return found;

  return beginSurplusPhase(root, surplusOn);
}
