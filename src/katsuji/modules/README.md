# Katsuji 源码模块

对外入口：`src/katsuji/index.js`（import 各模块并组装 `Katsuji` API）。

构建：`npm run build`（esbuild → `dist/katsuji.js`）  
开发：`npm run dev`（监听重建）

## 目录

```
core/         config、dom-util、punct-wrap、punct-config
text/         punctuation-rules
measure/      段落结构、gap 量宽、行宽
process/
  typeset-rules.js   第 4–5 步纯规则、可悬挂、行宽
  process-line.js    一行 3→4→5
  orchestrate.js     整篇 / 步进
  hanging-pad.js     2′ 悬挂沟
  line-end.js        第 5 步
  preprocess/        line-break、segmenter、combo
  postprocess/       space-on-edge（第 3 步）、surplus（可选填满）
env.js        浏览器 document/window 引用
```

各模块为 **ESM**（`export` / `import`），由 `index.js` 汇总为全局 `Katsuji`（IIFE 打包）。

过程怎么串起来：[TYPESET.md](../../../process/TYPESET.md)。标点表 [PUNCT.md](../../../process/PUNCT.md)，悬挂 [HANG.md](../../../process/HANG.md)，量宽 [MEASURE.md](../../../process/MEASURE.md)。
