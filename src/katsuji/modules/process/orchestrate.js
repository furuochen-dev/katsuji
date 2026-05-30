/** 编排 */
import { mergeHangConfig } from '../core/config.js';
import { applyComboSymbolsBlock } from './preprocess/combo.js';
import { resetGapStyles } from './preprocess/segmenter.js';
import { unwrapHalfPunctInBlock } from '../core/punct-wrap.js';
import { applyProcessPunct } from './postprocess/process-punct.js';
import { applyLineSurplusPaddingByVisualWidth } from './postprocess/surplus.js';
import { relaxBuiltinLineBreak, unrelaxBuiltinLineBreak } from './preprocess/line-break.js';
import { defaultRoot } from '../env.js';

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
  var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
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
  }
  unrelaxBuiltinLineBreak(root)
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
    if (options.applyLineSurplusPadding !== false) {
      applyLineSurplusPaddingByVisualWidth(block);
    }
  }
}
