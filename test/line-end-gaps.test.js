import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectLineEndHangGaps } from '../src/katsuji/modules/measure/paragraph-items.js';

function gapEl(attrs) {
  attrs = attrs || {};
  return {
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
  };
}

describe('第 5 步抽缝：压入算行尾缝，推出不算', function () {
  it('本行没有行内缝、只剩后有空后面那条：压入缝数 1，推出缝数 0', function () {
    var trailing = gapEl();
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '字' },
      { type: 'char', ch: '」' },
      { type: 'gap', el: trailing },
      { type: 'char', ch: '。' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 3 }, 2);
    assert.equal(gaps.interiorGaps.length, 0);
    assert.deepEqual(gaps.trailingGaps, [trailing]);
    assert.deepEqual(gaps.pullGaps, [trailing]);
    assert.deepEqual(gaps.pushGaps, []);
  });

  it('行内缝和行尾缝都在时：压入两条，推出只动行内那条', function () {
    var interior = gapEl();
    var trailing = gapEl();
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '，' },
      { type: 'gap', el: interior },
      { type: 'char', ch: '字' },
      { type: 'char', ch: '」' },
      { type: 'gap', el: trailing },
      { type: 'char', ch: '下' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 5 }, 4);
    assert.deepEqual(gaps.interiorGaps, [interior]);
    assert.deepEqual(gaps.trailingGaps, [trailing]);
    assert.deepEqual(gaps.pullGaps, [interior, trailing]);
    assert.deepEqual(gaps.pushGaps, [interior]);
  });

  it('行尾是汉字、后面没有缝：压入推出都是空', function () {
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '字' },
      { type: 'char', ch: '下' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 1 }, 1);
    assert.deepEqual(gaps.pullGaps, []);
    assert.deepEqual(gaps.pushGaps, []);
  });

  it('连写锁死的行尾缝不进抽缝', function () {
    var trailing = gapEl({ 'data-ts-combo-fixed': '1' });
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '」' },
      { type: 'gap', el: trailing },
      { type: 'char', ch: '。' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 2 }, 1);
    assert.deepEqual(gaps.pullGaps, []);
    assert.deepEqual(gaps.pushGaps, []);
  });
});
