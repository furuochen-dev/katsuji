import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHangable,
  wrapHalfEm,
  resolveHangingPunctuation,
  shouldProtrudeLineStartOpen,
  hangingPadPlan,
  nextHangPadEm,
  lineMaxEm,
  computeLineEndBases,
  hangAmountsEm,
  lineStepPlan,
} from '../src/katsuji/modules/process/typeset-rules.js';

describe('悬挂选项', function () {
  it('无参 / 未开：没有字是可悬挂', function () {
    var off = resolveHangingPunctuation(null);
    assert.deepEqual(off, { hangLeft: false, hangLeftIndent: false, hangRight: 'none' });
    assert.equal(isHangable('。', 'none'), false);
    assert.equal(isHangable('。', off.hangRight), false);
    assert.equal(wrapHalfEm('。', 'none'), 0.5);
  });

  it('stops：只有 ，。、 可悬挂，西文逗号句号不算', function () {
    assert.equal(isHangable('。', 'stops'), true);
    assert.equal(isHangable('，', 'stops'), true);
    assert.equal(isHangable('、', 'stops'), true);
    assert.equal(isHangable('」', 'stops'), false);
    assert.equal(isHangable('）', 'stops'), false);
    assert.equal(isHangable('！', 'stops'), false);
    assert.equal(isHangable(',', 'stops'), false);
    assert.equal(isHangable('.', 'stops'), false);
    assert.equal(wrapHalfEm('。', 'stops'), 1);
    assert.equal(wrapHalfEm('」', 'stops'), 0.5);
  });

  it('all：后有空都可悬挂；不置中时与 exceptCenterFixed 相同', function () {
    assert.equal(isHangable('」', 'all'), true);
    assert.equal(isHangable('！', 'all'), true);
    assert.equal(isHangable('！', 'exceptCenterFixed'), true);
    assert.equal(wrapHalfEm('」', 'all'), 1);
  });

  it('打开时的默认是右挂句读、缩进左挂、全局左挂关', function () {
    assert.deepEqual(resolveHangingPunctuation({ hangRight: 'stops' }), {
      hangLeft: false,
      hangLeftIndent: true,
      hangRight: 'stops',
    });
    assert.deepEqual(resolveHangingPunctuation(true), {
      hangLeft: false,
      hangLeftIndent: true,
      hangRight: 'stops',
    });
  });

  it('可关缩进左挂；未写 hangLeftIndent 在打开时为 true', function () {
    assert.equal(resolveHangingPunctuation({ hangRight: 'stops', hangLeftIndent: false }).hangLeftIndent, false);
    assert.equal(resolveHangingPunctuation({ hangLeft: true }).hangLeftIndent, true);
  });
});

describe('2′ 沟：现有 padding 上再加 0.5em', function () {
  it('开启悬挂时左右都加 0.5em；全关不加', function () {
    assert.deepEqual(hangingPadPlan({ hangLeft: false, hangRight: 'stops' }), {
      left: true,
      right: true,
    });
    assert.deepEqual(hangingPadPlan({ hangLeft: true, hangRight: 'stops' }), {
      left: true,
      right: true,
    });
    assert.deepEqual(hangingPadPlan({ hangLeft: false, hangRight: 'none' }), {
      left: false,
      right: false,
    });
  });

  it('加上去，不是补到 0.5', function () {
    assert.equal(nextHangPadEm(0), 0.5);
    assert.equal(nextHangPadEm(0.2), 0.7);
    assert.equal(nextHangPadEm(1), 1.5);
  });
});

describe('行宽：内容盒；段首行再减 indent', function () {
  it('非首行不减 indent', function () {
    assert.equal(lineMaxEm(20, 2, 1), 20);
  });

  it('首行减 text-indent；indent 0 不变', function () {
    assert.equal(lineMaxEm(20, 2, 0), 18);
    assert.equal(lineMaxEm(20, 0, 0), 20);
  });

  it('2′ 不计入行宽：只右加 27.5 再减 0.5 → 27；左右都加则内容盒已是正文', function () {
    assert.equal(lineMaxEm(27.5, 0, 1, 0.5), 27);
    assert.equal(lineMaxEm(27, 0, 1, 0), 27);
    assert.equal(lineMaxEm(27.5, 0, 1, 0), 27.5);
    assert.equal(lineMaxEm(7.3, 0, 0, 0.5, 7), 7);
  });
});

