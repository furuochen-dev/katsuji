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

async function setHtml(page, html) {
  await page.evaluate((h) => {
    var host = document.getElementById('host');
    host.innerHTML = '';
    var p = document.createElement('p');
    p.innerHTML = h;
    host.appendChild(p);
  }, html);
}

function measureRubySample(page) {
  return page.evaluate(() => {
    var p = document.querySelector('#host p');
    var ruby = p.querySelector('ruby');
    var rt = ruby && ruby.querySelector('rt');
    var em = parseFloat(getComputedStyle(p).fontSize) || 16;
    var layout = window.Katsuji.buildBlockLayout(p);
    function charW(item) {
      var range = document.createRange();
      range.setStart(item.node, item.offset);
      range.setEnd(item.node, item.offset + 1);
      return range.getBoundingClientRect().width;
    }
    var baseW = 0;
    var baseChars = '';
    if (layout && ruby) {
      for (var i = 0; i < layout.items.length; i++) {
        var item = layout.items[i];
        if (item.type !== 'char' || !ruby.contains(item.node)) continue;
        baseChars += item.ch;
        baseW += charW(item);
      }
    }
    var r0 = layout && window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
    var m0 =
      r0 && window.Katsuji.measureLineVisualMetricsPx(p, layout.items, r0.startIndex, r0.endIndex);
    return {
      rt: rt ? rt.textContent : '',
      baseChars: baseChars,
      rubyEm: ruby ? +(ruby.getBoundingClientRect().width / em).toFixed(3) : 0,
      rtEm: rt ? +(rt.getBoundingClientRect().width / em).toFixed(3) : 0,
      baseEm: +(baseW / em).toFixed(3),
      heEm: m0 ? +(m0.lineWidthPx / layout.emPx).toFixed(3) : 0,
    };
  });
}

test.describe('Ruby 量宽和撑行', function () {
  test('短振り：かん 挤进 漢，合和 ruby 盒一样宽', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(page, '甲<ruby>漢<rt>かん</rt></ruby>乙');
    await page.evaluate(() => window.Katsuji.apply(document.getElementById('host')));
    var info = await measureRubySample(page);
    expect(info.baseChars).toBe('漢');
    expect(info.rubyEm).toBeCloseTo(1, 1);
    expect(info.baseEm).toBeCloseTo(info.rubyEm, 1);
    expect(info.heEm).toBeCloseTo(3, 1);
  });

  test('长注音：底的 char rect 比 ruby 盒肥，合跟盒走', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(page, '甲<ruby>漢<rt>かんかんかん</rt></ruby>乙');
    await page.evaluate(() => window.Katsuji.apply(document.getElementById('host')));
    var info = await measureRubySample(page);
    expect(info.baseChars).toBe('漢');
    expect(info.rubyEm).toBeGreaterThan(1.2);
    expect(info.baseEm).toBeGreaterThan(info.rubyEm + 0.15);
    expect(info.heEm).toBeCloseTo(2 + info.rubyEm, 1);
  });

  test('按簇量宽：8em 一行合按盒剩约半格', async function ({ page }) {
    await openHost(page, 8);
    await setHtml(
      page,
      '一二三四五<ruby>漢<rt>かんかんかん</rt></ruby>六七八九十abcdefghijabcdefghij',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      void host.offsetHeight;
      var layout = window.Katsuji.buildBlockLayout(p);
      var r0 = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var m0 = window.Katsuji.measureLineVisualMetricsPx(p, layout.items, r0.startIndex, r0.endIndex);
      var t0 = (m0.text || '').replace(/\s+/g, '');
      var t1 = window.Katsuji.lineCharsFromItems(
        layout.items,
        layout.heads[1],
        (layout.heads[2] != null ? layout.heads[2] : layout.items.length) - 1,
      ).text.replace(/\s+/g, '');
      var ruby = p.querySelector('ruby');
      var fs = parseFloat(getComputedStyle(p).fontSize) || 16;
      return {
        t0: t0,
        next: t1.charAt(0),
        leftoverHe: +(window.Katsuji.blockLineMaxEm(layout, 0) - m0.lineWidthPx / layout.emPx).toFixed(3),
        rubyEm: +(ruby.getBoundingClientRect().width / fs).toFixed(3),
        heEm: +(m0.lineWidthPx / layout.emPx).toFixed(3),
      };
    });
    expect(info.t0).toBe('一二三四五漢');
    expect(info.next).toBe('六');
    expect(info.heEm).toBeCloseTo(5 + info.rubyEm, 1);
    expect(info.leftoverHe).toBeGreaterThan(0.35);
    expect(info.leftoverHe).toBeLessThan(0.65);
  });

  test('行尾 。 下一字宽 ruby：基数按盒，句号挂出去', async function ({ page }) {
    await openHost(page, 10);
    await setHtml(
      page,
      '一二三四五六七八。<ruby>漢<rt>かんかんかん</rt></ruby>后续文字填满二三四五六七八九十',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops', hangLeftIndent: true, hangLeft: false },
      });
      var lines = window.Katsuji.measureBlockVisualLines(p).lines.map(function (line) {
        return (line.text || '').replace(/\s+/g, '');
      });
      var hung = p.querySelector('[data-ts-hang-end]');
      return {
        t0: lines[0] || '',
        t1: lines[1] || '',
        hungCh: hung ? hung.textContent : '',
        hangMr: hung ? hung.style.marginRight : '',
      };
    });
    expect(info.t0).toMatch(/。$/);
    expect(info.t1.charAt(0)).toBe('漢');
    expect(info.hungCh).toContain('。');
    expect(info.hangMr).toBe('-0.5em');
  });
});
