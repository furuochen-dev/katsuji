#!/usr/bin/env node
/** 生成 src/katsuji/modules/manifest.json，供 demo 按序加载源码 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectModuleFiles } from './list-module-files.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modDir = path.join(__dirname, '../src/katsuji/modules');
const files = collectModuleFiles(modDir);

fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(files, null, 2) + '\n');
console.log('Wrote manifest.json (' + files.length + ' modules)');
