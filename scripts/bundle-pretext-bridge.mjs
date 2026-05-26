#!/usr/bin/env node
/**
 * esbuild：src/pretext → dist/pretext-bridge.*.js（内联 @chenglou/pretext）
 */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const entry = path.join(root, 'src/pretext/pretext-bridge.js');

fs.mkdirSync(distDir, { recursive: true });

const banner =
  '/** pretext 字宽注入 Katsuji（内联 @chenglou/pretext）| build: npm run build:pretext */\n';

const outs = [
  { file: 'pretext-bridge.bundle.js', format: 'esm' },
  { file: 'pretext-bridge.standalone.js', format: 'iife', globalName: 'PretextBridge' },
];

for (const { file, format, globalName } of outs) {
  const outPath = path.join(distDir, file);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: outPath,
    format,
    globalName,
    platform: 'browser',
    target: ['es2018'],
  });
  fs.writeFileSync(outPath, banner + fs.readFileSync(outPath, 'utf8'));
  console.log('Wrote', path.join('dist', file), `(${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
