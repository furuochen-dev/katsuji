#!/usr/bin/env node
/**
 * esbuild：src/katsuji/index.js → dist/katsuji.js（IIFE，全局 Katsuji）
 */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const cssSrc = path.join(root, 'src/katsuji/styles/katsuji.css');
const cssOut = path.join(distDir, 'katsuji.css');

fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, 'src/katsuji/index.js')],
  bundle: true,
  outfile: path.join(distDir, 'katsuji.js'),
  format: 'iife',
  globalName: 'Katsuji',
  platform: 'browser',
  target: ['es2018'],
  banner: {
    js: '/** Katsuji — 中文标点外侧空隙与避头避尾 | build: npm run build:katsuji */',
  },
});

fs.copyFileSync(cssSrc, cssOut);
const pagesIndex = path.join(root, 'pages/index.html');
if (fs.existsSync(pagesIndex)) {
  fs.copyFileSync(pagesIndex, path.join(distDir, 'index.html'));
}
console.log('Wrote dist/katsuji.js');
console.log('Wrote dist/katsuji.css');
