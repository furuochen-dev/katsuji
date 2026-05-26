# Katsuji · 中文标点外侧空隙与避头避尾

浏览器脚本：在标点外侧插入 `ts-gap`，再做避头避尾与行宽余量。

**本仓库主分支只有源码**；`dist/` 由 [GitHub Actions](.github/workflows/build.yml) 在每次推送到 `main` 时自动构建，并发布到 **`gh-pages` 分支**（也可在 Actions 页下载 artifact）。

## 仓库结构

```
src/          # 源码
examples/     # 示例页
scripts/      # 构建脚本
dist/         # 本地 npm run build 生成（已 gitignore，不提交）
```

## 静态页（用构建好的 js）

### 方式一：jsDelivr（推荐，不用 clone）

把 `你的用户名` 换成 GitHub 用户名/组织名：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/你的用户名/katsuji@gh-pages/katsuji.css">
<script src="https://cdn.jsdelivr.net/gh/你的用户名/katsuji@gh-pages/katsuji.js"></script>
```

pretext 字宽再加：

```html
<script src="https://cdn.jsdelivr.net/gh/你的用户名/katsuji@gh-pages/pretext-bridge.standalone.js"></script>
```

（文件来自 **`gh-pages` 分支**，不是 `main`。首次推送 `main` 并等 Actions 跑完后才有。）

### 方式二：本地 build 后拷贝

```bash
npm install
npm run build
```

从本地 **`dist/`** 拷贝到站点：

| 文件 | 说明 |
|------|------|
| `katsuji.js` | 主脚本，全局 `Katsuji` |
| `katsuji.css` | `ts-gap` 必需样式 |

```html
<link rel="stylesheet" href="katsuji.css" />
<article id="content">
  <p>他说，《红楼梦》是一部奇书……</p>
</article>
<script src="katsuji.js"></script>
<script>
  var root = document.getElementById('content');
  Katsuji.apply(root);
  Katsuji.applyHangAvoidance(root);
</script>
```

示例：[examples/static.html](examples/static.html)（本地需先 `npm run build`，指向 `../dist/`）。

### 方式三：从 GitHub Actions 下载

仓库 → **Actions** → 最新成功的 **Build** → 底部 **Artifacts** → `dist.zip`。

## pretext 字宽（可选）

需要与 pretext 引擎一致的字宽时，再多拷 **`dist/pretext-bridge.standalone.js`**，放在 `katsuji.js` 之后：

```html
<script src="katsuji.js"></script>
<script src="pretext-bridge.standalone.js"></script>
```

示例：[examples/static-pretext.html](examples/static-pretext.html)。

开发调试（import map + 源码）见 [examples/demo.html](examples/demo.html)。

## API 摘要

```js
Katsuji.apply(root);
Katsuji.applyHangAvoidance(root, opts);
Katsuji.unrelaxBuiltinLineBreak(root);
Katsuji.setHangConfig({ debugWholeCharPush: true });
```

常用选项：`relaxBuiltinLineBreak: false`、`applyLineSurplusPadding: false`、`hang: { debugWholeCharPush: true }`。

## 开发

```bash
npm install
npm run build          # dist/katsuji.js + css + pretext bundles
npm run demo           # http://localhost:4173/examples/demo.html
```

| 命令 | 作用 |
|------|------|
| `npm run build:katsuji` | 仅打包主库 + 复制 CSS |
| `npm run build:pretext` | 仅打包 pretext bridge |
| `npm run demo` | 本地预览 examples |

Demo 默认加载 `src/katsuji/modules/`；`?bundle=1` 改用 `dist/katsuji.js`。

## GitHub Actions

| 触发 | 行为 |
|------|------|
| PR / 推送到 `main` | `npm run build` 校验 |
| 推送到 `main` | 额外把 `dist/` 推到 **`gh-pages` 分支** |
| 手动 | Actions 页 **Run workflow** |

可选：在仓库 **Settings → Pages** 里把 Source 设为 **Deploy from branch → gh-pages → /**，即可用 `https://<user>.github.io/katsuji/` 浏览构建产物（jsDelivr 不依赖此项）。
