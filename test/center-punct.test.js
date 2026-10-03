import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  punctGapClass,
  isIllegalOnEdgeStart,
  inPunctTable,
  CENTER_STOPS_CHARS,
  CENTER_FIXED_CHARS,
  AFTER_CHARS,
  isHalfPunct,
} from '../src/katsuji/modules/text/punctuation-rules.js';
import { mergePunctConfig, applyPunctPreset, punctConfig } from '../src/katsuji/modules/core/punct-config.js';
import {
  gapInsertSide,
  isHangable,
  wrapHalfEm,
  comboPairKind,
  comboDeductionEm,
  comboCenterWrapsInwardPartner,
  computeLineEndBases,
  resolveHangingPunctuation,
  shouldWrapMovedLastHalf,
  shouldLockLineEndAfterGap,
  shouldLockLineEndBeforeGap,
  restoreLineCharsIfComboSplit,
  lineLostIntendedRun,
  gapShareWeight,
  gapsShareWeightSum,
  hangShareEm,
} from '../src/katsuji/modules/process/typeset-rules.js';

function withCenter(fn, extra) {
  mergePunctConfig(Object.assign({ punctAlign: 'center' }, extra || {}));
  try {
    fn();
  } finally {
    applyPunctPreset('default');
    mergePunctConfig({ punctAlign: 'corner', comboCenterPunct: true });
  }
}

describe('置中关着：两表为空，和现在一样', function () {
  it('置中表无字；。仍只当后有空', function () {
    assert.equal(inPunctTable('。', CENTER_STOPS_CHARS), false);
    assert.equal(inPunctTable('？', CENTER_FIXED_CHARS), false);
    assert.equal(punctGapClass('。'), 'after');
    assert.equal(gapInsertSide('。'), 'after');
    assert.equal(isHalfPunct('。'), true);
    assert.equal(comboPairKind('。', '」'), 'single');
    assert.equal(wrapHalfEm('。', 'none'), 0.5);
  });
});

describe('置中打开：多标签', function () {
  it('。？同时在后有空和置中点号；」只在后有空；固定表空', function () {
    withCenter(function () {
      assert.equal(AFTER_CHARS['。'], true);
      assert.equal(inPunctTable('。', CENTER_STOPS_CHARS), true);
      assert.equal(AFTER_CHARS['？'], true);
      assert.equal(inPunctTable('？', CENTER_STOPS_CHARS), true);
      assert.equal(inPunctTable('？', CENTER_FIXED_CHARS), false);
      assert.equal(AFTER_CHARS['」'], true);
      assert.equal(inPunctTable('」', CENTER_STOPS_CHARS), false);
    });
  });

  it('插缝：。？两边半倍，」仍后', function () {
    withCenter(function () {
      assert.equal(gapInsertSide('。'), 'both');
      assert.equal(gapInsertSide('，'), 'both');
      assert.equal(gapInsertSide('·'), 'both');
      assert.equal(gapInsertSide('？'), 'both');
      assert.equal(gapInsertSide('！'), 'both');
      assert.equal(gapInsertSide('」'), 'after');
      assert.equal(gapInsertSide('「'), 'before');
    });
  });

  it('。仍不能在行头', function () {
    withCenter(function () {
      assert.equal(isIllegalOnEdgeStart('。'), true);
      assert.equal(isIllegalOnEdgeStart('？'), true);
    });
  });

  it('收半角：。？否，」是', function () {
    withCenter(function () {
      assert.equal(isHalfPunct('。'), false);
      assert.equal(isHalfPunct('？'), false);
      assert.equal(isHalfPunct('」'), true);
    });
  });

  it('可悬挂：all / exceptCenterFixed 固定表空时相同', function () {
    withCenter(function () {
      assert.equal(isHangable('。', 'all'), true);
      assert.equal(isHangable('。', 'stops'), true);
      assert.equal(isHangable('」', 'all'), true);
      assert.equal(isHangable('！', 'all'), true);
      assert.equal(isHangable('！', 'exceptCenterFixed'), true);
      assert.equal(isHangable('？', 'exceptCenterFixed'), true);
      assert.equal(isHangable('？', 'stops'), false);
    });
  });

  it('半：挂。为 1，不挂为 0.5；？不挂为 0.5', function () {
    withCenter(function () {
      assert.equal(wrapHalfEm('。', 'stops'), 1);
      assert.equal(wrapHalfEm('。', 'none'), 0.5);
      assert.equal(wrapHalfEm('·', 'stops'), 0.5);
      assert.equal(wrapHalfEm('」', 'none'), 0.5);
      assert.equal(wrapHalfEm('？', 'none'), 0.5);
      assert.equal(wrapHalfEm('？', 'all'), 1);
      assert.equal(wrapHalfEm('？', 'exceptCenterFixed'), 1);
    });
  });

  it('打开悬挂、固定表空时默认 hangRight 为 stops', function () {
    withCenter(function () {
      assert.equal(resolveHangingPunctuation(true).hangRight, 'stops');
    });
    assert.equal(resolveHangingPunctuation(true).hangRight, 'stops');
  });
});

