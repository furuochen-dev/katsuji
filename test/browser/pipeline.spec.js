import { test, expect } from '@playwright/test';

async function openHost(page, widthEm) {
  var bootErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    await page.goto('/test/browser/harness.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__katsujiReady === true || window.__katsujiError);
    bootErr = await page.evaluate(() => window.__katsujiError || null);
    if (!bootErr) break;
  }
  if (bootErr) throw new Error(bootErr);
  if (widthEm != null) {
    await page.evaluate((em) => {
      document.getElementById('host').style.width = em + 'em';
    }, widthEm);
  }
}

async function setParagraph(page, text) {
  await page.evaluate((t) => {
    var host = document.getElementById('host');
    host.innerHTML = '';
    var p = document.createElement('p');
    p.textContent = t;
    host.appendChild(p);
  }, text);
}

async function setHtml(page, html) {
  await page.evaluate((h) => {
    var host = document.getElementById('host');
    host.innerHTML = '';
    var p = document.createElement('p');
    p.innerHTML = h;
    host.appendChild(p);
  }, html);
}

function lineTexts(page) {
  return page.evaluate(() => {
    var p = document.querySelector('#host p');
    var m = window.Katsuji.measureBlockVisualLines(p);
    return m.lines.map(function (line) {
      return line.text;
    });
  });
}

function hangGutter(page) {
  return page.evaluate(() => {
    var p = document.querySelector('#host p');
    var end = p && p.querySelector('[data-ts-hang-end]');
    if (!end) return { hung: false, overflow: 0, leftoverEm: 0, ch: '', fs: 16 };
    var fs = parseFloat(getComputedStyle(p).fontSize) || 16;
    var pr = parseFloat(getComputedStyle(p).paddingRight) || 0;
    var contentRight = p.getBoundingClientRect().right - pr;
    var r = end.getBoundingClientRect();
    var lines = window.Katsuji.measureBlockVisualLines(p).lines;
    var layout = window.Katsuji.buildBlockLayout(p);
    var L = -1;
    for (var i = 0; i < lines.length; i++) {
      if (/[，。、]$/.test(lines[i].text || '')) {
        L = i;
        break;
      }
    }
    if (L < 0) L = 0;
    var visual = lines[L] ? lines[L].lineVisualEm : 0;
    var maxEm = layout ? window.Katsuji.blockLineMaxEm(layout, L) : 0;
    return {
      hung: true,
      ch: end.textContent,
      overflow: r.right - contentRight,
      leftoverEm: maxEm - visual,
      mr: end.style.marginRight,
      fs: fs,
    };
  });
}

test.describe('第 1 步 插缝', function () {
  test('后有空后面、前有空前面各插一条缝；两侧无空不插', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '汉。汉（汉…汉');
    await page.evaluate(() => window.Katsuji.apply(document.getElementById('host')));
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var gaps = Array.prototype.slice.call(p.querySelectorAll('span.ts-gap'));
      var items = window.Katsuji.flattenParagraph(p);
      var seq = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char') seq.push(items[i].ch);
        else seq.push(items[i].el.getAttribute('data-ts-open-gap') === '1' ? '[open]' : '[after]');
      }
      return { gapCount: gaps.length, open: p.querySelectorAll('[data-ts-open-gap]').length, seq: seq };
    });
    expect(info.gapCount).toBe(2);
    expect(info.open).toBe(1);
    expect(info.seq).toEqual(['汉', '。', '[after]', '汉', '[open]', '（', '汉', '…', '汉']);
  });
});

test.describe('第 2 步 断行', function () {
  test('applyHangAvoidance 设 line-break:anywhere 且不撤', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '汉字汉字汉字汉字汉字汉字');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var relax = await page.evaluate(() => {
      var host = document.getElementById('host');
      return {
        attr: host.getAttribute('data-ts-relax'),
        lb: getComputedStyle(host).lineBreak,
      };
    });
    expect(relax.attr).toBe('1');
    expect(relax.lb).toBe('anywhere');
  });
});

