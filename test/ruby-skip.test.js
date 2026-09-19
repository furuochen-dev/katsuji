import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInsideRuby,
  isRubyAnnotationParent,
  shouldSkipTextParent,
  shouldSkipSegmenterParent,
} from '../src/katsuji/modules/core/dom-util.js';

function mockEl(tagName, parent) {
  var el = {
    tagName: String(tagName).toUpperCase(),
    parentElement: parent || null,
    closest: function (sel) {
      var tags = String(sel)
        .split(',')
        .map(function (s) {
          return s.trim().toUpperCase();
        });
      var cur = this;
      while (cur) {
        if (tags.indexOf(cur.tagName) !== -1) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
  };
  return el;
}

describe('Ruby 适配：跳过注音和切缝', function () {
  it('rt 不当正文；ruby 底仍能量宽', function () {
    var p = mockEl('p');
    var ruby = mockEl('ruby', p);
    var rt = mockEl('rt', ruby);
    assert.equal(isRubyAnnotationParent(rt), true);
    assert.equal(isRubyAnnotationParent(ruby), false);
    assert.equal(shouldSkipTextParent(rt), true);
    assert.equal(shouldSkipTextParent(ruby), false);
    assert.equal(shouldSkipTextParent(p), false);
  });

  it('切缝整簇跳过 ruby；pre/code 仍跳', function () {
    var p = mockEl('p');
    var ruby = mockEl('ruby', p);
    var rt = mockEl('rt', ruby);
    var pre = mockEl('pre', p);
    assert.equal(isInsideRuby(ruby), true);
    assert.equal(isInsideRuby(rt), true);
    assert.equal(isInsideRuby(p), false);
    assert.equal(shouldSkipSegmenterParent(ruby), true);
    assert.equal(shouldSkipSegmenterParent(rt), true);
    assert.equal(shouldSkipSegmenterParent(p), false);
    assert.equal(shouldSkipSegmenterParent(pre), true);
    assert.equal(shouldSkipTextParent(pre), true);
  });
});
