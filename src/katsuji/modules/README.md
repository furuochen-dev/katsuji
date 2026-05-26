# 模块目录

顺序见仓库根目录 `scripts/list-module-files.mjs` → `MODULE_ORDER`。构建输出在 `dist/`。

```
modules/
  core/
    punct-wrap.js     半角标点 span 包/拆（ts-half-punct 等）
  text/
    punctuation-rules.js

  measure/            只读量宽

  process/
    preprocess/
      line-break.js   容器 line-break: anywhere
      segmenter.js    插入 ts-gap，分段 char/gap；清 gap 样式
      combo.js        组合符号固定 margin
    postprocess/
      process-punct.js
      surplus.js
    orchestrate.js
```

- **`Katsuji.apply`** → `Segmenter.apply`（先插 gap）
- **`applyHangAvoidance`** → 需已 apply；用 gap 拉 margin，必要时 `PunctWrap` 包半角字

构建：`npm run build:katsuji`