test.describe('第 3 步 行首开括号顶格', function () {
  test('段首行是前有空：顶格，默认不推盒', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(page, '（段首开括号后面还有很多汉字用来撑开这一行的宽度避免过短');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var flagged = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var open = p.querySelector('[data-ts-line-start-open]');
      return {
        open: p.querySelectorAll('[data-ts-line-start-open]').length,
        first: (p.textContent || '').charAt(0),
        hung: !!(open && open.getAttribute('data-ts-hang-start') === '1'),
        locked: !!p.querySelector('[data-ts-line-start-open-gap]'),
      };
    });
    expect(flagged.first).toBe('（');
    expect(flagged.open).toBe(1);
    expect(flagged.locked).toBe(true);
    expect(flagged.hung).toBe(false);
  });

  test('全局左挂：无缩进段首也推盒', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(page, '（段首开括号后面还有很多汉字用来撑开这一行的宽度避免过短');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeft: true, hangRight: 'stops' },
      });
    });
    var flagged = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var open = p.querySelector('[data-ts-line-start-open]');
      return {
        open: !!open,
        hung: !!(open && open.getAttribute('data-ts-hang-start') === '1'),
      };
    });
    expect(flagged.open).toBe(true);
    expect(flagged.hung).toBe(true);
  });

  test('打开悬挂默认：无缩进不推盒；有 2em 缩进才缩进左挂', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(page, '（段首开括号后面还有很多汉字用来撑开这一行的宽度避免过短');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, { hangingPunctuation: true });
    });
    var noIndent = await page.evaluate(() => {
      var open = document.querySelector('#host p [data-ts-line-start-open]');
      return !!(open && open.getAttribute('data-ts-hang-start') === '1');
    });
    expect(noIndent).toBe(false);

    await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      p.style.textIndent = '2em';
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, { hangingPunctuation: true });
    });
    var withIndent = await page.evaluate(() => {
      var open = document.querySelector('#host p [data-ts-line-start-open]');
      return !!(open && open.getAttribute('data-ts-hang-start') === '1');
    });
    expect(withIndent).toBe(true);

    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeftIndent: false, hangRight: 'stops' },
      });
    });
    var indentOff = await page.evaluate(() => {
      var open = document.querySelector('#host p [data-ts-line-start-open]');
      return !!(open && open.getAttribute('data-ts-hang-start') === '1');
    });
    expect(indentOff).toBe(false);
  });

  test('非段首行行首是前有空：顶格并锁缝', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '哈哈哈哈哈哈哈哈（后面还有汉字汉字汉字汉字');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
    });
    var before = await lineTexts(page);
    expect(before.some(function (t) { return t.charAt(0) === '（'; })).toBeTruthy();
    await page.evaluate(() => {
      window.Katsuji.applyHangAvoidance(document.getElementById('host'));
    });
    var after = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var open = p.querySelector('[data-ts-line-start-open]');
      var locked = p.querySelector('[data-ts-line-start-open-gap]');
      return {
        lines: lines.map(function (l) { return l.text; }),
        hasOpen: !!open,
        locked: !!locked,
      };
    });
    var wrappedOpen = after.lines.filter(function (t, i) {
      return i > 0 && t.charAt(0) === '（';
    });
    if (wrappedOpen.length) {
      expect(after.hasOpen).toBe(true);
      expect(after.locked).toBe(true);
    }
  });

  test('hangLeft：先和后一字绑进 inline-block 再推盒，不和前一字重合', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(
      page,
      '（段首开括号后面还有很多汉字用来撑开这一行的宽度避免过短哈哈哈哈「后面还有汉字汉字汉字',
    );
    var info = await page.evaluate(() => {
      function charRect(item) {
        if (!item || item.type !== 'char' || !item.node) return null;
        var range = document.createRange();
        range.setStart(item.node, item.offset);
        range.setEnd(item.node, item.offset + 1);
        return range.getBoundingClientRect();
      }
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeft: true, hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var items = window.Katsuji.flattenParagraph(p);
      var opens = p.querySelectorAll('[data-ts-line-start-open][data-ts-hang-start]');
      var rows = [];
      for (var o = 0; o < opens.length; o++) {
        var open = opens[o];
        var wrap = open.parentElement;
        var ch = (open.textContent || '').charAt(0);
        var openIdx = -1;
        for (var i = 0; i < items.length; i++) {
          if (items[i].type === 'char' && items[i].ch === ch) {
            var el = items[i].node && items[i].node.parentElement;
            while (el && el !== open) el = el.parentElement;
            if (el === open) {
              openIdx = i;
              break;
            }
          }
        }
        var prev = null;
        for (var j = openIdx - 1; j >= 0; j--) {
          if (items[j].type === 'char') {
            prev = items[j];
            break;
          }
        }
        var openR = open.getBoundingClientRect();
        var prevR = charRect(prev);
        var overlapPrev = !!(openR && prevR &&
          openR.left < prevR.right - 1 &&
          openR.right > prevR.left + 1 &&
          openR.top < prevR.bottom - 1 &&
          openR.bottom > prevR.top + 1);
        var hasFollow = false;
        if (wrap) {
          var kids = wrap.childNodes;
          for (var k = 0; k < kids.length; k++) {
            var node = kids[k];
            if (node === open) continue;
            if (node.nodeType === 1 && node.classList && node.classList.contains('ts-gap')) continue;
            if (node.nodeType === 3 && !(node.nodeValue || '').replace(/\s/g, '')) continue;
            hasFollow = true;
          }
        }
        rows.push({
          ch: ch,
          atomic: !!(wrap && wrap.getAttribute('data-ts-line-start-nowrap') === '1'),
          display: wrap ? wrap.style.display || getComputedStyle(wrap).display : '',
          hasFollow: hasFollow,
          overlapPrev: overlapPrev,
        });
      }
      return { count: opens.length, rows: rows };
    });
    expect(info.count).toBeGreaterThan(0);
    for (var r = 0; r < info.rows.length; r++) {
      expect(info.rows[r].atomic).toBe(true);
      expect(info.rows[r].display).toBe('inline-block');
      expect(info.rows[r].hasFollow).toBe(true);
      expect(info.rows[r].overlapPrev).toBe(false);
    }
  });
});

test.describe('第 4 步 连写', function () {
  test('锁完折上来的「《再锁，抽完《石不留半格', async function ({ page }) {
    await openHost(page, 31);
    await setParagraph(
      page,
      '槌：「先记下来，会后再议。」散会时已近黄昏，走廊里还能听见：「《石头记》后面还有很多汉字用来避免这是段末行后面还有汉字汉字',
    );
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var layout = window.Katsuji.buildBlockLayout(p);
      var m = window.Katsuji.measureBlockVisualLines(p);
      for (var i = 0; i < m.lines.length; i++) {
        var t = (m.lines[i].text || '').replace(/\s+/g, '');
        if (t.indexOf('「《石') < 0) continue;
        var maxEm = window.Katsuji.blockLineMaxEm(layout, i);
        var open = p.querySelector('[data-ts-line-start-open]');
        var glyph = p.querySelector('[data-ts-line-start-open-glyph]');
        return {
          text: t.slice(-8),
          leftover: maxEm - m.lines[i].lineVisualEm,
          openCh: open ? open.textContent : '',
          glyphMl: glyph ? glyph.style.marginLeft : '',
        };
      }
      return { text: (m.lines[0] && m.lines[0].text) || '', leftover: null };
    });
    expect(info.text).toContain('「《石');
    expect(info.leftover).not.toBeNull();
    expect(Math.abs(info.leftover)).toBeLessThan(0.12);
    expect(info.openCh).toContain('「');
    expect(info.glyphMl).toBe('-0.5em');
  });

  test('。」前面的。收半角盒、中间缝删掉', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '文本。」文本');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var combo = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      var betweenGaps = 0;
      var periodHalf = false;
      var seen = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '。') {
          seen = true;
          var el = items[i].node && items[i].node.parentElement;
          while (el) {
            if (el.classList && el.classList.contains('ts-half-punct')) {
              periodHalf = true;
              break;
            }
            el = el.parentElement;
          }
        }
        if (seen && items[i].type === 'gap') betweenGaps += 1;
        if (seen && items[i].type === 'char' && items[i].ch === '」') break;
      }
      return { betweenGaps: betweenGaps, periodHalf: periodHalf };
    });
    expect(combo.betweenGaps).toBe(0);
    expect(combo.periodHalf).toBe(true);
  });

  test('）（前面的）收半角盒、只删前一条缝', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '文本）（文本');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var gaps = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      var out = [];
      var closeHalf = false;
      var take = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '）') {
          take = true;
          var el = items[i].node && items[i].node.parentElement;
          while (el) {
            if (el.classList && el.classList.contains('ts-half-punct')) {
              closeHalf = true;
              break;
            }
            el = el.parentElement;
          }
        }
        if (take && items[i].type === 'gap') {
          out.push({
            open: items[i].el.getAttribute('data-ts-open-gap') === '1',
          });
        }
        if (take && items[i].type === 'char' && items[i].ch === '（') break;
      }
      return { gaps: out, closeHalf: closeHalf };
    });
    expect(gaps.closeHalf).toBe(true);
    expect(gaps.gaps.length).toBe(1);
    expect(gaps.gaps[0].open).toBe(true);
  });

  test('跨行的 」和「 不锁中间缝', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '哈哈哈哈哈哈哈」「哈哈哈哈哈哈哈哈');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
    });
    var split = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var lines = window.Katsuji.measureBlockVisualLines(p).lines.map(function (l) {
        return l.text;
      });
      return {
        lines: lines,
        split: lines.some(function (t) { return /」$/.test(t); }) &&
          lines.some(function (t) { return /^「/.test(t); }),
      };
    });
    if (!split.split) test.info().skip(true, 'this width did not wrap between 」 and 「');
    await page.evaluate(() => {
      window.Katsuji.applyHangAvoidance(document.getElementById('host'));
    });
    var lockedCross = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var texts = lines.map(function (l) { return l.text; });
      if (!(texts.some(function (t) { return /」$/.test(t); }) && texts.some(function (t) { return /^「/.test(t); }))) {
        return { stillSplit: false, gapKept: false };
      }
      var afterClose = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '」') afterClose = true;
        if (afterClose && items[i].type === 'gap') {
          return {
            stillSplit: true,
            gapKept: true,
          };
        }
        if (afterClose && items[i].type === 'char' && items[i].ch === '「') break;
      }
      return { stillSplit: true, gapKept: false };
    });
    if (lockedCross.stillSplit) expect(lockedCross.gapKept).toBe(true);
  });
});

