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
npm run build          # dist/katsuji.js + katsuji.css
npm run dev            # 监听 src/katsuji，自动重建 dist（测 static.html 等用）
npm run demo           # http://localhost:4173/examples/demo.html（直接 import 源码，无需 build）
```

| 命令 | 作用 |
|------|------|
| `npm run build` | 完整构建 |
| `npm run build:katsuji` | 仅主库 |
| `npm run dev` | watch `dist/katsuji.js` |
