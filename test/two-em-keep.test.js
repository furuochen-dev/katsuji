import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTwoEmKeepChar,
  isTwoEmKeepPair,
  twoEmKeepRuns,
  isIllegalOnEdgeEnd,
  isIllegalOnEdgeStart,
  punctGapClass,
  TWO_EM_KEEP_CHARS,
  DEFAULT_TWO_EM_KEEP,
} from '../src/katsuji/modules/text/punctuation-rules.js';
import { applyPunctPreset } from '../src/katsuji/modules/core/punct-config.js';
import { comboPairKind, comboDeductionEm } from '../src/katsuji/modules/process/typeset-rules.js';

describe('两字一体：…… / ——', function () {
  it('只有省略号点和破折号进这张表', function () {
    assert.equal(DEFAULT_TWO_EM_KEEP, '…—');
    assert.equal(!!TWO_EM_KEEP_CHARS['…'], true);
    assert.equal(!!TWO_EM_KEEP_CHARS['—'], true);
    assert.equal(!!TWO_EM_KEEP_CHARS['～'], false);
    assert.equal(isTwoEmKeepChar('…'), true);
    assert.equal(isTwoEmKeepChar('—'), true);
    assert.equal(isTwoEmKeepChar('～'), false);
    assert.equal(isTwoEmKeepChar('％'), false);
    assert.equal(isTwoEmKeepChar('‰'), false);
    assert.equal(isTwoEmKeepChar('℃'), false);
    assert.equal(isTwoEmKeepChar('°'), false);
    assert.equal(isTwoEmKeepChar('汉'), false);
  });

  it('一对必须是两个相同码位', function () {
    assert.equal(isTwoEmKeepPair('…', '…'), true);
    assert.equal(isTwoEmKeepPair('—', '—'), true);
    assert.equal(isTwoEmKeepPair('…', '—'), false);
    assert.equal(isTwoEmKeepPair('—', '…'), false);
    assert.equal(isTwoEmKeepPair('…', '～'), false);
    assert.equal(isTwoEmKeepPair('％', '％'), false);
  });

  it('从左每两个收一对；多一个单独留着', function () {
    assert.deepEqual(twoEmKeepRuns('……'), [{ start: 0, end: 1, ch: '…' }]);
    assert.deepEqual(twoEmKeepRuns('——'), [{ start: 0, end: 1, ch: '—' }]);
    assert.deepEqual(twoEmKeepRuns('…'), []);
    assert.deepEqual(twoEmKeepRuns('—'), []);
    assert.deepEqual(twoEmKeepRuns('………'), [{ start: 0, end: 1, ch: '…' }]);
    assert.deepEqual(twoEmKeepRuns('…………'), [
      { start: 0, end: 1, ch: '…' },
      { start: 2, end: 3, ch: '…' },
    ]);
  });

  it('异种相邻、百分号温度不绑', function () {
    assert.deepEqual(twoEmKeepRuns('…—'), []);
    assert.deepEqual(twoEmKeepRuns('％℃'), []);
    assert.deepEqual(twoEmKeepRuns('……——'), [
      { start: 0, end: 1, ch: '…' },
      { start: 2, end: 3, ch: '—' },
    ]);
    assert.deepEqual(twoEmKeepRuns('汉……文'), [{ start: 1, end: 2, ch: '…' }]);
  });

  it('整对行尾合法；单个点仍不能在行头', function () {
    assert.equal(isIllegalOnEdgeEnd('…'), false);
    assert.equal(isIllegalOnEdgeEnd('—'), false);
    assert.equal(isIllegalOnEdgeStart('…'), true);
    assert.equal(isIllegalOnEdgeStart('—'), true);
    assert.equal(punctGapClass('…'), 'none');
    assert.equal(punctGapClass('—'), 'none');
  });

  it('JIS 严格把小假名填进行头不可，不进两字一体、两侧无空', function () {
    applyPunctPreset('jis-strict');
    try {
      assert.equal(punctGapClass('っ'), null);
      assert.equal(isTwoEmKeepChar('っ'), false);
      assert.equal(isTwoEmKeepChar('…'), true);
    } finally {
      applyPunctPreset('default');
    }
  });

  it('不是第 4 步收半角成对，中间不扣 0.5', function () {
    assert.equal(comboPairKind('…', '…'), null);
    assert.equal(comboPairKind('—', '—'), null);
    assert.equal(comboDeductionEm('…', '…'), 0);
    assert.equal(comboDeductionEm('—', '—'), 0);
  });
});
