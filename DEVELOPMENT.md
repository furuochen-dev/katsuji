排版流水线（切缝、连写、避头尾、填满、步进）见 [TYPESET.md](TYPESET.md)。

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
