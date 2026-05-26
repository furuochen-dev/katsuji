# 安装与使用

Katsuji 是浏览器端脚本：在标点外侧插入 `ts-gap`，再做避头避尾与行宽余量。挂载全局 **`Katsuji`**。

---

## 静态网页

适合博客、静态站、任意能写 HTML 的页面。**不依赖 npm、不依赖构建工具。**

### 需要哪些文件

把下面两个文件放到你的站点目录（与 HTML 同目录，或自行改路径）：

| 文件 | 必需 | 说明 |
|------|------|------|
| `katsuji.css` | 是 | `ts-gap` 等样式 |
| `katsuji.js` | 是 | 主逻辑，`window.Katsuji` |
| `pretext-bridge.standalone.js` | 否 | 仅在与 [pretext](https://github.com/chenglou/pretext) 对齐字宽时需要 |

**拿到文件的方式：**

1. 从本仓库 [Releases](https://github.com/furuochen-dev/katsuji/releases) 下载打包好的 `dist`（有发布时）。
2. 或克隆仓库后本地构建（见文末「从源码构建」）。
3. 或从 CI：仓库 **Actions** → 最新成功的 **Build** → 下载 **dist** artifact，解压后拷贝上述文件。

### 最小页面

用 HTTP 访问页面（`npm run demo` 或任意静态服务器），不要用 `file://`，否则部分浏览器对脚本限制较严。

```html
<!DOCTYPE html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>示例</title>
  <link rel="stylesheet" href="katsuji.css" />
</head>
<body>
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
</body>
</html>
```

**调用顺序固定：先 `Katsuji.apply`，再 `Katsuji.applyHangAvoidance`。**

### 可选：pretext 字宽

默认用 DOM 测量字宽。若要与 pretext 一致，在 **`katsuji.js` 之后** 再引入 bridge，调用顺序不变：

```html
<link rel="stylesheet" href="katsuji.css" />
<article id="content">…</article>

<script src="katsuji.js"></script>
<script src="pretext-bridge.standalone.js"></script>
<script>
  var root = document.getElementById('content');
  Katsuji.apply(root);
  Katsuji.applyHangAvoidance(root);
</script>
```

`pretext-bridge.standalone.js` 加载后会自动注册 `Katsuji.setCharWidthMeasurer`。

### 路径与多页

- CSS、JS 可用相对路径（如上）或站点根路径绝对路径（如 `/assets/katsuji.js`）。
- 多个文章块：对每个根节点分别 `apply` / `applyHangAvoidance`，或包一层父元素后对父元素调用一次。
- 动态插入 DOM 后需对新内容再跑一遍上述两步。

### 仓库内示例

先 `npm run build`，再 `npm run demo`，浏览器打开：

| 页面 | 说明 |
|------|------|
| [examples/static.html](examples/static.html) | 最小静态页 |
| [examples/static-pretext.html](examples/static-pretext.html) | 带 pretext |
| [examples/demo.html](examples/demo.html) | 调试面板 |

---

## npm / CDN

包名 **`katsuji`**。发布到 npm 后可用 jsDelivr（与静态拷贝二选一，适合已有前端工程或不想手拷文件时）。

> 版本号以 [npm](https://www.npmjs.com/package/katsuji) 为准；发版流程见 [DEVELOPMENT.md#发布-npm](DEVELOPMENT.md#发布-npm)。

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katsuji@0.1.0/dist/katsuji.css">
<script src="https://cdn.jsdelivr.net/npm/katsuji@0.1.0/dist/katsuji.js"></script>
```

pretext bridge：

```html
<script src="https://cdn.jsdelivr.net/npm/katsuji@0.1.0/dist/pretext-bridge.standalone.js"></script>
```

本地安装（Node 项目里拷贝到静态资源目录，或自行托管 `node_modules/katsuji/dist/` 下文件）：

```bash
npm install katsuji
```

---

## API

```js
Katsuji.apply(root);
Katsuji.applyHangAvoidance(root, options);
Katsuji.applyComboSymbols(root);
Katsuji.unrelaxBuiltinLineBreak(root);
Katsuji.setHangConfig({ debugWholeCharPush: true });
```

`applyHangAvoidance` 常用选项：

```js
Katsuji.applyHangAvoidance(root, {
  relaxBuiltinLineBreak: false,
  applyLineSurplusPadding: false,
  applyComboSymbols: false,
  hang: { debugWholeCharPush: true },
});
```

调试 / 量宽：

```js
Katsuji.buildBlockLayout(block);
Katsuji.measureRootVisualLines(root);
Katsuji.measureLineVisualMetricsPx(block, items, start, end);
Katsuji.setCharWidthMeasurer(fn);
```

---

## 从源码构建

参与开发见 [DEVELOPMENT.md](DEVELOPMENT.md)。

```bash
git clone https://github.com/furuochen-dev/katsuji.git
cd katsuji
npm install
npm run build
```

产物在 **`dist/`**，拷到你的静态站即可。
