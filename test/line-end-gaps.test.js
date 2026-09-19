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

describe('第 5 步抽缝：压入只走行内，行尾后缝不摊', function () {
  it('本行没有行内缝、只剩后有空后面那条：压入缝数 0，推出缝数 0', function () {
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
    assert.deepEqual(gaps.pullGaps, []);
    assert.deepEqual(gaps.pushGaps, []);
  });

  it('行内缝和行尾缝都在时：压入只走行内那条，推出也只动行内', function () {
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
    assert.deepEqual(gaps.pullGaps, [interior]);
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

  it('推出前有空：括号前的缝和新行尾后的缝都不摊', function () {
    var interior = gapEl();
    var newEndTrail = gapEl();
    var openBefore = gapEl();
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '，' },
      { type: 'gap', el: interior },
      { type: 'char', ch: '字' },
      { type: 'char', ch: '：' },
      { type: 'gap', el: newEndTrail },
      { type: 'gap', el: openBefore },
      { type: 'char', ch: '（' },
    ];
    var lastIdx = 7;
    var stayEndIdx = 4;
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 7 }, lastIdx, stayEndIdx);
    assert.deepEqual(gaps.interiorGaps, [interior, newEndTrail, openBefore]);
    assert.deepEqual(gaps.pushGaps, [interior]);
    assert.ok(gaps.pushGaps.indexOf(openBefore) < 0);
    assert.ok(gaps.pushGaps.indexOf(newEndTrail) < 0);
  });

  it('不推字时推出缝仍是行内缝', function () {
    var interior = gapEl();
    var trailing = gapEl();
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '，' },
      { type: 'gap', el: interior },
      { type: 'char', ch: '字' },
      { type: 'gap', el: trailing },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 4 }, 3, 3);
    assert.deepEqual(gaps.pushGaps, [interior]);
  });

  it('推完没有留下字：推出缝为空', function () {
    var openBefore = gapEl();
    var items = [
      { type: 'char', ch: '「' },
      { type: 'gap', el: openBefore },
      { type: 'char', ch: '（' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 2 }, 2, -1);
    assert.deepEqual(gaps.interiorGaps, [openBefore]);
    assert.deepEqual(gaps.pushGaps, []);
  });

  it('连写已删缝：行尾没有缝就不进抽缝', function () {
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '」' },
      { type: 'char', ch: '。' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 1 }, 1);
    assert.deepEqual(gaps.pullGaps, []);
    assert.deepEqual(gaps.pushGaps, []);
  });

  it('锁死的缝不进抽缝', function () {
    var interior = gapEl();
    var lockedBefore = gapEl({ 'data-ts-line-end-gap': '1' });
    var items = [
      { type: 'char', ch: '汉' },
      { type: 'char', ch: '，' },
      { type: 'gap', el: interior },
      { type: 'char', ch: '字' },
      { type: 'gap', el: lockedBefore },
      { type: 'char', ch: '。' },
    ];
    var gaps = collectLineEndHangGaps(items, { startIndex: 0, endIndex: 5 }, 5, 5);
    assert.deepEqual(gaps.pullGaps, [interior]);
    assert.deepEqual(gaps.pushGaps, [interior]);
  });
});