test.describe('第 5 步 行尾 / 段末', function () {
  test('段末短行不撑：最后一行合远小于行宽时缝上没有正 padding', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '这是一段足够长的汉字汉字汉字汉字汉字汉字汉字汉字。短。');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var last = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var layout = window.Katsuji.buildBlockLayout(p);
      var lastL = layout.heads.length - 1;
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, lastL);
      var pads = [];
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'gap') continue;
        if (layout.items[i].el.getAttribute('data-ts-line-start-open-gap') === '1') continue;
        pads.push(parseFloat(layout.items[i].el.style.paddingLeft) || 0);
      }
      var line = window.Katsuji.measureBlockVisualLines(p).lines[lastL];
      return { pads: pads, visual: line.lineVisualEm, max: layout.maxEm, text: line.text };
    });
    expect(last.visual).toBeLessThan(last.max - 0.75);
    last.pads.forEach(function (pad) {
      expect(pad).toBeLessThan(0.01);
    });
  });

  test('满行字」下一行。：压入量 0 仍抽上来并包半角、收接缝', async function ({ page }) {
    await openHost(page, 17);
    await setParagraph(page, '字字字字字字字字字字字字字字字字」。下一行还有字字字字字字字字');
    var before = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      var p = document.querySelector('#host p');
      var first = window.Katsuji.measureBlockVisualLines(p).lines[0];
      host.style.width = first.lineVisualEm + 'em';
      void host.offsetHeight;
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      return { first: lines[0].text, second: lines[1] && lines[1].text };
    });
    expect(before.first).toMatch(/」$/);
    expect(before.second).toMatch(/^。/);

    var after = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = document.querySelector('#host p');
      window.Katsuji.resetHangAdjustments(host);
      var hit = window.Katsuji.processLine(p, 0);
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var layout = window.Katsuji.buildBlockLayout(p);
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var closeGap = null;
      var closeHalf = false;
      var periodWrapped = false;
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'char') continue;
        if (layout.items[i].ch === '」') {
          if (i + 1 <= range.endIndex && layout.items[i + 1].type === 'gap') {
            closeGap = layout.items[i + 1].el;
          }
          var closeEl = layout.items[i].node && layout.items[i].node.parentElement;
          while (closeEl) {
            if (closeEl.classList && closeEl.classList.contains('ts-half-punct')) {
              closeHalf = true;
              break;
            }
            closeEl = closeEl.parentElement;
          }
        }
        if (layout.items[i].ch === '。') {
          var el = layout.items[i].node && layout.items[i].node.parentElement;
          while (el) {
            if (el.classList && el.classList.contains('ts-half-punct')) {
              periodWrapped = true;
              break;
            }
            el = el.parentElement;
          }
        }
      }
      var lineEnd = null;
      if (hit && hit.parts) {
        for (var n = 0; n < hit.parts.length; n++) {
          if (hit.parts[n].kind === 'line-end') lineEnd = hit.parts[n];
        }
      }
      return {
        first: lines[0].text,
        branch: lineEnd && lineEnd.branch,
        usedPushFallback: lineEnd && lineEnd.usedPushFallback,
        em: lineEnd && lineEnd.em,
        pullBaseEm: lineEnd && lineEnd.pullBaseEm,
        periodWrapped: periodWrapped,
        closeHalf: closeHalf,
        closeGap: !!closeGap,
      };
    });
    expect(after.branch).toBe('5.1');
    expect(after.usedPushFallback).toBe(false);
    expect(after.pullBaseEm).toBe(0);
    expect(after.first).toMatch(/」。/);
    expect(after.periodWrapped).toBe(true);
    expect(after.closeHalf).toBe(true);
    expect(after.closeGap).toBe(false);
  });

  test('撑行：本行只有行尾后缝时，压入不抽这条缝', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '一二三四五六七，八九十一二三四五六七八九十');
    var before = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      var p = document.querySelector('#host p');
      var first = window.Katsuji.measureBlockVisualLines(p).lines[0];
      host.style.width = first.lineVisualEm + 0.6 + 'em';
      void host.offsetHeight;
      var again = window.Katsuji.measureBlockVisualLines(p).lines[0];
      return { first: again.text };
    });
    expect(before.first).toMatch(/，$/);

    var after = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = document.querySelector('#host p');
      window.Katsuji.resetHangAdjustments(host);
      var hit = window.Katsuji.processLine(p, 0);
      var layout = window.Katsuji.buildBlockLayout(p);
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var commaGap = null;
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'char' || layout.items[i].ch !== '，') continue;
        if (i + 1 <= range.endIndex && layout.items[i + 1].type === 'gap') {
          commaGap = layout.items[i + 1].el;
        }
        break;
      }
      var lineEnd = null;
      if (hit && hit.parts) {
        for (var n = 0; n < hit.parts.length; n++) {
          if (hit.parts[n].kind === 'line-end') lineEnd = hit.parts[n];
        }
      }
      return {
        branch: lineEnd && lineEnd.branch,
        usedPushFallback: lineEnd && lineEnd.usedPushFallback,
        gapCount: lineEnd && lineEnd.gaps ? lineEnd.gaps.length : 0,
        em: lineEnd && lineEnd.em,
        commaMl: commaGap ? commaGap.style.marginLeft : '',
        locked: !!(commaGap && commaGap.getAttribute('data-ts-line-end-gap') === '1'),
      };
    });
    expect(after.branch).toBe('5.2');
    expect(after.usedPushFallback).toBe(true);
    expect(after.gapCount).toBe(0);
    expect(after.em == null || after.em === '0em').toBe(true);
    expect(after.commaMl === '' || after.commaMl === '0px' || after.commaMl === '0em').toBe(true);
    expect(after.locked).toBe(true);
  });

  test('撑行抽 了」：后面的」一并抽上来，不晾成新行头', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '一二三四五六七八九十人了」但以造物主之名后面还有很多汉字汉字汉字汉字汉字');
    var before = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      var p = document.querySelector('#host p');
      var found = null;
      for (var em = 8; em <= 16; em += 0.1) {
        host.style.width = em + 'em';
        void host.offsetHeight;
        var lines = window.Katsuji.measureBlockVisualLines(p).lines;
        if (lines.length < 2) continue;
        if (!/人$/.test(lines[0].text) || !/^了」/.test(lines[1].text)) continue;
        host.style.width = lines[0].lineVisualEm + 0.65 + 'em';
        void host.offsetHeight;
        var again = window.Katsuji.measureBlockVisualLines(p).lines;
        if (again.length < 2 || !/人$/.test(again[0].text) || !/^了」/.test(again[1].text)) {
          continue;
        }
        found = { first: again[0].text, second: again[1].text };
        break;
      }
      return found;
    });
    expect(before).toBeTruthy();
    expect(before.first).toMatch(/人$/);
    expect(before.second).toMatch(/^了」/);

    var after = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = document.querySelector('#host p');
      window.Katsuji.resetHangAdjustments(host);
      window.Katsuji.processLine(p, 0);
      void host.offsetHeight;
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      return {
        first: lines[0] && lines[0].text,
        second: lines[1] && lines[1].text,
      };
    });
    expect(after.second).not.toMatch(/^」/);
    if (/了$/.test(after.first)) {
      expect(after.first).toMatch(/了」$/);
    }
  });

  test('撑行推出前有空：括号前空不加推出量', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '一二三，四五六七八（九十一二三四五六七八九十甲乙丙丁戊己庚');
    var before = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      var p = document.querySelector('#host p');
      var found = null;
      for (var em = 7; em <= 14; em += 0.1) {
        host.style.width = em + 'em';
        void host.offsetHeight;
        var lines = window.Katsuji.measureBlockVisualLines(p).lines;
        if (lines.length < 2) continue;
        if (/（$/.test(lines[0].text)) {
          found = { widthEm: em, first: lines[0].text, visual: lines[0].lineVisualEm };
          break;
        }
      }
      if (!found) return null;
      host.style.width = found.visual + 0.15 + 'em';
      void host.offsetHeight;
      var again = window.Katsuji.measureBlockVisualLines(p).lines[0];
      return { first: again.text, visual: again.lineVisualEm };
    });
    expect(before).toBeTruthy();
    expect(before.first).toMatch(/（$/);

    var after = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = document.querySelector('#host p');
      window.Katsuji.resetHangAdjustments(host);
      var hit = window.Katsuji.processLine(p, 0);
      var layout = window.Katsuji.buildBlockLayout(p);
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var commaGap = null;
      var openGap = null;
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'char') continue;
        if (layout.items[i].ch === '，' && i + 1 <= range.endIndex && layout.items[i + 1].type === 'gap') {
          commaGap = layout.items[i + 1].el;
        }
        if (layout.items[i].ch === '（' && i > 0 && layout.items[i - 1].type === 'gap') {
          openGap = layout.items[i - 1].el;
        }
      }
      var lineEnd = null;
      if (hit && hit.parts) {
        for (var n = 0; n < hit.parts.length; n++) {
          if (hit.parts[n].kind === 'line-end') lineEnd = hit.parts[n];
        }
      }
      void host.offsetHeight;
      var first = window.Katsuji.measureBlockVisualLines(p).lines[0];
      return {
        branch: lineEnd && lineEnd.branch,
        usedPushFallback: lineEnd && lineEnd.usedPushFallback,
        gapCount: lineEnd && lineEnd.gaps ? lineEnd.gaps.length : 0,
        em: lineEnd && lineEnd.em,
        commaMl: commaGap ? commaGap.style.marginLeft : '',
        openMl: openGap ? openGap.style.marginLeft : '',
        first: first.text,
      };
    });
    expect(after.branch).toBe('5.2');
    expect(after.usedPushFallback).toBe(true);
    expect(after.gapCount).toBe(1);
    expect(after.em).toMatch(/^\d/);
    expect(after.commaMl).toMatch(/^\d/);
    expect(after.openMl).toBe('');
    expect(after.first).not.toMatch(/（$/);
  });

  test('非段末行尾是后有空、撑行时收成半角盒', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var hit = [];
      for (var i = 0; i < lines.length - 1; i++) {
        var t = lines[i].text;
        var last = t.charAt(t.length - 1);
        if ('，。、；：？！'.indexOf(last) < 0) continue;
        var halfs = p.querySelectorAll('span.ts-half-punct');
        var wrapped = false;
        for (var h = 0; h < halfs.length; h++) {
          if ((halfs[h].textContent || '').indexOf(last) >= 0 && !halfs[h].getAttribute('data-ts-line-start-open')) {
            wrapped = true;
          }
        }
        hit.push({ line: t, last: last, wrapped: wrapped });
      }
      return { lineCount: lines.length, hit: hit };
    });
    expect(info.lineCount).toBeGreaterThan(1);
    expect(info.hit.length).toBeGreaterThan(0);
    info.hit.forEach(function (row) {
      expect(row.wrapped).toBe(true);
    });
  });

  test('撑行推出：连写已收的行尾逗号仍挂出去', async function ({ page }) {
    await openHost(page, 22);
    await setParagraph(
      page,
      '减十；学生证再九折。」有个孩子问：「妈妈，『利』是什么？」母亲想了想：「就是你想要、又不肯放手的东西。」孩子「哦」了一声，又问：「那『往』呢？」后面还有汉字汉字汉字汉字汉字汉字汉字汉字汉字汉字',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeftIndent: true, hangLeft: false, hangRight: 'stops' },
      });
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var mama = null;
      for (var i = 0; i < lines.length; i++) {
        if (/妈妈，$/.test(lines[i].text || '')) mama = lines[i].text;
      }
      var hung = [];
      var halves = p.querySelectorAll('span.ts-half-punct');
      for (var h = 0; h < halves.length; h++) {
        if ((halves[h].textContent || '') !== '，') continue;
        hung.push({
          hang: halves[h].getAttribute('data-ts-hang-end') === '1',
          mr: halves[h].style.marginRight,
        });
      }
      return { mama: mama, hung: hung, lines: lines.map(function (l) { return l.text; }) };
    });
    expect(info.mama).toBeTruthy();
    expect(info.hung.some(function (row) { return row.hang && row.mr === '-0.5em'; })).toBe(true);
  });
});

