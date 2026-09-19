import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  comboPairKind,
  isComboPair,
  comboGapsToLockCount,
  comboDeductionEm,
  comboRunInternalDeductionEm,
} from '../src/katsuji/modules/process/typeset-rules.js';

describe('第 4 步 连写判定', function () {
  it('4.2 后有空 + 后有空：。」中间一条缝，锁这一条', function () {
    assert.equal(comboPairKind('。', '」'), 'single');
    assert.equal(comboGapsToLockCount(1, 'single'), 1);
    assert.equal(comboDeductionEm('。', '」'), 0.5);
  });

  it('4.1 后有空 + 前有空：）（中间两条缝，只锁前一条', function () {
    assert.equal(comboPairKind('）', '（'), 'after-before');
    assert.equal(comboGapsToLockCount(2, 'after-before'), 1);
    assert.equal(comboDeductionEm('）', '（'), 0.5);
  });

  it('4.1 也适用于，（ 「『 之类', function () {
    assert.equal(comboPairKind('，', '（'), 'after-before');
    assert.equal(comboPairKind('。', '「'), 'after-before');
    assert.equal(comboPairKind('」', '『'), 'after-before');
  });

  it('任意标点 + 前有空：…（ 是 4.2 一条缝', function () {
    assert.equal(comboPairKind('…', '（'), 'single');
    assert.equal(comboGapsToLockCount(1, 'single'), 1);
  });

  it('后有空 + 两侧无空：。… 是 4.2', function () {
    assert.equal(comboPairKind('。', '…'), 'single');
  });

  it('两侧无空 + 两侧无空：…… / —— 不是收半角成对（两字一体另绑）', function () {
    assert.equal(comboPairKind('…', '…'), null);
    assert.equal(comboPairKind('—', '—'), null);
    assert.equal(comboDeductionEm('…', '…'), 0);
  });

  it('汉字、西文不和旁边标点成对', function () {
    assert.equal(isComboPair('汉', '。'), false);
    assert.equal(isComboPair('。', '汉'), false);
    assert.equal(isComboPair('A', '，'), false);
    assert.equal(isComboPair('（', '文'), false);
    assert.equal(comboDeductionEm('汉', '。'), 0);
  });

  it('前有空 + 前有空：（（ 后字是前有空，算成对（4.2）', function () {
    assert.equal(comboPairKind('（', '（'), 'single');
  });

  it('后有空 + 后有空：。。 算成对（4.2）', function () {
    assert.equal(comboPairKind('。', '。'), 'single');
  });

  it('抽上来的串内部：。」」 扣两处连写', function () {
    assert.equal(comboRunInternalDeductionEm(['。', '」', '」']), 1);
    assert.equal(comboRunInternalDeductionEm(['。', '」']), 0.5);
    assert.equal(comboRunInternalDeductionEm(['汉']), 0);
    assert.equal(comboRunInternalDeductionEm([]), 0);
  });

  it('跨行的 」/「 不当本行连写：判定仍是成对，但是否锁看是否同行', function () {
    assert.equal(comboPairKind('」', '「'), 'after-before');
  });
});
