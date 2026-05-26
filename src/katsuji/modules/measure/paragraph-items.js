/** 段落 → 行项序列（char/gap）+ 视觉分行 + 按界收 gap */
(function (AT) {
  var g = AT.global;
  var shouldSkipTextParent = AT.DomUtil.shouldSkipTextParent;

  function flattenParagraph(block) {
    var items = [];

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (shouldSkipTextParent(node.parentElement)) return;
        var tv = node.nodeValue;
        for (var j = 0; j < tv.length; j++) {
          items.push({ type: 'char', node: node, offset: j, ch: tv.charAt(j) });
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'TEXTAREA' || node.tagName === 'NOSCRIPT')
        return;
      if (node.classList && node.classList.contains('ts-gap')) {
        items.push({ type: 'gap', el: node });
        return;
      }
      var c = node.firstChild;
      while (c) {
        walk(c);
        c = c.nextSibling;
      }
    }

    var ch = block.firstChild;
    while (ch) {
      walk(ch);
      ch = ch.nextSibling;
    }
    return items;
  }

  function getItemRect(item) {
    if (item.type === 'char') {
      var doc = item.node.ownerDocument || g.document;
      var range = doc.createRange();
      range.setStart(item.node, item.offset);
      range.setEnd(item.node, item.offset + 1);
      var r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        range.setStart(item.node, item.offset);
        range.setEnd(item.node, Math.min(item.offset + 1, item.node.nodeValue.length));
        r = range.getBoundingClientRect();
      }
      return r;
    }
    return item.el.getBoundingClientRect();
  }

  function findLineFirstCharIndices(items) {
    var heads = [];
    var prevTop = null;
    var prevH = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type !== 'char') continue;
      var r = getItemRect(items[i]);
      if (prevTop === null) {
        heads.push(i);
      } else {
        var tol = Math.max(5, Math.max(r.height, prevH) * 0.35);
        if (Math.abs(r.top - prevTop) > tol) heads.push(i);
      }
      prevTop = r.top;
      prevH = r.height;
    }
    return heads;
  }

  function lineItemBounds(items, heads, lineIndex) {
    var startIndex = lineIndex <= 0 ? 0 : heads[lineIndex];
    var endIndex = lineIndex + 1 < heads.length ? heads[lineIndex + 1] - 1 : items.length - 1;
    return { lineIndex: lineIndex, startIndex: startIndex, endIndex: endIndex };
  }

  function lineCharsFromItems(items, startIndex, endIndex) {
    var text = '';
    var count = 0;
    for (var i = startIndex; i <= endIndex && i < items.length; i++) {
      if (items[i].type !== 'char') continue;
      text += items[i].ch;
      count++;
    }
    return { text: text, charCount: count };
  }

  function firstSignificantCharIndexOnLine(items, lineStart, lineEnd) {
    for (var i = lineStart; i < lineEnd && i < items.length; i++) {
      if (items[i].type !== 'char') continue;
      var ch = items[i].ch;
      if (ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000') continue;
      return i;
    }
    return -1;
  }

  function lastSignificantCharIndexOnLine(items, lineStart, lineEndExcl) {
    var end = Math.min(lineEndExcl, items.length);
    for (var i = end - 1; i >= lineStart; i--) {
      if (items[i].type !== 'char') continue;
      var ch2 = items[i].ch;
      if (ch2 === ' ' || ch2 === '\t' || ch2 === '\u00a0' || ch2 === '\u3000') continue;
      return i;
    }
    return -1;
  }

  function gapElAdjacentBeforeChar(items, charIndex) {
    if (charIndex > 0 && items[charIndex - 1].type === 'gap') return items[charIndex - 1].el;
    return null;
  }

  function lastAdjustableGapElInRange(items, startIncl, endIncl) {
    for (var j = endIncl; j >= startIncl && j < items.length; j--) {
      if (items[j].type !== 'gap') continue;
      if (items[j].el.getAttribute('data-ts-combo-fixed') === '1') continue;
      return items[j].el;
    }
    return null;
  }

  /**
   * 区间内可调 ts-gap 元素列表。
   * @param {object|boolean} [opts] 传 boolean 时等同 { skipComboFixed: bool }
   * @param {boolean} [opts.skipComboFixed=true] 跳过 data-ts-combo-fixed
   * @param {boolean} [opts.omitLineEnd=false] 区间末项若是可调 gap 则不计入（surplus 匀 padding）
   * @param {Element} [opts.omitGapEl] 排除指定 gap
   * @param {number} [opts.omitBesideCharIndex] 避尾：省略该行末禁则字旁的 gap（前邻 gap，否则区间内最后一个可调 gap）
   * @param {number} [opts.requireMinAdjustableGaps] 先按全量收集计个数，不足则返回 []（避尾需至少 2 个再 omit 一个）
   */
  function collectGapsBetween(items, startIncl, endIncl, opts) {
    if (typeof opts === 'boolean') opts = { skipComboFixed: opts };
    opts = opts || {};
    var skipComboFixed = opts.skipComboFixed !== false;
    var end = endIncl;
    if (opts.omitLineEnd && end >= startIncl && items[end].type === 'gap') {
      var endGapEl = items[end].el;
      if (!skipComboFixed || endGapEl.getAttribute('data-ts-combo-fixed') !== '1') end--;
    }
    if (end < startIncl) return [];

    var omitGapEl = opts.omitGapEl || null;
    if (opts.omitBesideCharIndex != null && opts.omitBesideCharIndex >= 0) {
      omitGapEl =
        gapElAdjacentBeforeChar(items, opts.omitBesideCharIndex) ||
        lastAdjustableGapElInRange(items, startIncl, end);
    }

    var out = [];
    for (var j = startIncl; j <= end && j < items.length; j++) {
      if (items[j].type !== 'gap') continue;
      if (skipComboFixed && items[j].el.getAttribute('data-ts-combo-fixed') === '1') continue;
      out.push(items[j].el);
    }

    if (opts.requireMinAdjustableGaps != null && out.length < opts.requireMinAdjustableGaps) {
      return [];
    }
    if (!omitGapEl) return out;

    var filtered = [];
    for (var k = 0; k < out.length; k++) {
      if (out[k] === omitGapEl) continue;
      filtered.push(out[k]);
    }
    return filtered;
  }

  AT.ParagraphItems = {
    flattenParagraph: flattenParagraph,
    getItemRect: getItemRect,
    findLineFirstCharIndices: findLineFirstCharIndices,
    lineItemBounds: lineItemBounds,
    lineCharsFromItems: lineCharsFromItems,
    firstSignificantCharIndexOnLine: firstSignificantCharIndexOnLine,
    lastSignificantCharIndexOnLine: lastSignificantCharIndexOnLine,
    collectGapsBetween: collectGapsBetween,
    gapElAdjacentBeforeChar: gapElAdjacentBeforeChar,
    lastAdjustableGapElInRange: lastAdjustableGapElInRange,
  };
})(KatsujiInternal);