test.describe('步进', function () {
  test('下一步一次做完一行，而不是一处缝', async function ({ page }) {
    await openHost(page, 10);
    await setParagraph(page, '会议议题有三项：进说啊啊啊度汇报、风险排查、以及下阶段计划（含预算）请准时参加！');
    var kinds = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.resetHangAdjustments(host);
      var seen = [];
      for (var i = 0; i < 12; i++) {
        var hit = window.Katsuji.stepHangAvoidance(host);
        if (!hit) break;
        seen.push(hit.kind);
      }
      return seen;
    });
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds.every(function (k) { return k === 'line'; })).toBe(true);
  });
});

test.describe('标点悬挂', function () {
  test('无参不开悬挂：右边距不增，句读不进沟', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十abcdefghij');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      var before = getComputedStyle(p).paddingRight;
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      var after = getComputedStyle(p).paddingRight;
      var hung = p.querySelector('[data-ts-hang-end]');
      return { before: before, after: after, hung: !!hung };
    });
    expect(info.after).toBe(info.before);
    expect(info.hung).toBe(false);
  });

  test('打开右挂：左右边距各 +0.5em，行尾 。 推出', async function ({ page }) {
    await openHost(page, 8.5);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十abcdefghij');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      var fs = parseFloat(getComputedStyle(p).fontSize);
      p.style.paddingRight = '0.2em';
      void host.offsetHeight;
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var pr = parseFloat(getComputedStyle(p).paddingRight) / fs;
      var pl = parseFloat(getComputedStyle(p).paddingLeft) / fs;
      var end = p.querySelector('[data-ts-hang-end]');
      return {
        padRightEm: pr,
        padLeftEm: pl,
        hung: !!(end && (end.textContent || '').indexOf('。') >= 0),
        hangMr: end ? end.style.marginRight : '',
      };
    });
    expect(info.padRightEm).toBeCloseTo(0.7, 2);
    expect(info.padLeftEm).toBeCloseTo(0.5, 2);
    expect(info.hung).toBe(true);
    expect(info.hangMr).toBe('-0.5em');
    var gutter = await hangGutter(page);
    expect(gutter.overflow).toBeGreaterThan(gutter.fs * 0.15);
  });

  test('挤进可悬挂：行内缝撑满，墨过内容盒右缘，不用 transform', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '一，二三四五六七八，甲乙丙丁戊己庚辛壬癸子丑寅卯');
    var before = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      p.style.paddingRight = '0.5em';
      var found = null;
      for (var em = 6; em <= 14; em += 0.1) {
        host.style.width = em + 'em';
        void host.offsetHeight;
        var lines = window.Katsuji.measureBlockVisualLines(p).lines;
        if (lines.length < 2) continue;
        if (/，$/.test(lines[0].text) || lines[0].text.indexOf('，') < 0) continue;
        if (!/^，/.test(lines[1].text)) continue;
        host.style.width = lines[0].lineVisualEm + 0.4 + 0.5 + 'em';
        void host.offsetHeight;
        var again = window.Katsuji.measureBlockVisualLines(p).lines;
        if (again.length < 2 || /^，/.test(again[0].text) || !/^，/.test(again[1].text)) continue;
        if (again[0].text.indexOf('，') < 0) continue;
        found = { first: again[0].text, second: again[1].text };
        break;
      }
      return found;
    });
    expect(before).toBeTruthy();
    expect(before.first).toMatch(/，/);
    expect(before.second).toMatch(/^，/);

    var after = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.resetHangAdjustments(host);
      p.style.paddingRight = '0.5em';
      var hit = window.Katsuji.processLine(p, 0, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      void host.offsetHeight;
      var layout = window.Katsuji.buildBlockLayout(p);
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var interiorPad = 0;
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'char' || layout.items[i].ch !== '，') continue;
        if (i + 1 <= range.endIndex && layout.items[i + 1].type === 'gap') {
          interiorPad = parseFloat(layout.items[i + 1].el.style.paddingLeft) || 0;
        }
        break;
      }
      var end = p.querySelector('[data-ts-hang-end]');
      var lineEnd = null;
      if (hit && hit.parts) {
        for (var n = 0; n < hit.parts.length; n++) {
          if (hit.parts[n].kind === 'line-end') lineEnd = hit.parts[n];
        }
      }
      return {
        branch: lineEnd && lineEnd.branch,
        usedPushFallback: lineEnd && lineEnd.usedPushFallback,
        fillEm: lineEnd && lineEnd.fillEm,
        interiorPad: interiorPad,
        transform: end ? end.style.transform : '',
      };
    });
    expect(after.branch).toBe('5.1');
    expect(after.usedPushFallback).toBe(false);
    expect(after.fillEm).toBeGreaterThan(0.05);
    expect(after.interiorPad).toBeGreaterThan(0.05);
    expect(after.transform).toBe('');
    var gutter = await hangGutter(page);
    expect(gutter.hung).toBe(true);
    expect(gutter.ch).toMatch(/[，。、]/);
    expect(gutter.leftoverEm).toBeLessThan(0.25);
    expect(gutter.overflow).toBeGreaterThan(gutter.fs * 0.15);
  });

  test('抽 。」：串内连写先收半角，」才能跟上来', async function ({ page }) {
    await openHost(page, 29);
    await setParagraph(
      page,
      '《汉书》有云：「天下熙熙，皆为利来；天下攘攘，皆为利往。」这话放在今天，也并不过时。后面还有很多汉字汉字汉字汉字汉字汉字',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      p.style.textIndent = '2em';
      host.style.width = '29em';
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeft: true, hangRight: 'stops' },
      });
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var together = -1;
      for (var i = 0; i < lines.length; i++) {
        if (/往。」/.test((lines[i].text || '').replace(/\s+/g, ''))) together = i;
      }
      var periodHalf = false;
      var halfs = p.querySelectorAll('.ts-half-punct');
      for (var h = 0; h < halfs.length; h++) {
        if ((halfs[h].textContent || '').indexOf('。') >= 0) periodHalf = true;
      }
      return { together: together, text: together >= 0 ? lines[together].text : '', periodHalf: periodHalf };
    });
    expect(info.together).toBeGreaterThanOrEqual(0);
    expect(info.text).toMatch(/往。」/);
    expect(info.periodHalf).toBe(true);
  });

  test('抽不可悬挂 」：第四步剩 0.5 也要摊满正文，不是停在沟里', async function ({ page }) {
    await openHost(page, 33);
    await setParagraph(
      page,
      '说、旅行手册、食谱……收银处贴着告示：「满百减十；学生证再九折。」有个孩子问：「妈妈」后面还有汉字汉字汉字汉字汉字',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      host.style.width = '33em';
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangLeft: false, hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var layout = window.Katsuji.buildBlockLayout(p);
      var L = -1;
      for (var i = 0; i < lines.length; i++) {
        if (/折。」/.test((lines[i].text || '').replace(/\s+/g, ''))) {
          L = i;
          break;
        }
      }
      if (L < 0) return { found: false };
      var maxEm = window.Katsuji.blockLineMaxEm(layout, L);
      var visual = lines[L].lineVisualEm;
      var end = p.querySelector('[data-ts-hang-end]');
      return {
        found: true,
        text: lines[L].text,
        leftoverEm: maxEm - visual,
        hungClose: !!(end && (end.textContent || '').indexOf('」') >= 0),
      };
    });
    expect(info.found).toBe(true);
    expect(info.text).toMatch(/折。」/);
    expect(info.hungClose).toBe(false);
    expect(info.leftoverEm).toBeLessThan(0.12);
  });

  test('抽段末 。：连写剩 0.5 也要摊满，句号进沟', async function ({ page }) {
    await openHost(page, 27);
    await setParagraph(page, '今英国议会所提之条件」「我相信是这正是美洲的共同心声。');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var layout = window.Katsuji.buildBlockLayout(p);
      var L = lines.length - 1;
      for (var i = 0; i < lines.length; i++) {
        if (/。$/.test((lines[i].text || '').replace(/\s+$/, ''))) {
          L = i;
          break;
        }
      }
      var maxEm = layout ? window.Katsuji.blockLineMaxEm(layout, L) : 0;
      var visual = lines[L] ? lines[L].lineVisualEm : 0;
      var end = p.querySelector('[data-ts-hang-end]');
      return {
        lineCount: lines.length,
        text: lines[L] && lines[L].text,
        leftoverEm: maxEm - visual,
        hung: !!(end && (end.textContent || '').indexOf('。') >= 0),
        hangMr: end ? end.style.marginRight : '',
      };
    });
    expect(info.hung).toBe(true);
    expect(info.hangMr).toBe('-0.5em');
    expect(info.leftoverEm).toBeLessThan(0.25);
    var gutter = await hangGutter(page);
    expect(gutter.overflow).toBeGreaterThan(gutter.fs * 0.15);
  });

  test('行尾 」 默认不推出', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '一二三四五六七」八九十一二三四五六七八九十');
    var hung = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var end = p.querySelector('[data-ts-hang-end]');
      return !!(end && (end.textContent || '').indexOf('」') >= 0);
    });
    expect(hung).toBe(false);
  });

  test('开启悬挂左右 padding 各 +0.5em', async function ({ page }) {
    await openHost(page, 12);
    await setParagraph(page, '（一二三四五六七八九十一二三四五六七八九十');
    var pad = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      var fs = parseFloat(getComputedStyle(p).fontSize);
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      return {
        left: parseFloat(getComputedStyle(p).paddingLeft) / fs,
        right: parseFloat(getComputedStyle(p).paddingRight) / fs,
      };
    });
    expect(pad.left).toBeCloseTo(0.5, 2);
    expect(pad.right).toBeCloseTo(0.5, 2);
  });

  test('段末短行 。 不挂', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '短句。');
    var hung = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      return !!host.querySelector('[data-ts-hang-end]');
    });
    expect(hung).toBe(false);
  });

  test('取消调整拿掉我们加的 padding', async function ({ page }) {
    await openHost(page, 8);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十abcdefghij');
    var pads = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      var fs = parseFloat(getComputedStyle(p).fontSize);
      p.style.paddingRight = '0.2em';
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var midRight = parseFloat(getComputedStyle(p).paddingRight) / fs;
      var midLeft = parseFloat(getComputedStyle(p).paddingLeft) / fs;
      window.Katsuji.resetHangAdjustments(host);
      var afterRight = parseFloat(getComputedStyle(p).paddingRight) / fs;
      var afterLeft = parseFloat(getComputedStyle(p).paddingLeft) / fs;
      return { midRight: midRight, midLeft: midLeft, afterRight: afterRight, afterLeft: afterLeft };
    });
    expect(pads.midRight).toBeCloseTo(0.7, 2);
    expect(pads.midLeft).toBeCloseTo(0.5, 2);
    expect(pads.afterRight).toBeCloseTo(0.2, 2);
    expect(pads.afterLeft).toBeCloseTo(0, 2);
  });

  test('首行 text-indent 计入行宽（悬挂关）', async function ({ page }) {
    await openHost(page, 16);
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '字字字字字字字字字字字字字字字字字字字字字字字字';
      p.style.textIndent = '2em';
      host.appendChild(p);
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
      var layout = window.Katsuji.buildBlockLayout(p);
      return {
        maxEm: layout.maxEm,
        indentEm: layout.indentEm,
        firstLineMax: window.Katsuji.lineMaxEm(layout.maxEm, layout.indentEm, 0),
        secondLineMax: window.Katsuji.lineMaxEm(layout.maxEm, layout.indentEm, 1),
      };
    });
    expect(info.indentEm).toBeCloseTo(2, 2);
    expect(info.firstLineMax).toBeCloseTo(info.maxEm - 2, 2);
    expect(info.secondLineMax).toBeCloseTo(info.maxEm, 2);
  });

  test('半角盒不继承段首 text-indent', async function ({ page }) {
    await openHost(page, 8.5);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十abcdefghij');
    var indent = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      p.style.textIndent = '2em';
      void host.offsetHeight;
      var half = p.querySelector('span.ts-half-punct');
      return half ? getComputedStyle(half).textIndent : null;
    });
    expect(indent).toBeTruthy();
    expect(parseFloat(indent) || 0).toBe(0);
  });
});

