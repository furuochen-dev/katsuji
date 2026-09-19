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
import { mergePunctConfig, applyPunctPreset } from '../src/katsuji/modules/core/punct-config.js';
import {
  gapInsertSide,
  isHangable,
  wrapHalfEm,
  comboPairKind,
  comboDeductionEm,
  computeLineEndBases,
  resolveHangingPunctuation,
  shouldWrapMovedLastHalf,
  shouldLockLineEndAfterGap,
  shouldLockLineEndBeforeGap,
  restoreLineCharsIfComboSplit,
  lineLostIntendedRun,
} from '../src/katsuji/modules/process/typeset-rules.js';

function withCenter(fn) {
  mergePunctConfig({ punctAlign: 'center' });
  try {
    fn();
  } finally {
    applyPunctPreset('default');
    mergePunctConfig({ punctAlign: 'corner' });
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
  it('。同时在后有空和置中点号；？同时在后有空和置中固定；」只在后有空', function () {
    withCenter(function () {
      assert.equal(AFTER_CHARS['。'], true);
      assert.equal(inPunctTable('。', CENTER_STOPS_CHARS), true);
      assert.equal(AFTER_CHARS['？'], true);
      assert.equal(inPunctTable('？', CENTER_FIXED_CHARS), true);
      assert.equal(AFTER_CHARS['」'], true);
      assert.equal(inPunctTable('」', CENTER_STOPS_CHARS), false);
      assert.equal(inPunctTable('」', CENTER_FIXED_CHARS), false);
    });
  });

  it('插缝：。两边，？不插，」仍后', function () {
    withCenter(function () {
      assert.equal(gapInsertSide('。'), 'both');
      assert.equal(gapInsertSide('，'), 'both');
      assert.equal(gapInsertSide('·'), 'both');
      assert.equal(gapInsertSide('？'), null);
      assert.equal(gapInsertSide('！'), null);
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

  it('收半角：。否，」是，？否', function () {
    withCenter(function () {
      assert.equal(isHalfPunct('。'), false);
      assert.equal(isHalfPunct('」'), true);
      assert.equal(isHalfPunct('？'), false);
    });
  });

  it('可悬挂：all 是后有空；exceptCenterFixed 去掉置中固定', function () {
    withCenter(function () {
      assert.equal(isHangable('。', 'all'), true);
      assert.equal(isHangable('。', 'stops'), true);
      assert.equal(isHangable('」', 'all'), true);
      assert.equal(isHangable('！', 'all'), true);
      assert.equal(isHangable('！', 'exceptCenterFixed'), false);
      assert.equal(isHangable('？', 'exceptCenterFixed'), false);
      assert.equal(isHangable('？', 'stops'), false);
    });
  });

  it('半：挂。为 1，不挂为 0.5；：不挂为 0.5；」不挂为 0.5', function () {
    withCenter(function () {
      assert.equal(wrapHalfEm('。', 'stops'), 1);
      assert.equal(wrapHalfEm('。', 'none'), 0.5);
      assert.equal(wrapHalfEm('：', 'stops'), 0.5);
      assert.equal(wrapHalfEm('」', 'none'), 0.5);
      assert.equal(wrapHalfEm('？', 'all'), 1);
      assert.equal(wrapHalfEm('？', 'exceptCenterFixed'), 0);
    });
  });

  it('打开悬挂且置中固定有字时默认 hangRight 为 exceptCenterFixed', function () {
    withCenter(function () {
      assert.equal(resolveHangingPunctuation(true).hangRight, 'exceptCenterFixed');
    });
    assert.equal(resolveHangingPunctuation(true).hangRight, 'stops');
  });
});

describe('置中打开：第 4 步成对', function () {
  it('成对闭仍收左', function () {
    withCenter(function () {
      assert.equal(comboPairKind('）', '」'), 'single');
      assert.equal(comboPairKind('）', '。'), 'single');
      assert.equal(comboPairKind('）', '「'), 'after-before');
      assert.equal(comboDeductionEm('）', '」'), 0.5);
    });
  });

  it('点号+闭括收右；点号+点号、问叹不成对', function () {
    withCenter(function () {
      assert.equal(comboPairKind('。', '」'), 'wrap-right');
      assert.equal(comboDeductionEm('。', '」'), 0.5);
      assert.equal(comboPairKind('。', '，'), null);
      assert.equal(comboPairKind('？', '！'), null);
    });
  });

  it('点号+开括收右', function () {
    withCenter(function () {
      assert.equal(comboPairKind('，', '「'), 'wrap-right');
      assert.equal(comboPairKind('。', '「'), 'wrap-right');
      assert.equal(comboDeductionEm('，', '「'), 0.5);
    });
  });

  it('…（ 仍收左', function () {
    withCenter(function () {
      assert.equal(comboPairKind('…', '（'), 'single');
    });
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

  it('抽 。」 收右扣连写，末字 」仍收半角', function () {
    withCenter(function () {
      var b = computeLineEndBases(['汉'], ['。', '」', '下'], { hangRight: 'none' });
      assert.deepEqual(b.pullChars, ['。', '」']);
      assert.equal(b.pullBaseEm, 1);
    });
  });

  it('shouldWrapMovedLastHalf：可挂、收半角或置中点号', function () {
    withCenter(function () {
      assert.equal(shouldWrapMovedLastHalf(['。'], 'stops'), true);
      assert.equal(shouldWrapMovedLastHalf(['。'], 'none'), true);
      assert.equal(shouldWrapMovedLastHalf(['：'], 'stops'), true);
      assert.equal(shouldWrapMovedLastHalf(['」'], 'none'), true);
      assert.equal(shouldWrapMovedLastHalf(['？'], 'all'), true);
      assert.equal(shouldWrapMovedLastHalf(['？'], 'exceptCenterFixed'), false);
    });
  });

  it('行尾锁后缝：半角盒或置中点号；挂出才锁前缝', function () {
    withCenter(function () {
      assert.equal(shouldLockLineEndAfterGap('：', 'stops'), true);
      assert.equal(shouldLockLineEndAfterGap('。', 'stops'), true);
      assert.equal(shouldLockLineEndAfterGap('」', 'none'), true);
      assert.equal(shouldLockLineEndAfterGap('汉', 'stops'), false);
      assert.equal(shouldLockLineEndBeforeGap('。', 'stops'), true);
      assert.equal(shouldLockLineEndBeforeGap('：', 'stops'), false);
      assert.equal(shouldLockLineEndBeforeGap('。', 'none'), false);
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