describe('第 5 步基数：可悬挂 ±1，否则 ±0.5', function () {
  it('未开悬挂：抽 。 仍 −0.5', function () {
    var b = computeLineEndBases(['汉'], ['。', '下']);
    assert.equal(b.pullBaseEm, 0.5);
  });

  it('stops：抽 。 相对未包 −1', function () {
    var b = computeLineEndBases(['汉'], ['。', '下'], { hangRight: 'stops' });
    assert.equal(b.pullBaseEm, 0);
  });

  it('stops：抽 」 仍 −0.5', function () {
    var b = computeLineEndBases(['汉'], ['」', '下'], { hangRight: 'stops' });
    assert.equal(b.pullBaseEm, 0.5);
  });

  it('all：抽 」 也 −1', function () {
    var b = computeLineEndBases(['汉'], ['」', '下'], { hangRight: 'all' });
    assert.equal(b.pullBaseEm, 0);
  });

  it('满行抽 。：基数 0，压入量 ≤ 0', function () {
    var b = computeLineEndBases(['汉'], ['。', '下'], { hangRight: 'stops' });
    var amt = hangAmountsEm(8, 8, b.pullBaseEm, b.pushBaseEm);
    assert.equal(amt.pullAmountEm, 0);
  });

  it('正文框 27、抽 」。：基数 0.5，压入 0.5', function () {
    var b = computeLineEndBases(['人', '了'], ['」', '。', '但'], { hangRight: 'stops' });
    assert.equal(b.pullBaseEm, 0.5);
    var maxEm = lineMaxEm(27, 0, 1, 0);
    var amt = hangAmountsEm(27, maxEm, b.pullBaseEm, b.pushBaseEm);
    assert.equal(maxEm, 27);
    assert.equal(amt.pullAmountEm, 0.5);
  });

  it('满行抽 」：基数 0.5', function () {
    var b = computeLineEndBases(['汉'], ['」', '下'], { hangRight: 'stops' });
    var amt = hangAmountsEm(8, 8, b.pullBaseEm, b.pushBaseEm);
    assert.equal(amt.pullAmountEm, 0.5);
  });

  it('stops：新行尾是 。 推出 +1；」 仍 +0.5', function () {
    var period = computeLineEndBases(['文', '本', '。'], ['汉'], { hangRight: 'stops' });
    assert.deepEqual(period.pushChars, []);
    assert.equal(period.pushBaseEm, 1);
    var close = computeLineEndBases(['文', '本', '」'], ['汉'], { hangRight: 'stops' });
    assert.equal(close.pushBaseEm, 0.5);
  });
});

describe('第 3 步推盒：缩进左挂 / 全局左挂', function () {
  var on = { hangLeftIndent: true, hangLeft: false, hangRight: 'stops' };

  it('默认：段首有 ≥0.5em 缩进才推；没有缩进不推', function () {
    assert.equal(shouldProtrudeLineStartOpen(0, 2, on), true);
    assert.equal(shouldProtrudeLineStartOpen(0, 0.5, on), true);
    assert.equal(shouldProtrudeLineStartOpen(0, 0, on), false);
    assert.equal(shouldProtrudeLineStartOpen(0, 0.2, on), false);
    assert.equal(shouldProtrudeLineStartOpen(1, 2, on), false);
  });

  it('全局左挂：每行都推，不看缩进', function () {
    var g = { hangLeftIndent: false, hangLeft: true, hangRight: 'stops' };
    assert.equal(shouldProtrudeLineStartOpen(0, 0, g), true);
    assert.equal(shouldProtrudeLineStartOpen(1, 0, g), true);
  });
});

describe('第 3 步每行都做；hangLeft 不改步骤表', function () {
  it('段首行默认也做第 3 步', function () {
    assert.equal(lineStepPlan(0, 3).step3, true);
    assert.equal(lineStepPlan(0, 3, { hangLeft: false }).step3, true);
  });

  it('hangLeft 打开：步骤表不变', function () {
    assert.deepEqual(lineStepPlan(0, 3, { hangLeft: true }), {
      step3: true,
      step4: true,
      step5: true,
    });
  });
});
