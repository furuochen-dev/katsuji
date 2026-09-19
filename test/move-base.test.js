import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectPull51,
  collectPush51,
  collectPull52,
  collectPush52,
  nextLineStartsForbidden,
  computeLineEndBases,
  opticalMoveEm,
  hangAmountsEm,
  comboDeductionEm,
  decideHangStrategy,
} from '../src/katsuji/modules/process/typeset-rules.js';

describe('5.1 收集（下行打头是不能在行头）', function () {
  it('压入：连续禁则，碰到可行头的字就停', function () {
    assert.deepEqual(collectPull51(['。', '」', '汉']), ['。', '」']);
    assert.deepEqual(collectPull51(['。', '汉']), ['。']);
    assert.deepEqual(collectPull51(['…', '文']), ['…']);
    assert.deepEqual(collectPull51(['。']), ['。']);
  });

  it('压入：行头就是汉字时不该走 5.1', function () {
    assert.equal(nextLineStartsForbidden(['汉', '。']), false);
    assert.deepEqual(collectPull51(['汉', '。']), []);
  });

  it('推出：行尾禁则（0 个也行）再加上前面那个可行头的字', function () {
    assert.deepEqual(collectPush51(['文', '本', '汉', '。', '」']), ['汉', '。', '」']);
    assert.deepEqual(collectPush51(['文', '本', '汉']), ['汉']);
    assert.deepEqual(collectPush51(['文', '。']), ['文', '。']);
  });

  it('跳过空白再收集', function () {
    assert.deepEqual(collectPull51([' ', '。', '」']), ['。', '」']);
    assert.deepEqual(collectPush51(['汉', ' ', '。']), ['汉', '。']);
  });
});

describe('5.2 收集（下行不是不能在行头）', function () {
  it('压入：行头连续前有空 + 再一个不是前有空的字 + 其后连续不能在行头', function () {
    assert.deepEqual(collectPull52(['汉', '字']), ['汉']);
    assert.deepEqual(collectPull52(['（', '汉']), ['（', '汉']);
    assert.deepEqual(collectPull52(['（', '《', '汉']), ['（', '《', '汉']);
    assert.deepEqual(collectPull52(['（', '（']), ['（', '（']);
    assert.deepEqual(collectPull52(['了', '」', '但']), ['了', '」']);
    assert.deepEqual(collectPull52(['了', '」', '。', '但']), ['了', '」', '。']);
    assert.deepEqual(collectPull52(['（', '了', '」', '但']), ['（', '了', '」']);
  });

  it('推出：行尾连续前有空，可以是 0 个', function () {
    assert.deepEqual(collectPush52(['文', '本', '（']), ['（']);
    assert.deepEqual(collectPush52(['文', '（', '「']), ['（', '「']);
    assert.deepEqual(collectPush52(['文', '本', '汉']), []);
    assert.deepEqual(collectPush52(['文', '。']), []);
  });
});