describe('置中打开：第 4 步成对', function () {
  it('后有空+后有空仍包后有空侧', function () {
    withCenter(function () {
      assert.equal(comboPairKind('）', '」'), 'single');
      assert.equal(comboDeductionEm('）', '」'), 0.5);
    });
  });

  it('有可调置中则成对（：；？！同）；置中+置中不成对', function () {
    withCenter(function () {
      assert.equal(comboPairKind('。', '」'), 'center');
      assert.equal(comboPairKind('：', '」'), 'center');
      assert.equal(comboPairKind('？', '」'), 'center');
      assert.equal(comboPairKind('」', '。'), 'center');
      assert.equal(comboPairKind('）', '：'), 'center');
      assert.equal(comboDeductionEm('。', '」'), 0.5);
      assert.equal(comboCenterWrapsInwardPartner('。', '」'), false);
      assert.equal(comboCenterWrapsInwardPartner('」', '。'), true);
      assert.equal(comboDeductionEm('」', '。'), 0.5);
      assert.equal(comboPairKind('。', '，'), null);
      assert.equal(comboPairKind('：', '；'), null);
      assert.equal(comboPairKind('？', '！'), null);
    });
  });

  it('空朝内：只包缝主字（基数 0.5）；空朝外不包侧字', function () {
    withCenter(function () {
      assert.equal(comboPairKind('，', '「'), 'center');
      assert.equal(comboPairKind('：', '（'), 'center');
      assert.equal(comboPairKind('。', '「'), 'center');
      assert.equal(comboCenterWrapsInwardPartner('。', '「'), true);
      assert.equal(comboDeductionEm('。', '「'), 0.5);
      assert.equal(comboPairKind('「', '，'), 'center');
      assert.equal(comboCenterWrapsInwardPartner('「', '，'), false);
      assert.equal(comboDeductionEm('「', '，'), 0.5);
      assert.equal(comboCenterWrapsInwardPartner('》', '，'), true);
      assert.equal(comboDeductionEm('》', '，'), 0.5);
    });
  });

  it('comboCenterPunct: false 时置中不对；括对仍成对', function () {
    withCenter(function () {
      assert.equal(punctConfig.comboCenterPunct, false);
      assert.equal(comboPairKind('。', '」'), null);
      assert.equal(comboPairKind('：', '（'), null);
      assert.equal(comboPairKind('）', '」'), 'single');
      assert.equal(comboPairKind('）', '（'), 'after-before');
    }, { comboCenterPunct: false });
  });

  it('…（ 仍成对', function () {
    withCenter(function () {
      assert.equal(comboPairKind('…', '（'), 'single');
    });
  });
});

describe('置中打开：半倍空', function () {
  it('半倍空权 0.5；单位份额 × 权', function () {
    var half = { getAttribute: function (k) { return k === 'data-ts-half-gap' ? '1' : null; } };
    var full = { getAttribute: function () { return null; } };
    assert.equal(gapShareWeight(half), 0.5);
    assert.equal(gapShareWeight(full), 1);
    assert.equal(gapsShareWeightSum([half, full, half]), 2);
    var unit = hangShareEm('pull', 0.4, 0.3, 2, 1, 1.5, 1);
    assert.ok(unit < 0);
    assert.ok(Math.abs(unit + 0.4 / 1.5 + 0.001) < 1e-9);
  });
});

