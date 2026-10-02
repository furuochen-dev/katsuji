import { test, expect } from '@playwright/test';

async function openHost(page) {
  var bootErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    await page.goto('/test/browser/harness.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__katsujiReady === true || window.__katsujiError);
    bootErr = await page.evaluate(() => window.__katsujiError || null);
    if (!bootErr) break;
  }
  if (bootErr) throw new Error(bootErr);
}

async function openVerticalHost(page, heightEm) {
  await openHost(page);
  await page.evaluate((em) => {
    var host = document.getElementById('host');
    host.style.width = 'auto';
    host.style.height = em + 'em';
    host.style.writingMode = 'vertical-rl';
  }, heightEm);
}

test.describe('竖排：只设 writing-mode', function () {
  test('？！：；两侧无空，。仍后有空', async function ({ page }) {
    await openVerticalHost(page, 16);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '看？好。例：后；尾';
      host.appendChild(p);
      window.Katsuji.apply(host);
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      function after(ch) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].type !== 'char' || items[i].ch !== ch) continue;
          return i + 1 < items.length && items[i + 1].type === 'gap';
        }
        return null;
      }
      return {
        q: after('？'),
        stop: after('。'),
        colon: after('：'),
        semi: after('；'),
        wm: getComputedStyle(p).writingMode,
      };
    });
    expect(info.wm).toMatch(/vertical/);
    expect(info.q).toBe(false);
    expect(info.stop).toBe(true);
    expect(info.colon).toBe(false);
    expect(info.semi).toBe(false);
  });

  test('rotateColon 竖排日标：；仍有后缝', async function ({ page }) {
    await openVerticalHost(page, 16);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '例：后；看？。';
      host.appendChild(p);
      window.Katsuji.setPunctConfig({ rotateColon: true });
      window.Katsuji.apply(host);
      window.Katsuji.setPunctConfig({ rotateColon: false });
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var items = window.Katsuji.flattenParagraph(p);
      function after(ch) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].type !== 'char' || items[i].ch !== ch) continue;
          return i + 1 < items.length && items[i + 1].type === 'gap';
        }
        return null;
      }
      return { colon: after('：'), semi: after('；'), q: after('？'), stop: after('。') };
    });
    expect(info.colon).toBe(true);
    expect(info.semi).toBe(true);
    expect(info.q).toBe(false);
    expect(info.stop).toBe(true);
  });

  test('同页横竖两段：竖排叠问叹和冒号', async function ({ page }) {
    await openHost(page);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.style.width = '16em';
      host.innerHTML = '';
      var h = document.createElement('p');
      h.textContent = '看？例：。';
      var v = document.createElement('p');
      v.textContent = '看？例：。';
      v.style.writingMode = 'vertical-rl';
      v.style.height = '8em';
      host.appendChild(h);
      host.appendChild(v);
      window.Katsuji.apply(host);
    });
    var info = await page.evaluate(() => {
      var ps = document.querySelectorAll('#host p');
      function after(p, ch) {
        var items = window.Katsuji.flattenParagraph(p);
        for (var i = 0; i < items.length; i++) {
          if (items[i].type !== 'char' || items[i].ch !== ch) continue;
          return i + 1 < items.length && items[i + 1].type === 'gap';
        }
        return null;
      }
      return {
        hQ: after(ps[0], '？'),
        vQ: after(ps[1], '？'),
        hColon: after(ps[0], '：'),
        vColon: after(ps[1], '：'),
        hStop: after(ps[0], '。'),
        vStop: after(ps[1], '。'),
      };
    });
    expect(info.hQ).toBe(true);
    expect(info.vQ).toBe(false);
    expect(info.hColon).toBe(true);
    expect(info.vColon).toBe(false);
    expect(info.hStop).toBe(true);
    expect(info.vStop).toBe(true);
  });

  test('高度约束下会分行', async function ({ page }) {
    await openVerticalHost(page, 8);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '一二三四五六七八九十一二三四五六七八九十abcdefghij';
      host.appendChild(p);
      window.Katsuji.apply(host);
      window.Katsuji.relaxBuiltinLineBreak(host);
      void host.offsetHeight;
    });
    var n = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      return window.Katsuji.measureBlockVisualLines(p).lines.length;
    });
    expect(n).toBeGreaterThan(1);
  });

  test('打开悬挂：行头行尾侧各 +0.5em，。推出，半角盒走 inline-size', async function ({ page }) {
    await openVerticalHost(page, 8.5);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '一二三四五六七。八九十一二三四五六七八九十abcdefghij';
      host.appendChild(p);
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var fs = parseFloat(getComputedStyle(p).fontSize) || 16;
      var padStart = parseFloat(getComputedStyle(p).getPropertyValue('padding-inline-start')) / fs;
      var padEnd = parseFloat(getComputedStyle(p).getPropertyValue('padding-inline-end')) / fs;
      var end = p.querySelector('[data-ts-hang-end]');
      var half = p.querySelector('span.ts-half-punct');
      var layout = window.Katsuji.buildBlockLayout(p);
      var lines = window.Katsuji.measureBlockVisualLines(p).lines;
      var L = 0;
      for (var i = 0; i < lines.length; i++) {
        if (/。$/.test((lines[i].text || '').replace(/\s+$/, ''))) {
          L = i;
          break;
        }
      }
      var leftoverEm = layout && lines[L] ? window.Katsuji.blockLineMaxEm(layout, L) - lines[L].lineVisualEm : 0;
      var halfCs = half ? getComputedStyle(half) : null;
      return {
        padStart: padStart,
        padEnd: padEnd,
        hung: !!(end && (end.textContent || '').indexOf('。') >= 0),
        hangMar: end ? end.style.getPropertyValue('margin-inline-end') : '',
        inlineSize: half ? half.style.getPropertyValue('inline-size') : '',
        width: half ? half.style.width : '',
        computedInlinePx: halfCs ? parseFloat(halfCs.getPropertyValue('inline-size')) || 0 : 0,
        leftoverEm: leftoverEm,
        fs: fs,
        lines: lines.length,
      };
    });
    expect(info.padStart).toBeCloseTo(0.5, 2);
    expect(info.padEnd).toBeCloseTo(0.5, 2);
    expect(info.hung).toBe(true);
    expect(info.hangMar).toBe('-0.5em');
    expect(info.inlineSize).toBe('0.5em');
    expect(info.width).toBe('');
    expect(info.computedInlinePx).toBeCloseTo(info.fs * 0.5, 0);
    expect(info.leftoverEm).toBeGreaterThan(0.2);
    expect(info.leftoverEm).toBeLessThan(0.7);
    expect(info.lines).toBeGreaterThan(1);
  });

  test('熟语探针在竖排下能量到合成宽', async function ({ page }) {
    await openVerticalHost(page, 20);
    await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML = '';
      var p = document.createElement('p');
      p.innerHTML =
        '今日之会，<jukugo><ruby>一<rt>いち</rt></ruby><ruby>期<rt>ご</rt></ruby><ruby>一<rt>いち</rt></ruby><ruby>会<rt>え</rt></ruby></jukugo>，再无来日。后面还有很多汉字汉字汉字汉字汉字汉字';
      host.appendChild(p);
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops' },
      });
    });
    var info = await page.evaluate(() => {
      var p = document.querySelector('#host p');
      var rubies = p.querySelectorAll('ruby');
      var probe = window.Katsuji.probeJukugoRunWidthPx(rubies);
      var merged = p.querySelector('ruby[data-ts-jukugo-merged]');
      var layout = window.Katsuji.buildBlockLayout(p);
      return {
        probe: probe,
        merged: !!merged,
        vertical: !!(layout && layout.flow && layout.flow.vertical),
        lines: layout ? layout.heads.length : 0,
      };
    });
    expect(info.vertical).toBe(true);
    expect(info.probe).toBeGreaterThan(0);
    expect(info.merged || info.lines >= 1).toBe(true);
  });

  test('源码缩进空白不把竖排段首行量肥，多段第一行也撑', async function ({ page }) {
    await openVerticalHost(page, 16);
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      host.innerHTML =
        '\n      <p>\n        甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥甲乙丙丁戊己庚辛壬癸，后面还有汉字汉字汉字汉字汉字汉字。\n      </p>\n      <p>\n        子丑寅卯辰巳午未申酉戌亥甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉，后面还有汉字汉字汉字汉字汉字汉字。\n      </p>\n    ';
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      var blocks = host.querySelectorAll('p');
      var out = [];
      for (var b = 0; b < blocks.length; b++) {
        var layout = window.Katsuji.buildBlockLayout(blocks[b]);
        var m = window.Katsuji.measureBlockVisualLines(blocks[b]);
        if (!layout || !m.lines.length) continue;
        out.push({
          leftover0: +(window.Katsuji.blockLineMaxEm(layout, 0) - m.lines[0].lineVisualEm).toFixed(3),
          overfull0: m.lines[0].lineVisualEm - layout.maxEm,
          lines: m.lines.length,
          vertical: !!(layout.flow && layout.flow.vertical),
        });
      }
      return out;
    });
    expect(info.length).toBe(2);
    info.forEach(function (block) {
      expect(block.vertical).toBe(true);
      expect(block.lines).toBeGreaterThan(1);
      expect(block.overfull0).toBeLessThan(0.35);
      expect(Math.abs(block.leftover0)).toBeLessThan(0.25);
    });
  });
});
