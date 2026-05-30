/**
 * Katsuji 浏览器入口（esbuild → dist/katsuji.js，IIFE 全局 Katsuji）
 */
import { hangConfig, mergeHangConfig } from './modules/core/config.js';
import { punctConfig, mergePunctConfig, applyPunctPreset } from './modules/core/punct-config.js';
import { apply } from './modules/process/preprocess/segmenter.js';
import { applyHangAvoidance } from './modules/process/orchestrate.js';
import { applyComboSymbols } from './modules/process/preprocess/combo.js';
import {
  relaxBuiltinLineBreak,
  unrelaxBuiltinLineBreak,
} from './modules/process/preprocess/line-break.js';
import { applyLineSurplusPaddingByVisualWidth } from './modules/process/postprocess/surplus.js';
import {
  buildBlockLayout,
  measureBlockVisualLines,
  measureRootVisualLines,
  measureLineVisualMetricsPx,
  setCharWidthMeasurer,
  defaultStrategyDecider,
} from './modules/measure/line-width.js';
import {
  flattenParagraph,
  findLineFirstCharIndices,
  lineItemBounds,
  lineCharsFromItems,
} from './modules/measure/paragraph-items.js';
import { gapPmPx, comboFixedGapPmPx, lineGapPmSumsPx } from './modules/measure/gap-padding-margin.js';

const Katsuji = {
  config: { hang: hangConfig, punct: punctConfig },
  setHangConfig: mergeHangConfig,
  setPunctConfig: mergePunctConfig,
  applyPunctPreset,
  defaultStrategyDecider,
  apply,
  applyHangAvoidance,
  applyLineSurplusPaddingByVisualWidth,
  applyComboSymbols,
  relaxBuiltinLineBreak,
  unrelaxBuiltinLineBreak,
  buildBlockLayout,
  measureBlockVisualLines,
  measureRootVisualLines,
  measureLineVisualMetricsPx,
  flattenParagraph,
  findLineFirstCharIndices,
  lineItemBounds,
  lineCharsFromItems,
  gapPmPx,
  sumLineAllGapPmPx(items, startIndex, endIndex) {
    return lineGapPmSumsPx(items, startIndex, endIndex).gapPmPx;
  },
  comboFixedGapPmPx,
  setCharWidthMeasurer,
};

export default Katsuji;