test.describe('置中标点', function () {
  test('。左右各一条缝，？无缝，不叠缝', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '汉。汉？汉');
    var info = await page.evaluate(() => {
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(document.getElementById('host'));
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      var seq = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char') seq.push(items[i].ch);
        else seq.push(items[i].el.getAttribute('data-ts-open-gap') === '1' ? '[open]' : '[after]');
      }
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return seq;
    });
    expect(info).toEqual(['汉', '[open]', '。', '[after]', '汉', '？', '汉']);
  });

  test('行首。锁前缝；）」收左；。」收右（」半角，。不左裁）', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(page, '。行首点号后面还有很多汉字用来撑开这一行避免过短）」文。」文');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      var p = host.querySelector('p');
      var first = p.querySelector('[data-ts-line-start-open-gap]');
      var halves = Array.prototype.map.call(p.querySelectorAll('span.ts-half-punct'), function (el) {
        return {
          ch: el.textContent,
          center: el.getAttribute('data-ts-center-hang') === '1',
        };
      });
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return {
        locked: !!first,
        halves: halves,
      };
    });
    expect(info.locked).toBe(true);
    expect(info.halves.some(function (h) { return h.ch === '）' && !h.center; })).toBe(true);
    expect(info.halves.some(function (h) { return h.ch === '」' && !h.center; })).toBe(true);
    expect(info.halves.some(function (h) { return h.ch === '。' && !h.center; })).toBe(false);
  });

  test('行尾：包居中半角盒', async function ({ page }) {
    await openHost(page, 8.5);
    await setParagraph(page, '一二三四五六七：八九十一二三四五六七八九十abcdefghij');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var colon = Array.prototype.filter.call(p.querySelectorAll('span.ts-half-punct'), function (el) {
        return el.textContent === '：';
      })[0];
      var glyph = colon && colon.querySelector('[data-ts-center-hang-glyph]');
      var items = window.Katsuji.flattenParagraph(p);
      var beforeLocked = false;
      var afterLocked = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type !== 'char' || items[i].ch !== '：') continue;
        if (i > 0 && items[i - 1].type === 'gap') {
          beforeLocked = items[i - 1].el.getAttribute('data-ts-line-end-gap') === '1';
        }
        if (i + 1 < items.length && items[i + 1].type === 'gap') {
          afterLocked = items[i + 1].el.getAttribute('data-ts-line-end-gap') === '1';
        }
        break;
      }
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return {
        wrapped: !!colon,
        center: !!(colon && colon.getAttribute('data-ts-center-hang') === '1'),
        innerMl: glyph ? glyph.style.marginLeft : '',
        hung: !!(colon && colon.getAttribute('data-ts-hang-end') === '1'),
        beforeLocked: beforeLocked,
        afterLocked: afterLocked,
      };
    });
    expect(info.wrapped).toBe(true);
    expect(info.center).toBe(true);
    expect(info.innerMl).toBe('-0.25em');
    expect(info.hung).toBe(false);
    expect(info.beforeLocked).toBe(false);
    expect(info.afterLocked).toBe(true);
  });

  test('挂。是居中盒不是左裁', async function ({ page }) {
    await openHost(page, 8.5);
    await setParagraph(page, '一二三四五六七。八九十一二三四五六七八九十abcdefghij');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
      var p = host.querySelector('p');
      var hung = p.querySelector('[data-ts-center-hang]');
      var glyph = hung && hung.querySelector('[data-ts-center-hang-glyph]');
      var items = window.Katsuji.flattenParagraph(p);
      var beforeLocked = false;
      var afterLocked = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type !== 'char' || items[i].ch !== '。') continue;
        if (i > 0 && items[i - 1].type === 'gap') {
          beforeLocked = items[i - 1].el.getAttribute('data-ts-line-end-gap') === '1';
        }
        if (i + 1 < items.length && items[i + 1].type === 'gap') {
          afterLocked = items[i + 1].el.getAttribute('data-ts-line-end-gap') === '1';
        }
        break;
      }
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return {
        hung: !!hung,
        hangEnd: !!(hung && hung.getAttribute('data-ts-hang-end') === '1'),
        innerMl: glyph ? glyph.style.marginLeft : '',
        align: hung ? getComputedStyle(hung).textAlign : '',
        beforeLocked: beforeLocked,
        afterLocked: afterLocked,
      };
    });
    expect(info.hung).toBe(true);
    expect(info.hangEnd).toBe(true);
    expect(info.innerMl).toBe('-0.25em');
    expect(info.beforeLocked).toBe(true);
    expect(info.afterLocked).toBe(true);
  });

  test('重跑补回点号前缝且不叠缝', async function ({ page }) {
    await openHost(page, 20);
    await setParagraph(page, '汉。汉');
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(host);
      var p = host.querySelector('p');
      var open = p.querySelector('[data-ts-open-gap]');
      if (open && open.parentNode) open.parentNode.removeChild(open);
      window.Katsuji.applyHangAvoidance(host);
      var items = window.Katsuji.flattenParagraph(p);
      var seq = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char') seq.push(items[i].ch);
        else seq.push(items[i].el.getAttribute('data-ts-open-gap') === '1' ? '[open]' : '[after]');
      }
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return seq;
    });
    expect(info).toEqual(['汉', '[open]', '。', '[after]', '汉']);
  });

  test('满行：「 收右之后不把捉刀摊出，也不给行内缝加 1em+', async function ({ page }) {
    await openHost(page, 30);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.style.textIndent = '2em';
      p.textContent =
        '（第三次联席会，含预算）议题有三项：「进度汇报、风险排查、以及下阶段计划（含印刷、纸张、装订）」。请准时参加！会上有人提起《红楼梦》，说它是一部奇书，而「脂砚斋」批语更让读者着迷：你怎么看？另有人反问：「批语是作者自拟，还是他人捉刀？」争论未决，主席只得敲槌：「先记下来，会后再议。」散会时已近黄昏，走廊里还能听见：「《石头记》……脂批……真伪……」';
      host.appendChild(p);
    });
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.setPunctConfig({ punctAlign: 'center' });
      window.Katsuji.apply(host);
      window.Katsuji.resetHangAdjustments(host);
      var opts = {
        hangingPunctuation: { hangLeftIndent: true, hangLeft: false, hangRight: 'stops' },
      };
      var fills = [];
      for (var s = 0; s < 16; s++) {
        var hit = window.Katsuji.stepHangAvoidance(host, opts);
        if (!hit) break;
        var part = (hit.parts || []).filter(function (x) {
          return x.kind === 'line-end';
        })[0];
        if (part && part.fillEm > 0.6) {
          fills.push({ fillEm: part.fillEm, branch: part.branch, L: hit.lineIndex });
        }
      }
      var layout = window.Katsuji.buildBlockLayout(p);
      var lines = [];
      var maxPad = 0;
      if (layout) {
        for (var i = 0; i < layout.heads.length; i++) {
          var r = window.Katsuji.lineItemBounds(layout.items, layout.heads, i);
          var m = window.Katsuji.measureLineVisualMetricsPx(p, layout.items, r.startIndex, r.endIndex);
          var text = (m.text || '').replace(/\s+/g, '');
          lines.push(text);
          for (var g = r.startIndex; g <= r.endIndex && g < layout.items.length; g++) {
            if (layout.items[g].type !== 'gap') continue;
            var pl = parseFloat(layout.items[g].el.style.paddingLeft) || 0;
            var em = pl / layout.emPx;
            if (em > maxPad) maxPad = em;
          }
        }
      }
      window.Katsuji.setPunctConfig({ punctAlign: 'corner' });
      return {
        fills: fills,
        maxPad: maxPad,
        hasDao: lines.some(function (t) {
          return t.indexOf('还是他人捉刀') !== -1;
        }),
        brokeAtNi: lines.some(function (t) {
          return /自拟，$/.test(t) && t.indexOf('捉刀') < 0;
        }),
      };
    });
    expect(info.fills).toEqual([]);
    expect(info.maxPad).toBeLessThan(0.6);
    expect(info.hasDao).toBe(true);
    expect(info.brokeAtNi).toBe(false);
  });
});

