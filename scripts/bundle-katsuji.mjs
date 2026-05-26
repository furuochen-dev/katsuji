#!/usr/bin/env node
/**
 * 将 src/katsuji/modules 合并为 dist/katsuji.js，并复制 CSS。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectModuleFiles, readModuleSources } from './list-module-files.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const modDir = path.join(root, 'src/katsuji/modules');
const distDir = path.join(root, 'dist');
const outFile = path.join(distDir, 'katsuji.js');
const cssSrc = path.join(root, 'src/katsuji/styles/katsuji.css');
const cssOut = path.join(distDir, 'katsuji.css');

fs.mkdirSync(distDir, { recursive: true });

const files = collectModuleFiles(modDir);
const body = readModuleSources(modDir, files);

const banner = `/**
 * Katsuji — 中文标点外侧空隙与避头避尾
 * 源码：src/katsuji/modules/ — 构建：npm run build:katsuji
 */
`;

const out =
  banner +
  '(function (global) {\n' +
  "'use strict';\n\n" +
  body +
  '\n})(typeof window !== \'undefined\' ? window : this);\n';

fs.writeFileSync(outFile, out);
fs.copyFileSync(cssSrc, cssOut);
fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(files, null, 2) + '\n');
console.log('Wrote', path.relative(root, outFile), '(' + files.length + ' modules)');
console.log('Wrote', path.relative(root, cssOut));