describe('5.1 基数（含推拉造成的连写）', function () {
  it('抽 。」：串内连写 −0.5，」收半角再 −0.5', function () {
    var b = computeLineEndBases(['文', '本', '汉'], ['。', '」', '下']);
    assert.equal(b.branch, '5.1');
    assert.deepEqual(b.pullChars, ['。', '」']);
    assert.equal(b.pullBaseEm, 1);
  });

  it('抽 。」 若不扣连写会按 1.5 计，selector 会改推', function () {
    var withCombo = opticalMoveEm(['。', '」'], {
      junctionLeft: '汉',
      deductInternalCombo: true,
      wrapLastHalf: true,
    });
    var withoutCombo = opticalMoveEm(['。', '」'], {
      junctionLeft: '汉',
      deductInternalCombo: false,
      wrapLastHalf: true,
    });
    assert.equal(withCombo, 1);
    assert.equal(withoutCombo, 1.5);
    var leftover = 0.5;
    assert.equal(withCombo - leftover, 0.5);
    assert.ok(withoutCombo - leftover > 0.5);
  });

  it('行尾是 。、抽 」：接缝连写 −0.5，再收半角 −0.5', function () {
    var b = computeLineEndBases(['文', '。'], ['」', '下']);
    assert.equal(comboDeductionEm('。', '」'), 0.5);
    assert.equal(b.pullBaseEm, 0);
  });

  it('抽单个 。：无连写，收半角 −0.5', function () {
    var b = computeLineEndBases(['汉'], ['。', '下']);
    assert.equal(b.pullBaseEm, 0.5);
  });

  it('抽 …：两侧无空不收半角，基数 1', function () {
    var b = computeLineEndBases(['汉'], ['…', '下']);
    assert.equal(b.pullBaseEm, 1);
  });

  it('推出 汉 + 。」：串内已在合里不扣，接缝 。+下行行头 」 要扣', function () {
    var b = computeLineEndBases(['文', '汉', '。', '」'], ['」', '下']);
    assert.equal(b.branch, '5.1');
    assert.deepEqual(b.pushChars, ['汉', '。', '」']);
    assert.equal(b.pushBaseEm, 2.5);
  });

  it('推出只推 汉，新行尾是 。：基数 +0.5', function () {
    var b = computeLineEndBases(['文', '。', '汉'], ['。', '下']);
    assert.deepEqual(b.pushChars, ['汉']);
    assert.equal(b.pushBaseEm, 1.5);
  });

  it('推出接到下行 」：接缝连写 −0.5', function () {
    var b = computeLineEndBases(['文', '汉', '。'], ['」', '下']);
    assert.equal(b.branch, '5.1');
    assert.deepEqual(b.pushChars, ['汉', '。']);
    assert.equal(comboDeductionEm('。', '」'), 0.5);
    assert.equal(b.pushBaseEm, 1.5);
  });
});

describe('5.2 基数（撑行）', function () {
  it('抽一个汉字：基数 1', function () {
    var b = computeLineEndBases(['文', '本'], ['汉', '字']);
    assert.equal(b.branch, '5.2');
    assert.deepEqual(b.pullChars, ['汉']);
    assert.equal(b.pullBaseEm, 1);
  });

  it('抽 了」：汉字后面连续不能在行头也抽上来，」收半角', function () {
    var b = computeLineEndBases(['人'], ['了', '」', '但']);
    assert.equal(b.branch, '5.2');
    assert.deepEqual(b.pullChars, ['了', '」']);
    assert.equal(b.pullBaseEm, 1.5);
    var short = hangAmountsEm(10, 10.65, b.pullBaseEm, b.pushBaseEm);
    assert.ok(short.pullAmountEm > 0.5);
    assert.equal(decideHangStrategy(short.pullAmountEm, 1, short.pushAmountEm, 0), 'none');
    var enough = hangAmountsEm(10, 11, b.pullBaseEm, b.pushBaseEm);
    assert.ok(enough.pullAmountEm <= 0.5);
    assert.equal(decideHangStrategy(enough.pullAmountEm, 1, enough.pushAmountEm, 0), 'pull');
  });

  it('抽 （汉：无内部连写（前有空+汉不成对）', function () {
    var b = computeLineEndBases(['文'], ['（', '汉']);
    assert.deepEqual(b.pullChars, ['（', '汉']);
    assert.equal(b.pullBaseEm, 2);
  });

  it('行尾 。 抽 （：接缝连写 −0.5', function () {
    var b = computeLineEndBases(['文', '。'], ['（', '汉']);
    assert.equal(comboDeductionEm('。', '（'), 0.5);
    assert.equal(b.pullBaseEm, 1.5);
  });

  it('抽 （。：那一个是后有空，−0.5 半角', function () {
    var b = computeLineEndBases(['汉'], ['（', '。']);
    assert.deepEqual(b.pullChars, ['（', '。']);
    assert.equal(b.pullBaseEm, 1.5);
  });

  it('推出行尾 （，接到下行 前有空：接缝 −0.5', function () {
    var b = computeLineEndBases(['文', '（'], ['「', '汉']);
    assert.deepEqual(b.pushChars, ['（']);
    assert.equal(b.pushBaseEm, 0.5);
  });

  it('行尾只剩后有空、撑行改推：收半角，基数 +0.5', function () {
    var b = computeLineEndBases(['文', '本', '。'], ['汉']);
    assert.equal(b.branch, '5.2');
    assert.deepEqual(b.pushChars, []);
    assert.equal(b.pushBaseEm, 0.5);
    var amt = hangAmountsEm(7.6, 8, b.pullBaseEm, b.pushBaseEm);
    assert.ok(amt.pullAmountEm > 0.5);
    assert.ok(Math.abs(amt.pushAmountEm - 0.9) < 1e-9);
  });

  it('推出 前有空、新行尾是后有空：未包半角则 +0.5；已是半角盒不再加', function () {
    var plain = computeLineEndBases(['文', '。', '（'], ['汉'], { newEndAlreadyHalf: false });
    var half = computeLineEndBases(['文', '。', '（'], ['汉'], { newEndAlreadyHalf: true });
    assert.deepEqual(plain.pushChars, ['（']);
    assert.equal(plain.pushBaseEm, 1.5);
    assert.equal(half.pushBaseEm, 1);
  });

  it('行尾是汉字：推出基数 0，推出量就是行宽−合', function () {
    var b = computeLineEndBases(['文', '本', '汉'], ['字']);
    assert.deepEqual(b.pushChars, []);
    assert.equal(b.pushBaseEm, 0);
    var amt = hangAmountsEm(7.5, 8, b.pullBaseEm, b.pushBaseEm);
    assert.equal(amt.pushAmountEm, 0.5);
  });
});

