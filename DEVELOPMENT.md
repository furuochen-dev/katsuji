## 参与开发

```
src/katsuji/
  index.js              # esbuild 入口
  modules/
  styles/katsuji.css
src/pretext/
dist/                   # 构建输出（gitignore）
examples/
scripts/
  bundle-katsuji.mjs
  bundle-pretext-bridge.mjs
  dev.mjs
```

```bash
npm install
npm run build          # dist/katsuji.js + katsuji.css + pretext bundles
npm run dev            # 监听 src/katsuji，自动重建 dist
npm run demo           # http://localhost:4173/examples/demo.html
```

| 命令 | 作用 |
|------|------|
| `npm run build` | 完整构建 |
| `npm run build:katsuji` | 仅主库 |
| `npm run build:pretext` | 仅 pretext bridge |
| `npm run dev` | watch `dist/katsuji.js` |

### 发布 npm

- 首次：本地 `npm login` → `npm publish --access public`（`prepublishOnly` 会先 `build`）。
- 之后：改 `package.json` 的 `version`，提交后打 tag 并推送，例如 `v0.1.1` 对应 `"version": "0.1.1"`，由 [publish-npm.yml](.github/workflows/publish-npm.yml) 发布。仓库 Settings → Secrets 需配置 **`NPM_TOKEN`**（npm 上创建 **Automation** 或 **Publish** token）。
