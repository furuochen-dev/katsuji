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

var JUKUGO_DEMO_P =
  '会上先把本日议程念完，后排才轮到注音。有人摊开茶书，说座上不是把四个字当口号，而是「今日之会，<jukugo><ruby>一<rt>いち</rt></ruby><ruby>期<rt>ご</rt></ruby><ruby>一<rt>いち</rt></ruby><ruby>会<rt>え</rt></ruby></jukugo>，再无来日。」书记照录，又从佛典抄了<jukugo><ruby>諸<rt>しょ</rt></ruby><ruby>行<rt>ぎょう</rt></ruby><ruby>無<rt>む</rt></ruby><ruby>常<rt>じょう</rt></ruby></jukugo>，嘱咐四字按一字一音标、走到行尾仍可从字间折开。主席听完：「<jukugo><ruby>承<rt>うけたまわ</rt></ruby><ruby>知<rt>し</rt></ruby></jukugo>了，按这个进纪要。」后排有人反问：手写的<ruby jukugo>自<rt>じ</rt>画<rt>が</rt>自<rt>じ</rt>賛<rt>さん</rt></ruby>怎么收？旁边那颗<ruby jukugo>一<rt>いっ</rt>石<rt>せき</rt>二<rt>に</rt>鳥<rt>ちょう</rt></ruby>呢？争论未决，走廊里还能听见：「<jukugo><ruby>四<rt>し</rt></ruby><ruby>面<rt>めん</rt></ruby><ruby>楚<rt>そ</rt></ruby><ruby>歌<rt>か</rt></ruby></jukugo>……不是四个口号。」散会时已近黄昏，有人把这几条又默了一遍，生怕窄栏从熟语中间劈开时注音对不上底。';

