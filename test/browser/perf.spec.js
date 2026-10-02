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

const DEMO_HTML = [
  '「请相信我，亲爱的先生：在大英帝国中，再也没有比我更衷心支持与母国联合的人了。」但以造物主之名，我宁愿死去，也不会接受如今英国议会所提之条件——那些条件既苛且乱：增税、驻军、封锁港口、禁止西迁……无一不是把殖民地当作附属。有人劝他：「何必如此决绝？」他答：「我相信这正是美洲的共同心声。」又补了一句：「若连这句话也不敢说，还谈什么自由？」',
  '（第三次联席会，含预算）议题有三项：「进度汇报、风险排查、以及下阶段计划（含印刷、纸张、装订）」。请准时参加！会上有人提起《红楼梦》，说它是一部奇书，而「脂砚斋」批语更让读者着迷：你怎么看？另有人反问：「批语是作者自拟，还是他人捉刀？」争论未决，主席只得敲槌：「先记下来，会后再议。」散会时已近黄昏，走廊里还能听见：「《石头记》……脂批……真伪……」',
  '《汉书》有云：「天下熙熙，皆为利来；天下攘攘，皆为利往。」这话放在今天，也并不过时。书店里摆着《史记》《汉书》《后汉书》，旁边却是翻译小说、旅行手册、食谱……收银处贴着告示：「满百减十；学生证再九折。」有个孩子问：「妈妈，『利』是什么？」母亲想了想：「就是你想要、又不肯放手的东西。」孩子「哦」了一声，又问：「那『往』呢？」',
].join('');

test.describe('性能探针', function () {
  test('demo 体量：apply / hang 耗时与量测次数', async function ({ page }) {
    await openHost(page);
    var info = await page.evaluate((html) => {
      var host = document.getElementById('host');
      host.style.width = '30em';
      host.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = html;
      host.appendChild(p);

      var counts = {
        rangeRect: 0,
        createRange: 0,
        elRect: 0,
        computed: 0,
      };
      var RangeProto = Range.prototype;
      var origRangeRect = RangeProto.getBoundingClientRect;
      RangeProto.getBoundingClientRect = function () {
        counts.rangeRect += 1;
        return origRangeRect.apply(this, arguments);
      };
      var origCreateRange = Document.prototype.createRange;
      Document.prototype.createRange = function () {
        counts.createRange += 1;
        return origCreateRange.apply(this, arguments);
      };
      var origElRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        counts.elRect += 1;
        return origElRect.apply(this, arguments);
      };
      var origCS = window.getComputedStyle;
      window.getComputedStyle = function () {
        counts.computed += 1;
        return origCS.apply(this, arguments);
      };

      function snap() {
        return {
          rangeRect: counts.rangeRect,
          createRange: counts.createRange,
          elRect: counts.elRect,
          computed: counts.computed,
        };
      }
      function delta(a, b) {
        var out = {};
        Object.keys(b).forEach(function (k) {
          out[k] = b[k] - a[k];
        });
        return out;
      }

      var t0 = performance.now();
      window.Katsuji.apply(host);
      var applyMs = performance.now() - t0;
      var afterApply = snap();

      var chars = window.Katsuji.flattenParagraph(p).filter(function (it) {
        return it.type === 'char';
      }).length;
      var gaps = p.querySelectorAll('span.ts-gap').length;

      var beforeHang = snap();
      var t1 = performance.now();
      window.Katsuji.applyHangAvoidance(host);
      var hangMs = performance.now() - t1;
      var hang = delta(beforeHang, snap());

      var layout = window.Katsuji.buildBlockLayout(p);
      var estLayouts = chars ? hang.rangeRect / chars : 0;
      return {
        chars: chars,
        gaps: gaps,
        lines: layout ? layout.heads.length : 0,
        applyMs: +applyMs.toFixed(1),
        hangMs: +hangMs.toFixed(1),
        apply: afterApply,
        hang: hang,
        estLayouts: +estLayouts.toFixed(1),
        estLayoutsPerLine: layout && layout.heads.length
          ? +(estLayouts / layout.heads.length).toFixed(1)
          : 0,
        rangePerChar: chars ? +(hang.rangeRect / chars).toFixed(1) : 0,
      };
    }, DEMO_HTML);

    console.log('KATSUJI_PERF', JSON.stringify(info, null, 2));
    expect(info.lines).toBeGreaterThan(1);
    expect(info.hang.rangeRect).toBeGreaterThan(info.chars);
    expect(info.hangMs).toBeGreaterThan(info.applyMs);
  });
});
