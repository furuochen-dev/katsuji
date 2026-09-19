排版流水线见 [TYPESET.md](process/TYPESET.md)。标点表 [PUNCT.md](process/PUNCT.md)，悬挂 [HANG.md](process/HANG.md)，量宽 [MEASURE.md](process/MEASURE.md)。

## 参与开发

```
src/katsuji/
  index.js              # esbuild 入口
  modules/
  styles/katsuji.css
dist/                   # 构建输出（gitignore）
examples/
scripts/
  bundle-katsuji.mjs
  dev.mjs
```

```bash
npm install
npm test               # Node 规则测试
npm run test:browser   # Playwright（test/browser）
npm run build          # dist/katsuji.js + katsuji.css
npm run dev            # 监听 src/katsuji，自动重建 dist（测 static.html 等用）
npm run demo           # http://localhost:4173/examples/demo.html（直接 import 源码，无需 build）
```

| 命令 | 作用 |
|------|------|
| `npm test` | `test/*.test.js` |
| `npm run test:browser` | Playwright 流水线 |
| `npm run build` | `dist/katsuji.js` + `katsuji.css` |
| `npm run dev` | watch `dist/katsuji.js` |
