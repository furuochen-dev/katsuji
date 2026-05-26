# Katsuji

中文排版浏览器脚本：在标点外侧插入 `ts-gap`，再做避头避尾与行宽余量。

- **用法**：普通静态 HTML，两个文件 + `<script>`，全局 **`Katsuji`**
- **源码**：`main` 分支只有 `src/`，不提交 `dist/`
- **构建**：本地 `npm run build`（esbuild），或推 `main` 后由 GitHub Actions 发布到 **`gh-pages`**

---

## 标准使用流程（静态网页）

### 1. 拿到文件

任选一种方式：

| 方式 | 适合谁 |
|------|--------|
| **jsDelivr（CDN）** | 已有线上站点，不想下载 |
| **拷贝 `dist/`** | 自建站、离线部署 |
| **Actions 下载** | 不想本地装 Node |

构建产物（每次 `npm run build` 或 CI 成功后）：

| 文件 | 必需 | 说明 |
|------|------|------|
| `katsuji.css` | 是 | `ts-gap` 样式 |
| `katsuji.js` | 是 | 主逻辑，暴露 `window.Katsuji` |
| `pretext-bridge.standalone.js` | 否 | 用 pretext 量字宽时再引 |

### 2. 写 HTML

```html
<link rel="stylesheet" href="katsuji.css" />

<article id="content">
  <p>他说，《红楼梦》是一部奇书，而「脂砚斋」批语更让读者着迷：你怎么看？</p>
</article>

<script src="katsuji.js"></script>
<script>
  var root = document.getElementById('content');

  // ① 按禁则在标点外侧插入 ts-gap（必须先做）
  Katsuji.apply(root);

  // ② 组合符号 + 避头避尾 + 行宽余量
  Katsuji.applyHangAvoidance(root);
</script>
```

顺序固定：**先 `apply`，再 `applyHangAvoidance`**。

### 3. （可选）pretext 字宽

默认用 DOM 量字宽；若要与 [pretext](https://github.com/chenglou/pretext) 一致，在 `katsuji.js` **之后**再加：

```html
<script src="katsuji.js"></script>
<script src="pretext-bridge.standalone.js"></script>
<script>
  Katsuji.apply(root);
  Katsuji.applyHangAvoidance(root);
</script>
```

`pretext-bridge.standalone.js` 加载后会自动挂到 `Katsuji.setCharWidthMeasurer`。

---

## 从 CDN 引用（推荐）

文件在 **`gh-pages` 分支**（不是 `main`）；推 `main` 并等 [Actions](.github/workflows/build.yml) 跑通后可用。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/furuochen-dev/katsuji@gh-pages/katsuji.css">
<script src="https://cdn.jsdelivr.net/gh/furuochen-dev/katsuji@gh-pages/katsuji.js"></script>
```

pretext：

```html
<script src="https://cdn.jsdelivr.net/gh/furuochen-dev/katsuji@gh-pages/pretext-bridge.standalone.js"></script>
```

---

## 本地构建后拷贝

```bash
git clone https://github.com/furuochen-dev/katsuji.git
cd katsuji
npm install
npm run build
```

从 **`dist/`** 拷 `katsuji.js`、`katsuji.css`（及可选的 `pretext-bridge.standalone.js`）到你的站点目录。

本地试示例（需先 `build`，并用 HTTP 打开，不要直接 `file://`）：

```bash
npm run demo
# 浏览器打开 http://localhost:4173/examples/static.html
```

| 示例 | 说明 |
|------|------|
| [examples/static.html](examples/static.html) | 最小静态页 |
| [examples/static-pretext.html](examples/static-pretext.html) | 带 pretext |
| [examples/demo.html](examples/demo.html) | 调试面板（行宽分解等） |

---

## API

```js
Katsuji.apply(root);                              // 插入 ts-gap
Katsuji.applyHangAvoidance(root, options);        // 排版主流程
Katsuji.applyComboSymbols(root);                  // 仅组合符号（通常已包含在 applyHangAvoidance）
Katsuji.unrelaxBuiltinLineBreak(root);            // 恢复容器 line-break
Katsuji.setHangConfig({ debugWholeCharPush: true });
```

`applyHangAvoidance` 常用选项：

```js
Katsuji.applyHangAvoidance(root, {
  relaxBuiltinLineBreak: false,   // 不改容器 line-break
  applyLineSurplusPadding: false, // 不做行末余量匀 padding
  applyComboSymbols: false,
  hang: { debugWholeCharPush: true },
});
```

调试 / 量宽：

```js
Katsuji.buildBlockLayout(block);
Katsuji.measureRootVisualLines(root);
Katsuji.measureLineVisualMetricsPx(block, items, start, end);
Katsuji.setCharWidthMeasurer(fn);  // pretext-bridge 会注入
```

---

## 参与开发

### 仓库结构

```
src/katsuji/
  index.js              # esbuild 入口
  modules/              # 功能模块
  styles/katsuji.css
src/pretext/            # pretext 桥接源码
dist/                   # 构建输出（gitignore）
examples/
scripts/
  bundle-katsuji.mjs    # esbuild → dist/katsuji.js
  bundle-pretext-bridge.mjs
  dev.mjs               # watch 重建
```

构建方式：从 `src/katsuji/index.js` **import** 各模块，**esbuild** 打成浏览器 IIFE（`globalName: Katsuji`），与 Rollup/Webpack 同类流程。

### 命令

```bash
npm install
npm run build          # dist/katsuji.js + katsuji.css + pretext bundles
npm run dev            # 监听 src/katsuji，改完自动重建 dist
npm run demo           # http://localhost:4173/examples/demo.html
```

| 命令 | 作用 |
|------|------|
| `npm run build` | 完整构建 |
| `npm run build:katsuji` | 仅主库 |
| `npm run build:pretext` | 仅 pretext bridge |
| `npm run dev` | watch `dist/katsuji.js` |

改 `src/katsuji/modules/` 时开 `npm run dev`，再用 `npm run demo` 看 [examples/demo.html](examples/demo.html)。

### CI

推送到 **`main`** 时 [GitHub Actions](.github/workflows/build.yml) 会：

1. `npm ci` → `npm run build` 校验  
2. 将 `dist/` 推到 **`gh-pages`** 分支（供 CDN / Pages）  
3. 上传 **Artifacts** → `dist.zip`

PR 只跑构建校验，不更新 `gh-pages`。

### GitHub Pages 设置（可选）

若要用 `https://furuochen-dev.github.io/katsuji/` 浏览文件，在 **Settings → Pages** 里：

| 项 | 应选 |
|----|------|
| Source | **Deploy from a branch**（不要选 GitHub Actions / Jekyll） |
| Branch | **`gh-pages`**，文件夹 **`/ (root)`** |

不要选 `main` 或 `/docs`——仓库没有 Jekyll 站点，那样会触发 **pages build and deployment** 失败（找 `./docs` 目录）。

CI 会在 `gh-pages` 根目录写入 `.nojekyll` 与 **`index.html`**（Pages 首页 demo）。jsDelivr **不依赖** Pages 是否开启。

| URL | 说明 |
|-----|------|
| https://furuochen-dev.github.io/katsuji/ | Pages 首页（在线 demo） |
| https://furuochen-dev.github.io/katsuji/katsuji.js | 直接下载脚本 |

根路径 `/katsuji/` 以前会 404，是因为只有 js/css、没有 `index.html`。
