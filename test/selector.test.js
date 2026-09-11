import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideHangStrategy,
  hangShareEm,
  hangAmountsEm,
  PULL_MAX_EM,
  PULL_MAX_SLACK_EM,
} from '../src/katsuji/modules/process/typeset-rules.js';
import { defaultStrategyDecider } from '../src/katsuji/modules/measure/line-width.js';

describe('selector', function () {
  it('压入量 ≤ 0 仍压入；> 0 须有缝且不超过 0.5em（允许多 0.01）', function () {
    assert.equal(decideHangStrategy(0.5, 1, 0.8, 1), 'pull');
    assert.equal(decideHangStrategy(0.51, 1, 0.8, 1), 'pull');
    assert.equal(decideHangStrategy(0.52, 1, 0.8, 1), 'push');
    assert.equal(decideHangStrategy(0, 1, 0.3, 1), 'pull');
    assert.equal(decideHangStrategy(-0.1, 1, 0.3, 1), 'pull');
    assert.equal(decideHangStrategy(-0.2, 0, 0.3, 0), 'pull');
    assert.equal(decideHangStrategy(0.2, 0, 0.3, 0), 'none');
    assert.equal(PULL_MAX_EM + PULL_MAX_SLACK_EM, 0.51);
  });

  it('没有推出就跳过：压入超上限且无推缝', function () {
    assert.equal(decideHangStrategy(0.8, 1, 0.3, 0), 'none');
    assert.equal(decideHangStrategy(0.8, 0, 0.3, 0), 'none');
  });

  it('挤还是推看每条缝摊到的绝对值，差不多时默认挤', function () {
    assert.equal(decideHangStrategy(0.4, 1, 0.2, 1), 'push');
    assert.equal(decideHangStrategy(0.2, 2, 0.3, 1), 'pull');
    assert.equal(decideHangStrategy(0.3, 1, 0.3, 1), 'pull');
    assert.equal(decideHangStrategy(0.3, 1, 0.3, 1, 'push'), 'push');
  });

  it('压入量 ≤ 0 仍压入、可调缝不抽；推出量不是正数或每条缝不到 0.01em 当没这回事', function () {
    assert.equal(hangShareEm('pull', 0, 0.3, 1, 1), 0);
    assert.equal(hangShareEm('pull', -0.2, 0.3, 0, 0), 0);
    assert.equal(hangShareEm('push', 0.2, 0, 1, 1), null);
    assert.equal(hangShareEm('none', 0.2, 0.3, 1, 1), null);
    assert.ok(hangShareEm('pull', 0.4, 0.3, 1, 1) < 0);
    assert.ok(hangShareEm('push', 0.2, 0.4, 1, 1) > 0);
    assert.equal(hangShareEm('pull', 0.02, 0.3, 4, 1), null);
  });

  it('和 hangMargin 里的 defaultStrategyDecider 同一套上限', function () {
    var decide = defaultStrategyDecider('pull');
    assert.equal(decide(0.5, 1, 0.8, 1), 'pull');
    assert.equal(decide(0.52, 1, 0.8, 1), 'push');
    assert.equal(decide(0.3, 1, 0.3, 1), 'pull');
  });

  it('撑行：差 0.4em 抽整字改推，推出量 = 行宽−合', function () {
    var amt = hangAmountsEm(7.6, 8, 1, 0);
    assert.equal(decideHangStrategy(amt.pullAmountEm, 2, amt.pushAmountEm, 2), 'push');
    assert.ok(Math.abs(amt.pushAmountEm - 0.4) < 1e-9);
  });
});
