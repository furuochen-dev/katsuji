/**
 * Katsuji 浏览器入口（esbuild → dist/katsuji.js，IIFE 全局 Katsuji）
 */
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
} from './modules/measure/line-width.js';
import {
  flattenParagraph,
  findLineFirstCharIndices,
  lineItemBounds,
  lineCharsFromItems,
} from './modules/measure/paragraph-items.js';
import { gapPmPx, comboFixedGapPmPx, lineGapPmSumsPx } from './modules/measure/gap-padding-margin.js';

const Katsuji = {
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