test.describe('Ruby 适配：不扫注音、不切 ruby', function () {
  test('flatten 只有底，没有 rt；ruby 里不插缝', async function ({ page }) {
    await openHost(page, 20);
    await setHtml(page, '甲<ruby>漢字<rt>ㄏㄢˋㄗˋ</rt></ruby>乙');
    await page.evaluate(() => window.Katsuji.apply(document.getElementById('host')));
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      var text = items
        .filter(function (it) {
          return it.type === 'char';
        })
        .map(function (it) {
          return it.ch;
        })
        .join('');
      var ruby = p.querySelector('ruby');
      return {
        text: text,
        rubyGaps: ruby ? ruby.querySelectorAll('span.ts-gap').length : -1,
        rtGaps: p.querySelector('rt') ? p.querySelector('rt').querySelectorAll('span.ts-gap').length : -1,
      };
    });
    expect(info.text).toBe('甲漢字乙');
    expect(info.rubyGaps).toBe(0);
    expect(info.rtGaps).toBe(0);
  });

  test('挂完不把注音认成新行；ruby 里不包半角盒', async function ({ page }) {
    await openHost(page, 20);
    await setHtml(page, '前<ruby>「漢」<rt>かん</rt></ruby>后。');
    await page.evaluate(() => {
      window.Katsuji.apply(document.getElementById('host'));
      window.Katsuji.applyHangAvoidance(document.getElementById('host'), {
        hangingPunctuation: { hangRight: 'stops', hangLeftIndent: false, hangLeft: false },
      });
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var layout = window.Katsuji.buildBlockLayout(p);
      var lines = [];
      if (layout) {
        for (var i = 0; i < layout.heads.length; i++) {
          var r = window.Katsuji.lineItemBounds(layout.items, layout.heads, i);
          var lc = window.Katsuji.lineCharsFromItems(layout.items, r.startIndex, r.endIndex);
          lines.push(lc.text);
        }
      }
      var ruby = p.querySelector('ruby');
      var style = document.getElementById('ts-ruby-skip-line-break');
      return {
        lines: lines,
        lineN: lines.length,
        joined: lines.join(''),
        rubyGaps: ruby ? ruby.querySelectorAll('span.ts-gap').length : -1,
        rubyWraps: ruby
          ? ruby.querySelectorAll('span.ts-half-punct, span.ts-line-end-half').length
          : -1,
        hasSkipStyle: !!(style && document.getElementById('host').getAttribute('data-ts-relax') === '1'),
      };
    });
    expect(info.hasSkipStyle).toBe(true);
    expect(info.lineN).toBeLessThan(4);
    expect(info.joined.indexOf('かん')).toBe(-1);
    expect(info.joined.indexOf('漢')).toBeGreaterThan(-1);
    expect(info.rubyGaps).toBe(0);
    expect(info.rubyWraps).toBe(0);
  });
});
