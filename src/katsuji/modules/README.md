# Katsuji 源码模块

对外入口：`src/katsuji/index.js`（按依赖顺序 import 各文件）。

构建：`npm run build:katsuji`（esbuild → `dist/katsuji.js`）  
开发：`npm run dev`（监听重建）

## 目录

```
preprocess/   line-break、segmenter（插 gap）、combo
measure/      段落结构、gap 量宽、行宽
postprocess/  process-punct、surplus
process/      orchestrate
```

各文件为 IIFE，挂载到共享的 `KatsujiInternal`；`99-export.js` 暴露全局 `Katsuji`。
