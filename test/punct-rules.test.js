import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  punctGapClass,
  isSpaceOnEdgeStart,
  isSpaceOnEdgeEnd,
  isIllegalOnEdgeStart,
  isIllegalOnEdgeEnd,
  isNoLineStartChar,
  isPunctuationChar,
  DEFAULT_GAP_BEFORE,
  DEFAULT_GAP_AFTER,
  DEFAULT_GAP_NONE,
  DEFAULT_NO_LINE_START,
} from '../src/katsuji/modules/text/punctuation-rules.js';
import { applyPunctPreset } from '../src/katsuji/modules/core/punct-config.js';
import {
  gapInsertSide,
  isCannotLineStart,
  isSpaceAfter,
  comboPairKind,
} from '../src/katsuji/modules/process/typeset-rules.js';

function eachChar(str, fn) {
  for (var i = 0; i < str.length; i++) fn(str.charAt(i));
}

describe('标点属性', function () {
  it('前有空：行首合法，行尾非法，缝插在前面', function () {
    eachChar(DEFAULT_GAP_BEFORE, function (ch) {
      assert.equal(punctGapClass(ch), 'before', ch);
      assert.equal(isSpaceOnEdgeStart(ch), true, ch);
      assert.equal(isIllegalOnEdgeEnd(ch), true, ch);
      assert.equal(isCannotLineStart(ch), false, ch);
      assert.equal(gapInsertSide(ch), 'before', ch);
    });
  });

  it('后有空：不能在行头，行尾可收半角，缝插在后面', function () {
    eachChar(DEFAULT_GAP_AFTER, function (ch) {
      assert.equal(punctGapClass(ch), 'after', ch);
      assert.equal(isSpaceOnEdgeEnd(ch), true, ch);
      assert.equal(isIllegalOnEdgeStart(ch), true, ch);
      assert.equal(isCannotLineStart(ch), true, ch);
      assert.equal(isSpaceAfter(ch), true, ch);
      assert.equal(gapInsertSide(ch), 'after', ch);
    });
  });

  it('两侧无空：不能在行头，两边不插缝', function () {
    eachChar(DEFAULT_GAP_NONE, function (ch) {
      assert.equal(punctGapClass(ch), 'none', ch);
      assert.equal(isCannotLineStart(ch), true, ch);
      assert.equal(isIllegalOnEdgeStart(ch), true, ch);
      assert.equal(isSpaceOnEdgeStart(ch), false, ch);
      assert.equal(isSpaceOnEdgeEnd(ch), false, ch);
      assert.equal(gapInsertSide(ch), null, ch);
    });
  });

  it('不能在行头是后有空 + 两侧无空 + 行头不可；默认行头不可为空', function () {
    eachChar(DEFAULT_GAP_AFTER + DEFAULT_GAP_NONE, function (ch) {
      assert.equal(isCannotLineStart(ch), true, ch);
    });
    eachChar(DEFAULT_GAP_BEFORE + '汉A1っーヵ', function (ch) {
      assert.equal(isCannotLineStart(ch), false, ch);
      assert.equal(isNoLineStartChar(ch), false, ch);
    });
  });

  it('不能出现在行尾的就是前有空', function () {
    eachChar(DEFAULT_GAP_BEFORE, function (ch) {
      assert.equal(isIllegalOnEdgeEnd(ch), true, ch);
    });
    eachChar(DEFAULT_GAP_AFTER + DEFAULT_GAP_NONE + '汉A', function (ch) {
      assert.equal(isIllegalOnEdgeEnd(ch), false, ch);
    });
  });

  it('汉字、英文、数字不在表里：不插缝，行头行尾都合法', function () {
    eachChar('汉あA1', function (ch) {
      if (ch === 'あ') return;
      assert.equal(punctGapClass(ch), null, ch);
      assert.equal(gapInsertSide(ch), null, ch);
      assert.equal(isCannotLineStart(ch), false, ch);
      assert.equal(isIllegalOnEdgeEnd(ch), false, ch);
    });
    assert.equal(punctGapClass('A'), null);
    assert.equal(punctGapClass('9'), null);
    assert.equal(isCannotLineStart('A'), false);
    assert.equal(isCannotLineStart('9'), false);
  });

  it('半角逗号、句号不进后有空；小数点不插缝', function () {
    eachChar(',.', function (ch) {
      assert.equal(punctGapClass(ch), null, ch);
      assert.equal(gapInsertSide(ch), null, ch);
      assert.equal(isSpaceAfter(ch), false, ch);
      assert.equal(isCannotLineStart(ch), false, ch);
    });
  });

  it('空白本身不算行首禁则', function () {
    eachChar(' \t\n\r\u00a0\u3000', function (ch) {
      assert.equal(isIllegalOnEdgeStart(ch), false, JSON.stringify(ch));
      assert.equal(isCannotLineStart(ch), false, JSON.stringify(ch));
    });
  });
});

describe('标点预设', function () {
  it('jis-strict 只填行头不可，不进两侧无空，不是标点', function () {
    applyPunctPreset('jis-strict');
    try {
      eachChar(DEFAULT_NO_LINE_START, function (ch) {
        assert.equal(isNoLineStartChar(ch), true, ch);
        assert.equal(isCannotLineStart(ch), true, ch);
        assert.equal(punctGapClass(ch), null, ch);
        assert.equal(isPunctuationChar(ch), false, ch);
        assert.equal(gapInsertSide(ch), null, ch);
      });
      assert.equal(punctGapClass('。'), 'after');
      assert.equal(punctGapClass('…'), 'none');
      assert.equal(comboPairKind('。', 'っ'), null);
      assert.equal(isNoLineStartChar('ヵ'), true);
      assert.equal(isNoLineStartChar('ヶ'), true);
      assert.equal(isNoLineStartChar('ヾ'), true);
    } finally {
      applyPunctPreset('default');
    }
  });

  it('vertical 把？！改成两侧无空', function () {
    applyPunctPreset('vertical');
    try {
      assert.equal(punctGapClass('？'), 'none');
      assert.equal(punctGapClass('！'), 'none');
      assert.equal(gapInsertSide('？'), null);
      assert.equal(punctGapClass('。'), 'after');
    } finally {
      applyPunctPreset('default');
    }
  });
});
