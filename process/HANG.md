# 悬挂选项

打开悬挂：给 `applyHangAvoidance` 传入 `hangingPunctuation`。`可悬挂` 只在打开之后有字。`hangRight` 选下面这套谓词，第 5 步按 [PUNCT.md](PUNCT.md) 的表当场查。左挂两档只改第 3 步要不要再推盒。

流水线见 [TYPESET.md](TYPESET.md)。量宽见 [MEASURE.md](MEASURE.md)。

打开后默认右挂句读、缩进左挂、全局左挂关。置中固定表有字且未写 `hangRight` 时，默认 `'exceptCenterFixed'`。

```js
Katsuji.applyHangAvoidance(root, {
  hangingPunctuation: { hangLeftIndent: true, hangLeft: false, hangRight: 'stops' },
});
```

| `hangRight` | 可悬挂 |
|---|---|
| `'none'` | 无字 |
| `'stops'` | `，` `。` `、` |
| `'all'` | 在 `后有空` |
| `'exceptCenterFixed'` | 在 `后有空` 且不在 `置中固定` |

不置中时 `置中固定` 为空，`'all'` 与 `'exceptCenterFixed'` 相同。

| 左挂 | 何时推盒 |
|---|---|
| `hangLeftIndent`（打开悬挂时的默认） | 段首行且 `text-indent ≥ 0.5em`，墨进缩进 |
| `hangLeft`（默认关） | 每一行，墨进 2′ 左沟；段首同时开了缩进左挂时先吃缩进 |

2′ 左右各加 0.5em，与左挂档位无关。步骤见 [TYPESET.md · 2′](TYPESET.md#2-留悬挂沟每块一次至少一侧要挂才做) 和 [第 3 步](TYPESET.md#3-行首开括号顶格每行)。
