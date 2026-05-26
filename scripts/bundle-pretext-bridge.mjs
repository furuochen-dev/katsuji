#!/usr/bin/env node
/**
 * 将 src/pretext 打成 dist/pretext-bridge.*.js（内联 @chenglou/pretext）。
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const entry = path.join(root, 'src/pretext/pretext-bridge.js');
const banner = `/**
 * pretext 字宽注入 Katsuji（内联 @chenglou/pretext）
 * 源码：src/pretext/ — 构建：npm run build:pretext
 */
`;

fs.mkdirSync(distDir, { recursive: true });

const outs = [
  { file: 'pretext-bridge.bundle.js', args: ['--format=esm'] },
  { file: 'pretext-bridge.standalone.js', args: ['--format=iife', '--global-name=PretextBridge'] },
];

for (const { file, args } of outs) {
  const outPath = path.join(distDir, file);
  execFileSync(
    'npx',
    ['--yes', 'esbuild', entry, '--bundle', '--platform=browser', '--outfile=' + outPath, ...args],
    { cwd: root, stdio: 'inherit' }
  );
  fs.writeFileSync(outPath, banner + fs.readFileSync(outPath, 'utf8'));
  console.log('Wrote', path.join('dist', file), `(${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
