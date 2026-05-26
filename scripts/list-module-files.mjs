/** 模块加载顺序（显式列表） */
import fs from 'fs';
import path from 'path';

const MODULE_ORDER = [
  '00-prelude.js',
  'core/config.js',
  'core/dom-util.js',
  'core/punct-wrap.js',
  'text/punctuation-rules.js',
  'measure/paragraph-items.js',
  'measure/gap-padding-margin.js',
  'measure/line-width.js',
  'process/preprocess/line-break.js',
  'process/preprocess/segmenter.js',
  'process/preprocess/combo.js',
  'process/postprocess/process-punct.js',
  'process/postprocess/surplus.js',
  'process/orchestrate.js',
  '99-export.js',
];

export function collectModuleFiles(modDir) {
  const missing = [];
  for (const rel of MODULE_ORDER) {
    if (!fs.existsSync(path.join(modDir, rel))) missing.push(rel);
  }
  if (missing.length) {
    throw new Error('Missing modules: ' + missing.join(', '));
  }
  return MODULE_ORDER.slice();
}

export function readModuleSources(modDir, files) {
  return files
    .map((rel) => fs.readFileSync(path.join(modDir, rel), 'utf8').trim())
    .join('\n\n');
}
