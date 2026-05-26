#!/usr/bin/env node
/** 监听源码，自动重建 dist/katsuji.js */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cssSrc = path.join(root, 'src/katsuji/styles/katsuji.css');
const cssOut = path.join(path.join(root, 'dist'), 'katsuji.css');

fs.mkdirSync(path.dirname(cssOut), { recursive: true });

const ctx = await esbuild.context({
  entryPoints: [path.join(root, 'src/katsuji/index.js')],
  bundle: true,
  outfile: path.join(root, 'dist/katsuji.js'),
  format: 'iife',
  globalName: 'Katsuji',
  platform: 'browser',
  target: ['es2018'],
  banner: {
    js: '/** Katsuji — dev build */',
  },
});

function copyCss() {
  fs.copyFileSync(cssSrc, cssOut);
}

await ctx.rebuild();
copyCss();
console.log('dist/katsuji.js ready — watching src/katsuji/ …');

await ctx.watch();
fs.watch(path.dirname(cssSrc), copyCss);