function jukugoLines(page) {
  return page.evaluate(() => {
    var host = document.getElementById('host');
    var p = host.querySelector('p');
    window.Katsuji.apply(host);
    window.Katsuji.applyHangAvoidance(host);
    var layout = window.Katsuji.buildBlockLayout(p);
    var m = window.Katsuji.measureBlockVisualLines(p);
    var lines = [];
    for (var L = 0; L < layout.heads.length; L++) {
      var range = window.Katsuji.lineItemBounds(layout.items, layout.heads, L);
      var rubies = [];
      var seen = [];
      for (var i = range.startIndex; i <= range.endIndex && i < layout.items.length; i++) {
        var it = layout.items[i];
        if (it.type !== 'char' || !it.node || !it.node.parentElement) continue;
        var ruby = it.node.parentElement.closest ? it.node.parentElement.closest('ruby') : null;
        if (!ruby || seen.indexOf(ruby) >= 0) continue;
        seen.push(ruby);
        var rt = ruby.querySelector('rt');
        rubies.push({
          merged: ruby.getAttribute('data-ts-jukugo-merged') === '1',
          base: ruby.childNodes[0] ? ruby.childNodes[0].textContent : '',
          reading: rt ? rt.textContent : '',
          align: getComputedStyle(ruby).rubyAlign,
        });
      }
      lines.push({
        last: L === layout.heads.length - 1,
        text: ((m.lines[L] && m.lines[L].text) || '').replace(/\s+/g, ''),
        rubies: rubies,
        bases: rubies
          .map(function (r) {
            return r.base;
          })
          .join(''),
        readings: rubies
          .map(function (r) {
            return r.reading;
          })
          .join(''),
      });
    }
    return lines;
  });
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

test.describe('Ruby 熟语', function () {
  test('分行：一字一 ruby 可从字间折，各行只合成本行那截', async function ({ page }) {
    await openHost(page, 6);
    await setHtml(
      page,
      '甲乙丙<jukugo><ruby>諸<rt>しょ</rt></ruby><ruby>行<rt>ぎょう</rt></ruby><ruby>無<rt>む</rt></ruby><ruby>常<rt>じょう</rt></ruby></jukugo>丁戊己庚辛壬癸子丑寅卯',
    );
    var lines = await jukugoLines(page);
    var hit = lines.filter(function (l) {
      return l.bases;
    });
    expect(hit.length).toBeGreaterThanOrEqual(2);
    expect(
      hit
        .map(function (l) {
          return l.bases;
        })
        .join(''),
    ).toBe('諸行無常');
    expect(
      hit
        .map(function (l) {
          return l.readings;
        })
        .join(''),
    ).toBe('しょぎょうむじょう');
    var lineOf = function (ch) {
      return hit.findIndex(function (l) {
        return l.bases.indexOf(ch) >= 0;
      });
    };
    expect(lineOf('諸')).toBeGreaterThanOrEqual(0);
    expect(lineOf('常')).toBeGreaterThanOrEqual(0);
    expect(lineOf('諸')).not.toBe(lineOf('常'));
    hit.forEach(function (l) {
      if (l.last) return;
      l.rubies.forEach(function (r) {
        if (r.base.length < 2) return;
        expect(r.merged).toBe(true);
        expect(r.reading.length).toBeGreaterThan(1);
        expect(r.align).toBe('space-around');
      });
    });
  });

  test('分行：手写 B 不能拆成多颗 ruby', async function ({ page }) {
    await openHost(page, 6);
    await setHtml(
      page,
      '甲乙丙<ruby jukugo>諸<rt>しょ</rt>行<rt>ぎょう</rt>無<rt>む</rt>常<rt>じょう</rt></ruby>丁戊己庚辛壬癸子丑寅卯',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      return p.querySelectorAll('ruby').length;
    });
    expect(info).toBe(1);
  });

  test('jukugo 里一字一 ruby：合成 C，底合一音合一，盒小于两颗之和', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(
      page,
      '甲<jukugo><ruby>承<rt>うけたまわ</rt></ruby><ruby>知<rt>し</rt></ruby></jukugo>乙后面再写许多汉字用来折到下一行，保证熟语不在段末行。后面还有字字字字字字字字字字。',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      var rubies = p.querySelectorAll('ruby');
      var em = parseFloat(getComputedStyle(p).fontSize) || 16;
      var liveSum = 0;
      for (var i = 0; i < rubies.length; i++) liveSum += rubies[i].getBoundingClientRect().width;
      var probe = window.Katsuji.probeJukugoRunWidthPx(Array.prototype.slice.call(rubies));
      window.Katsuji.applyHangAvoidance(host);
      window.Katsuji.applyHangAvoidance(host);
      var afterReset = 0;
      window.Katsuji.resetHangAdjustments(host);
      afterReset = p.querySelectorAll('ruby').length;
      window.Katsuji.applyHangAvoidance(host);
      var merged = p.querySelector('ruby[jukugo], ruby[data-ts-jukugo-merged]');
      var layout = window.Katsuji.buildBlockLayout(p);
      var r0 = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var m0 = window.Katsuji.measureLineVisualMetricsPx(p, layout.items, r0.startIndex, r0.endIndex);
      var plainPx = 0;
      for (var k = r0.startIndex; k <= r0.endIndex && k < layout.items.length; k++) {
        var it = layout.items[k];
        if (it.type !== 'char' || !it.node) continue;
        if (merged && merged.contains(it.node)) continue;
        var range = document.createRange();
        range.setStart(it.node, it.offset);
        range.setEnd(it.node, it.offset + 1);
        plainPx += range.getBoundingClientRect().width;
      }
      var rt = merged && merged.querySelector('rt');
      return {
        rubyCount: p.querySelectorAll('ruby').length,
        afterReset: afterReset,
        merged: !!(merged && merged.getAttribute('data-ts-jukugo-merged') === '1'),
        rts: merged ? merged.querySelectorAll('rt').length : 0,
        base: merged ? merged.childNodes[0] && merged.childNodes[0].textContent : '',
        reading: rt ? rt.textContent : '',
        liveSumEm: +(liveSum / em).toFixed(3),
        probeEm: +(probe / em).toFixed(3),
        heEm: +(m0.lineWidthPx / layout.emPx).toFixed(3),
        boxEm: merged ? +(merged.getBoundingClientRect().width / em).toFixed(3) : 0,
        plainEm: +(plainPx / em).toFixed(3),
      };
    });
    expect(info.rubyCount).toBe(1);
    expect(info.afterReset).toBe(2);
    expect(info.merged).toBe(true);
    expect(info.rts).toBe(1);
    expect(info.base).toBe('承知');
    expect(info.reading).toBe('うけたまわし');
    expect(info.probeEm).toBeCloseTo(info.boxEm, 1);
    expect(info.boxEm).toBeLessThan(info.liveSumEm);
  });

  test('手写 ruby jukugo：也收成一条底、一条 rt', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(
      page,
      '甲<ruby jukugo>承<rt>うけたまわ</rt>知<rt>し</rt></ruby>乙后面再写许多汉字用来折到下一行，保证熟语不在段末行。后面还有字字字字字字字字字字。',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      var ruby = p.querySelector('ruby');
      var rt = ruby && ruby.querySelector('rt');
      return {
        count: p.querySelectorAll('ruby').length,
        merged: ruby && ruby.getAttribute('data-ts-jukugo-merged') === '1',
        rts: ruby ? ruby.querySelectorAll('rt').length : 0,
        base: ruby && ruby.childNodes[0] ? ruby.childNodes[0].textContent : '',
        reading: rt ? rt.textContent : '',
        hasAttr: ruby ? ruby.hasAttribute('jukugo') : false,
      };
    });
    expect(info.count).toBe(1);
    expect(info.merged).toBe(true);
    expect(info.rts).toBe(1);
    expect(info.base).toBe('承知');
    expect(info.reading).toBe('うけたまわし');
    expect(info.hasAttr).toBe(true);
  });

  test('抽下一颗同段 A：基数是增量，不是下一颗自己的盒', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(
      page,
      '<jukugo><ruby>漢<rt>かんかんかん</rt></ruby><ruby>字<rt>じ</rt></ruby></jukugo>',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      var rubies = Array.prototype.slice.call(p.querySelectorAll('ruby'));
      var em = parseFloat(getComputedStyle(p).fontSize) || 16;
      var w0 = window.Katsuji.probeJukugoRunWidthPx([rubies[0]]);
      var w1 = rubies[1].getBoundingClientRect().width;
      var wAll = window.Katsuji.probeJukugoRunWidthPx(rubies);
      var layout = window.Katsuji.buildBlockLayout(p);
      var r0 = window.Katsuji.lineItemBounds(layout.items, layout.heads, 0);
      var m0 = window.Katsuji.measureLineVisualMetricsPx(p, layout.items, r0.startIndex, r0.endIndex);
      return {
        deltaEm: +((wAll - w0) / em).toFixed(3),
        ownEm: +(w1 / em).toFixed(3),
        allEm: +(wAll / em).toFixed(3),
        prefixEm: +(w0 / em).toFixed(3),
        liveSumEm: +((w0 + w1) / em).toFixed(3),
        heEm: +(m0.lineWidthPx / layout.emPx).toFixed(3),
      };
    });
    expect(info.deltaEm).toBeGreaterThan(0);
    expect(info.allEm).toBeCloseTo(info.prefixEm + info.deltaEm, 1);
    expect(info.heEm).toBeCloseTo(info.allEm, 1);
    expect(info.heEm).toBeLessThan(info.liveSumEm);
    expect(Math.abs(info.deltaEm - info.ownEm)).toBeGreaterThan(0.05);
  });

  test('探针量合成盒时不改正文 ruby', async function ({ page }) {
    await openHost(page, 24);
    await setHtml(
      page,
      '甲<jukugo><ruby>承<rt>うけたまわ</rt></ruby><ruby>知<rt>し</rt></ruby></jukugo>乙',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      var before = p.querySelectorAll('ruby').length;
      var html = p.innerHTML;
      var rubies = Array.prototype.slice.call(p.querySelectorAll('ruby'));
      var w = window.Katsuji.probeJukugoRunWidthPx(rubies);
      return {
        before: before,
        after: p.querySelectorAll('ruby').length,
        sameHtml: p.innerHTML === html,
        probe: w,
        merged: p.querySelectorAll('ruby[data-ts-jukugo-merged]').length,
      };
    });
    expect(info.after).toBe(info.before);
    expect(info.sameHtml).toBe(true);
    expect(info.merged).toBe(0);
    expect(info.probe).toBeGreaterThan(0);
  });

  test('单行段是段末行：四字不合成', async function ({ page }) {
    await openHost(page, 40);
    await setHtml(
      page,
      '<jukugo><ruby>一<rt>いち</rt></ruby><ruby>期<rt>ご</rt></ruby><ruby>一<rt>いち</rt></ruby><ruby>会<rt>え</rt></ruby></jukugo>',
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host);
      var rubies = p.querySelectorAll('ruby');
      return {
        count: rubies.length,
        merged: p.querySelectorAll('ruby[data-ts-jukugo-merged]').length,
      };
    });
    expect(info.count).toBe(4);
    expect(info.merged).toBe(0);
  });

  test('29em 句读悬挂：合成后非段末行剩余摊掉', async function ({ page }) {
    await openHost(page, 29);
    await setHtml(
      page,
      JUKUGO_DEMO_P,
    );
    var leftover = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops', hangLeftIndent: true, hangLeft: false },
      });
      var layout = window.Katsuji.buildBlockLayout(p);
      var m = window.Katsuji.measureBlockVisualLines(p);
      if (!layout || !m.lines || m.lines.length < 2) return { leftover: 0, lines: m.lines && m.lines.length };
      var max0 = window.Katsuji.blockLineMaxEm(layout, 0);
      return {
        leftover: +(max0 - m.lines[0].lineVisualEm).toFixed(3),
        he: +m.lines[0].lineVisualEm.toFixed(3),
        max: +max0.toFixed(3),
        lines: m.lines.length,
      };
    });
    expect(leftover.lines).toBeGreaterThan(1);
    expect(leftover.leftover).toBeLessThan(0.35);
  });

  test('27em 句读悬挂：段末行合成后仍保持短', async function ({ page }) {
    await openHost(page, 27);
    await setHtml(
      page,
      JUKUGO_DEMO_P,
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops', hangLeftIndent: true, hangLeft: false },
      });
      var layout = window.Katsuji.buildBlockLayout(p);
      var m = window.Katsuji.measureBlockVisualLines(p);
      if (!layout || !m.lines || m.lines.length < 2) {
        return { leftover0: 0, leftoverLast: 0, lines: m.lines && m.lines.length };
      }
      var last = m.lines.length - 1;
      return {
        leftover0: +(layout && window.Katsuji.blockLineMaxEm(layout, 0) - m.lines[0].lineVisualEm).toFixed(3),
        leftoverLast: +(window.Katsuji.blockLineMaxEm(layout, last) - m.lines[last].lineVisualEm).toFixed(3),
        lines: m.lines.length,
      };
    });
    expect(info.lines).toBeGreaterThan(1);
    expect(info.leftover0).toBeLessThan(0.35);
    expect(info.leftoverLast).toBeGreaterThan(2);
  });

  test('18em 句读悬挂：行尾挂出的顿号折到下行时拆掉', async function ({ page }) {
    await openHost(page, 18);
    await setHtml(
      page,
      JUKUGO_DEMO_P,
    );
    var info = await page.evaluate(() => {
      var host = document.getElementById('host');
      var p = host.querySelector('p');
      window.Katsuji.apply(host);
      window.Katsuji.applyHangAvoidance(host, {
        hangingPunctuation: { hangRight: 'stops', hangLeftIndent: true, hangLeft: false },
      });
      var hung = p.querySelectorAll('[data-ts-hang-end="1"]');
      var displaced = [];
      for (var i = 0; i < hung.length; i++) {
        var span = hung[i];
        var r = span.getBoundingClientRect();
        var n = span.nextSibling;
        while (n && ((n.nodeType === 3 && !String(n.nodeValue).replace(/\s/g, '')) || (n.nodeType === 1 && n.classList && n.classList.contains('ts-gap')))) {
          n = n.nextSibling;
        }
        if (!n || n.nodeType === 3 && !n.nodeValue) continue;
        var nr = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
        if (nr && Math.abs(nr.top - r.top) < 6) displaced.push(span.textContent);
      }
      return { displaced: displaced, hung: hung.length };
    });
    expect(info.displaced).toEqual([]);
  });
});
