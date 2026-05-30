# 安装与使用

Katsuji 是浏览器端脚本：在标点外侧插入 `ts-gap`，再做避头避尾与行宽余量。挂载全局 `**Katsuji**`。

---

## 下载

任选一种方式拿到 `katsuji.css`、`katsuji.js`（以及可选的 `pretext-bridge.standalone.js`）。


| 文件                             | 必需  | 说明                                                                |
| ------------------------------ | --- | ----------------------------------------------------------------- |
| `katsuji.css`                  | 是   | `ts-gap` 等样式                                                      |
| `katsuji.js`                   | 是   | 主逻辑，`window.Katsuji`                                              |
| `pretext-bridge.standalone.js` | 否   | 可选；用 [pretext](https://github.com/chenglou/pretext) 做更快、更省资源的字宽测量 |


### npm

```bash
npm install katsuji
```

文件在 `node_modules/katsuji/dist/`。拷到你的静态资源目录，或由打包工具引用该路径。

版本见 [npm · katsuji](https://www.npmjs.com/package/katsuji)。

### CDN（jsDelivr，来自 npm 包）

固定版本（推荐，把 `0.1.1` 换成你要的版本）：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katsuji@0.1.1/dist/katsuji.css">
<script src="https://cdn.jsdelivr.net/npm/katsuji@0.1.1/dist/katsuji.js"></script>
```

字宽 bridge（可选）：

```html
<script src="https://cdn.jsdelivr.net/npm/katsuji@0.1.1/dist/pretext-bridge.standalone.js"></script>
```

### 本地

- **[GitHub Releases](https://github.com/furuochen-dev/katsuji/releases)**：下载 `dist` 打包（有发布时）。
- **自己构建**：克隆仓库 → `npm install` → `npm run build`，产物在 `dist/`（见 [DEVELOPMENT.md](DEVELOPMENT.md)）。
- **CI 产物**：仓库 **Actions** → 最新 **Build** → 下载 **dist** artifact，解压后拷贝上述文件。

---

## 使用

适合博客、静态站、任意能写 HTML 的页面。用 **HTTP** 打开（`npm run demo` 或任意静态服务器），不要用 `file://`。

### 基本页面

把下面里的 `katsuji.css` / `katsuji.js` 换成你**下载方式**对应的路径即可（相对路径、npm 拷出来的路径、或上一节 CDN 完整 URL）。

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

### 用 CDN 时

只需把 `href` / `src` 换成 jsDelivr 地址，例如：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katsuji@0.1.1/dist/katsuji.css">
<!-- … -->
<script src="https://cdn.jsdelivr.net/npm/katsuji@0.1.1/dist/katsuji.js"></script>
```

`apply` / `applyHangAvoidance` 写法不变。

### 可选：快速字宽测量

默认用 DOM 逐字测量，准确但较慢。需要更好性能时，在 `**katsuji.js` 之后** 再引 `pretext-bridge.standalone.js`（本地路径或 CDN 均可）；内部通过 [pretext](https://github.com/chenglou/pretext) 量宽，比 DOM 更省开销：

```html
<script src="katsuji.js"></script>
<script src="pretext-bridge.standalone.js"></script>
<script>
  var root = document.getElementById('content');
  Katsuji.apply(root);
  Katsuji.applyHangAvoidance(root);
</script>
```

加载后会自动注册 `Katsuji.setCharWidthMeasurer`，排版逻辑与未加载时相同。

### 路径与多页

- 多个文章块：对每个根节点分别调用，或包一层父元素后对父元素调用一次。
- 动态插入 DOM 后需对新内容再跑一遍 `apply` 与 `applyHangAvoidance`。

### 仓库内示例

先 `npm run build`，再 `npm run demo`：


| 页面                                                           | 说明                     |
| ------------------------------------------------------------ | ---------------------- |
| [examples/static.html](examples/static.html)                 | 最小静态页                  |
| [examples/static-pretext.html](examples/static-pretext.html) | 带 pretext bridge（快速字宽） |
| [examples/demo.html](examples/demo.html)                     | 调试面板                   |


---

## API

```js
Katsuji.apply(root);
Katsuji.applyHangAvoidance(root, options);
Katsuji.applyComboSymbols(root);
Katsuji.unrelaxBuiltinLineBreak(root);
Katsuji.setHangConfig(hangOptions);
Katsuji.defaultStrategyDecider(tieBreak);
```

`applyHangAvoidance` 常用选项：

```js
Katsuji.applyHangAvoidance(root, {
  relaxBuiltinLineBreak: false,
  applyLineSurplusPadding: false,
  applyComboSymbols: false,
  hang: { strategyDecider: Katsuji.defaultStrategyDecider('pull') },
});
```

### 挤进 / 推出策略（`hang.strategyDecider`）

避头避尾在「拉上一行空隙」与「推下一行空隙」之间择一时，由 `strategyDecider` 决定。函数签名：

```js
(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount) => 'push' | 'pull' | 'none'
```

- `'push'`：采用推出（正 margin，可能包半角 span）
- `'pull'`：采用挤进（负 margin）
- `'none'`：两侧皆不可用，本行跳过

内置默认策略 `Katsuji.defaultStrategyDecider(tieBreak)`：`tieBreak` 为 `'pull'` 或 `'push'`。比较两侧 per-gap 绝对量，更小者胜出；差值低于 `1e-6` 时采用 `tieBreak`；无法判定则 `'none'`。

根据 JIS X 4051:2004，我们的默认是相等时拉入；虽说 JIS 说的是所有情况都优先拉入，若这符合你的偏好，可以如下自定义。

```js
// 全局默认：接近相等时优先拉
Katsuji.setHangConfig({ strategyDecider: Katsuji.defaultStrategyDecider('pull') });

// 单次覆盖：接近相等时优先推
Katsuji.applyHangAvoidance(root, {
  hang: { strategyDecider: Katsuji.defaultStrategyDecider('push') },
});

// 完全自定义
Katsuji.setHangConfig({
  strategyDecider(pullAmountEm, pullGapCount, pushAmountEm, pushGapCount) {
    if (pullAmountEm <= 0 && pushAmountEm <= 0) return 'none';
    return pullAmountEm <= pushAmountEm ? 'pull' : 'push';
  },
});

Katsuji.config.hang; // 当前 hang 配置（含 strategyDecider）
```

调试 / 量宽：

```js
Katsuji.buildBlockLayout(block);
Katsuji.measureRootVisualLines(root);
Katsuji.measureLineVisualMetricsPx(block, items, start, end);
Katsuji.setCharWidthMeasurer(fn);
```

