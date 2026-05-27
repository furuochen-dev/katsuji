# Katsuji 源码模块

对外入口：`src/katsuji/index.js`（import 各模块并组装 `Katsuji` API）。

构建：`npm run build:katsuji`（esbuild → `dist/katsuji.js`）  
开发：`npm run dev`（监听重建）

## 目录

```
core/         config、dom-util、punct-wrap
text/         punctuation-rules
measure/      段落结构、gap 量宽、行宽
preprocess/   line-break、segmenter、combo
postprocess/  process-punct、surplus
process/      orchestrate
env.js        浏览器 document/window 引用
```

各模块为 **ESM**（`export` / `import`），由 `index.js` 汇总为全局 `Katsuji`（IIFE 打包）。