describe('量和 selector 用的公式', function () {
  it('压入量 = 基数 + 合 − 行宽；推出量 = 基数 + 行宽 − 合', function () {
    var amt = hangAmountsEm(7.5, 8, 1, 0);
    assert.equal(amt.pullAmountEm, 0.5);
    assert.equal(amt.pushAmountEm, 0.5);
  });

  it('差 0.5em 抽整字：压入刚好 0.5，不超过上限', function () {
    var amt = hangAmountsEm(7.5, 8, 1, 0);
    assert.equal(amt.pullAmountEm, 0.5);
  });

  it('差 0.3em 抽整字：压入 0.7，应改推', function () {
    var amt = hangAmountsEm(7.7, 8, 1, 0);
    assert.ok(amt.pullAmountEm > 0.6);
  });

  it('差 0.5em 抽 。」 扣连写和半角后压入 0.5，本该压入', function () {
    var b = computeLineEndBases(['汉'], ['。', '」', '下']);
    var amt = hangAmountsEm(7.5, 8, b.pullBaseEm, b.pushBaseEm);
    assert.equal(b.pullBaseEm, 1);
    assert.equal(amt.pullAmountEm, 0.5);
  });

  it('满行 字」 抽 。：基数 0，压入量 0，仍压入', function () {
    var b = computeLineEndBases(['汉', '」'], ['。', '下']);
    assert.equal(b.branch, '5.1');
    assert.deepEqual(b.pullChars, ['。']);
    assert.equal(b.pullBaseEm, 0);
    var amt = hangAmountsEm(17, 17, b.pullBaseEm, b.pushBaseEm);
    assert.equal(amt.pullAmountEm, 0);
    assert.equal(decideHangStrategy(amt.pullAmountEm, 1, amt.pushAmountEm, 0), 'pull');
  });

  it('剩余超过半角、没有可调缝：抽 」 包半角，压入量为负仍压入', function () {
    var b = computeLineEndBases(['字'], ['」', '下']);
    assert.equal(b.pullBaseEm, 0.5);
    var amt = hangAmountsEm(16.3, 17, b.pullBaseEm, b.pushBaseEm);
    assert.ok(amt.pullAmountEm < 0);
    assert.equal(decideHangStrategy(amt.pullAmountEm, 0, amt.pushAmountEm, 0), 'pull');
    assert.equal(decideHangStrategy(0.2, 0, 0.5, 0), 'none');
  });
});