describe('置中打开：抽推基数', function () {
  it('抽 。 无挂基数 0.5，有挂基数 0', function () {
    withCenter(function () {
      var noHang = computeLineEndBases(['汉'], ['。', '下'], { hangRight: 'none' });
      assert.equal(noHang.branch, '5.1');
      assert.deepEqual(noHang.pullChars, ['。']);
      assert.equal(noHang.pullBaseEm, 0.5);

      var hung = computeLineEndBases(['汉'], ['。', '下'], { hangRight: 'stops' });
      assert.equal(hung.pullBaseEm, 0);
    });
  });

  it('抽 。」：置中包。0.5 + 行尾收」0.5 → 1', function () {
    withCenter(function () {
      var b = computeLineEndBases(['汉'], ['。', '」', '下'], { hangRight: 'none' });
      assert.deepEqual(b.pullChars, ['。', '」']);
      assert.equal(b.pullBaseEm, 1);
    });
  });

  it('抽 」。：」收半角 + 。行尾居中半角 → 1', function () {
    withCenter(function () {
      var b = computeLineEndBases(['汉'], ['」', '。', '下'], { hangRight: 'none' });
      assert.deepEqual(b.pullChars, ['」', '。']);
      assert.equal(b.pullBaseEm, 1);
    });
  });

  it('抽 ：」 / ？」 与 。」 同构', function () {
    withCenter(function () {
      assert.equal(
        computeLineEndBases(['汉'], ['：', '」', '下'], { hangRight: 'none' }).pullBaseEm,
        1,
      );
      assert.equal(
        computeLineEndBases(['汉'], ['？', '」', '下'], { hangRight: 'none' }).pullBaseEm,
        1,
      );
    });
  });

  it('行尾 。 抽 」：接缝只缩。+ 末字收」 → 0', function () {
    withCenter(function () {
      var b = computeLineEndBases(['汉', '。'], ['」', '下'], { hangRight: 'none' });
      assert.deepEqual(b.pullChars, ['」']);
      assert.equal(b.pullBaseEm, 0);
    });
  });

  it('行尾 」 抽 。：接缝双收 → 0', function () {
    withCenter(function () {
      var b = computeLineEndBases(['汉', '」'], ['。', '下'], { hangRight: 'none' });
      assert.deepEqual(b.pullChars, ['。']);
      assert.equal(b.pullBaseEm, 0);
    });
  });

  it('shouldWrapMovedLastHalf：可挂、收半角或可调置中', function () {
    withCenter(function () {
      assert.equal(shouldWrapMovedLastHalf(['。'], 'stops'), true);
      assert.equal(shouldWrapMovedLastHalf(['。'], 'none'), true);
      assert.equal(shouldWrapMovedLastHalf(['·'], 'stops'), true);
      assert.equal(shouldWrapMovedLastHalf(['」'], 'none'), true);
      assert.equal(shouldWrapMovedLastHalf(['？'], 'all'), true);
      assert.equal(shouldWrapMovedLastHalf(['？'], 'none'), true);
      assert.equal(shouldWrapMovedLastHalf(['？'], 'exceptCenterFixed'), true);
    });
  });

  it('行尾进盒置中：前缝后缝都锁', function () {
    withCenter(function () {
      assert.equal(shouldLockLineEndAfterGap('·', 'stops'), true);
      assert.equal(shouldLockLineEndAfterGap('。', 'stops'), true);
      assert.equal(shouldLockLineEndAfterGap('」', 'none'), true);
      assert.equal(shouldLockLineEndAfterGap('汉', 'stops'), false);
      assert.equal(shouldLockLineEndBeforeGap('。', 'stops'), true);
      assert.equal(shouldLockLineEndBeforeGap('·', 'stops'), true);
      assert.equal(shouldLockLineEndBeforeGap('。', 'none'), true);
      assert.equal(shouldLockLineEndBeforeGap('」', 'none'), false);
    });
  });
});

describe('第 4 步收完后缀被折走', function () {
  it('本行前缀还在、后缀到了下行：第 5 步仍用收之前的行头行尾', function () {
    var beforeThis = '迷：你怎么看？另有人反问：「批语是作者自拟，还是他人捉刀？'.split('');
    var beforeNext = '」争论未决'.split('');
    var afterThis = '迷：你怎么看？另有人反问：「批语是作者自拟，'.split('');
    var afterNext = '还是他人捉刀？」争论未决'.split('');
    var restored = restoreLineCharsIfComboSplit(beforeThis, beforeNext, afterThis, afterNext);
    assert.ok(restored);
    assert.deepEqual(restored.thisChars, beforeThis);
    assert.deepEqual(restored.nextChars, beforeNext);
    assert.equal(computeLineEndBases(restored.thisChars, restored.nextChars).branch, '5.1');
  });

  it('没折走不恢复；视觉行只剩前缀则不摊剩余', function () {
    var full = '迷：你怎么看？另有人反问：「批语是作者自拟，还是他人捉刀？'.split('');
    var short = '迷：你怎么看？另有人反问：「批语是作者自拟，'.split('');
    assert.equal(restoreLineCharsIfComboSplit(full, ['」'], full, ['」']), null);
    assert.equal(lineLostIntendedRun(short, full), true);
    assert.equal(lineLostIntendedRun(full, full), false);
    assert.equal(lineLostIntendedRun(full.concat(['」']), full), false);
  });
});
