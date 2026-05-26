/**
 * Katsuji 浏览器入口（esbuild → dist/katsuji.js，IIFE 全局 Katsuji）
 */
import './modules/00-prelude.js';
import './modules/core/config.js';
import './modules/core/dom-util.js';
import './modules/core/punct-wrap.js';
import './modules/text/punctuation-rules.js';
import './modules/measure/paragraph-items.js';
import './modules/measure/gap-padding-margin.js';
import './modules/measure/line-width.js';
import './modules/process/preprocess/line-break.js';
import './modules/process/preprocess/segmenter.js';
import './modules/process/preprocess/combo.js';
import './modules/process/postprocess/process-punct.js';
import './modules/process/postprocess/surplus.js';
import './modules/process/orchestrate.js';
import './modules/99-export.js';

export default KatsujiInternal.global.Katsuji;
