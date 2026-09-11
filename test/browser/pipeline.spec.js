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

function lineTexts(page) {
  return page.evaluate(() => {
    var p = document.querySelector('#host p');
    var m = window.Katsuji.measureBlockVisualLines(p);
    return m.lines.map(function (line) {
      return line.text;
    });
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
  test('段首行是前有空：不顶格', async function ({ page }) {
    await openHost(page, 16);
    await setParagraph(page, '（段首开括号后面还有很多汉字用来撑开这一行的宽度避免过短');
    await page.evaluate(() => {
      var host = document.getElementById('host');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
    });
    var flagged = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      return {
        open: p.querySelectorAll('[data-ts-line-start-open]').length,
        first: (p.textContent || '').charAt(0),
      };
    });
    expect(flagged.first).toBe('（');
    expect(flagged.open).toBe(0);
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
});

test.describe('第 4 步 连写', function () {
  test('。」只锁中间那一条缝为 −0.5em', async function ({ page }) {
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
      var between = [];
      var seen = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '。') seen = true;
        if (seen && items[i].type === 'gap') {
          between.push({
            combo: items[i].el.getAttribute('data-ts-combo-fixed') === '1',
            ml: items[i].el.style.marginLeft,
          });
        }
        if (seen && items[i].type === 'char' && items[i].ch === '」') break;
      }
      return between;
    });
    expect(combo.length).toBe(1);
    expect(combo[0].combo).toBe(true);
    expect(combo[0].ml).toBe('-0.5em');
  });

  test('）（两条缝只锁前一条', async function ({ page }) {
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
      var take = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '）') take = true;
        if (take && items[i].type === 'gap') {
          out.push({
            combo: items[i].el.getAttribute('data-ts-combo-fixed') === '1',
            open: items[i].el.getAttribute('data-ts-open-gap') === '1',
            ml: items[i].el.style.marginLeft,
          });
        }
        if (take && items[i].type === 'char' && items[i].ch === '（') break;
      }
      return out;
    });
    expect(gaps.length).toBe(2);
    expect(gaps[0].combo).toBe(true);
    expect(gaps[0].ml).toBe('-0.5em');
    expect(gaps[1].combo).toBe(false);
    expect(gaps[1].open).toBe(true);
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
        return { stillSplit: false, combo: false };
      }
      var afterClose = false;
      for (var i = 0; i < items.length; i++) {
        if (items[i].type === 'char' && items[i].ch === '」') afterClose = true;
        if (afterClose && items[i].type === 'gap') {
          return {
            stillSplit: true,
            combo: items[i].el.getAttribute('data-ts-combo-fixed') === '1',
          };
        }
        if (afterClose && items[i].type === 'char' && items[i].ch === '「') break;
      }
      return { stillSplit: true, combo: false };
    });
    if (lockedCross.stillSplit) expect(lockedCross.combo).toBe(false);
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
        if (layout.items[i].el.getAttribute('data-ts-combo-fixed') === '1') continue;
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

  test('满行字」下一行。：压入量 0 仍抽上来并包半角、锁接缝', async function ({ page }) {
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
      var periodWrapped = false;
      for (var i = range.startIndex; i <= range.endIndex; i++) {
        if (layout.items[i].type !== 'char') continue;
        if (layout.items[i].ch === '」') {
          if (i + 1 <= range.endIndex && layout.items[i + 1].type === 'gap') {
            closeGap = layout.items[i + 1].el;
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
        closeCombo: closeGap ? closeGap.getAttribute('data-ts-combo-fixed') : null,
        closeMl: closeGap ? closeGap.style.marginLeft : '',
      };
    });
    expect(after.branch).toBe('5.1');
    expect(after.usedPushFallback).toBe(false);
    expect(after.pullBaseEm).toBe(0);
    expect(after.first).toMatch(/」。/);
    expect(after.periodWrapped).toBe(true);
    expect(after.closeCombo).toBe('1');
    expect(after.closeMl).toBe('-0.5em');
  });

  test('撑行：本行只有行尾后有空那条缝时，压入仍抽这一条', async function ({ page }) {
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
      };
    });
    expect(after.branch).toBe('5.2');
    expect(after.usedPushFallback).toBe(false);
    expect(after.gapCount).toBe(1);
    expect(after.em).toMatch(/^-/);
    expect(after.commaMl).toMatch(/^-/);
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
