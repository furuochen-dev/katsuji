import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lineStepPlan } from '../src/katsuji/modules/process/typeset-rules.js';

describe('一行上的步骤和跳过', function () {
  it('段首行不做第 3 步，仍做 4；不是末行就做 5', function () {
    assert.deepEqual(lineStepPlan(0, 3), { step3: false, step4: true, step5: true });
  });

  it('段末行不做第 5 步，仍做 3、4（若不是首行）', function () {
    assert.deepEqual(lineStepPlan(2, 3), { step3: true, step4: true, step5: false });
  });

  it('中间行 3、4、5 都做', function () {
    assert.deepEqual(lineStepPlan(1, 3), { step3: true, step4: true, step5: true });
  });

  it('只有一行：跳过 3 和 5，只做连写', function () {
    assert.deepEqual(lineStepPlan(0, 1), { step3: false, step4: true, step5: false });
  });

  it('两行：第一行 4+5，第二行 3+4', function () {
    assert.deepEqual(lineStepPlan(0, 2), { step3: false, step4: true, step5: true });
    assert.deepEqual(lineStepPlan(1, 2), { step3: true, step4: true, step5: false });
  });

  it('从前往后：第 5 步看的是还没处理的下一行', function () {
    var order = [];
    var n = 4;
    for (var L = 0; L < n; L++) {
      var plan = lineStepPlan(L, n);
      if (plan.step3) order.push('3@' + L);
      if (plan.step4) order.push('4@' + L);
      if (plan.step5) order.push('5@' + L);
    }
    assert.deepEqual(order, ['4@0', '5@0', '3@1', '4@1', '5@1', '3@2', '4@2', '5@2', '3@3', '4@3']);
  });
});
