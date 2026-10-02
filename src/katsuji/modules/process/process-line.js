/** 一行：第 3 步 → 第 4 步 → 第 5 步（含 5′） */
import { buildBlockLayout, charItemRubyEl } from '../measure/line-width.js';
import { isParagraphLastLine } from '../measure/paragraph-items.js';
import { mergeJukugoOnLine } from '../core/jukugo.js';
import { applyLineEndOnLine, snapshotLinePair, fillLineLeftover, restoreDisplacedHangs } from './line-end.js';
import { hangConfig } from '../core/config.js';
import { trySpaceOnEdgeStart } from './postprocess/space-on-edge.js';
import { glueTwoEmKeepPairs, applyComboSymbolsOnLine } from './preprocess/combo.js';
import { lineStepPlan, resolveHangingPunctuation } from './typeset-rules.js';
import { punctHit } from './postprocess/edge-shared.js';
import { applyPunctForElement } from '../core/punct-config.js';

function collectGapsFromParts(parts) {
  var gaps = [];
  var seen = [];
  for (var i = 0; i < parts.length; i++) {
    var gs = parts[i].gaps || [];
    for (var g = 0; g < gs.length; g++) {
      if (seen.indexOf(gs[g]) >= 0) continue;
      seen.push(gs[g]);
      gaps.push(gs[g]);
    }
  }
  return gaps;
}

function lineHit(L, parts, charEl) {
  var usedPush = false;
  var branch = null;
  var em = null;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].usedPushFallback) usedPush = true;
    if (parts[i].branch) branch = parts[i].branch;
    if (parts[i].em) em = parts[i].em;
  }
  return {
    kind: 'line',
    lineIndex: L,
    gaps: collectGapsFromParts(parts),
    parts: parts,
    charEl: charEl,
    usedPushFallback: usedPush,
    branch: branch,
    em: em,
    noop: parts.length === 0,
  };
}

function frozenCountsForLine(hint, L) {
  if (!hint || !hint.headCharCounts || L < 0) return [];
  if (hint.headCharCounts.length >= L + 1) return hint.headCharCounts.slice(0, L + 1);
  return hint.headCharCounts.slice();
}

export function processLine(block, L, hangOpts, layoutHint) {
  hangOpts = hangOpts || hangConfig;
  applyPunctForElement(block);
  var hp = resolveHangingPunctuation(hangOpts.hangingPunctuation);
  var frozen = frozenCountsForLine(layoutHint, L);
  var metrics = layoutHint && layoutHint.metrics ? layoutHint.metrics : null;

  function relayout() {
    var next = buildBlockLayout(block, {
      frozenHeadCharCounts: frozen,
      emPx: metrics && metrics.emPx,
      maxPx: metrics && metrics.maxPx,
      indentEm: metrics && metrics.indentEm,
      hangPadEm: metrics && metrics.hangPadEm,
      vertical: metrics && metrics.vertical,
      flow: metrics && metrics.flow,
    });
    if (next && !metrics) {
      metrics = {
        emPx: next.emPx,
        maxPx: next.maxPx,
        indentEm: next.indentEm,
        hangPadEm: next.hangPadEm,
        vertical: next.flow && next.flow.vertical,
        flow: next.flow,
      };
    }
    if (next && (!frozen || frozen.length < L + 1) && next.headCharCounts) {
      frozen = next.headCharCounts.slice(0, L + 1);
    }
    return next;
  }

  function finish(parts, charEl) {
    var hit = lineHit(L, parts, charEl);
    if (layout && layout.headCharCounts) hit.headCharCounts = layout.headCharCounts;
    if (metrics) hit.metrics = metrics;
    return hit;
  }

  var layout = relayout();
  if (!layout || L < 0 || L >= layout.heads.length) return null;
  var plan = lineStepPlan(L, layout.heads.length, hp);
  var parts = [];
  var charEl = null;

  if (plan.step3) {
    var s3 = trySpaceOnEdgeStart(layout, L, hp);
    if (s3) {
      parts.push(s3);
      if (s3.charEl) charEl = s3.charEl;
      layout = relayout();
      if (!layout || L >= layout.heads.length) return finish(parts, charEl);
    }
  }

  var preCombo = null;
  if (plan.step4) {
    if (glueTwoEmKeepPairs(block)) layout = relayout() || layout;
    if (layout && L + 1 < layout.heads.length) preCombo = snapshotLinePair(layout, L);
    var comboPass = 0;
    while (comboPass++ < 8) {
      if (!layout || L >= layout.heads.length) break;
      var comboGaps = applyComboSymbolsOnLine(layout, L);
      if (!comboGaps.length) break;
      parts.push(punctHit('combo', L, comboGaps, { count: comboGaps.length }));
      layout = relayout() || layout;
    }
  }

  if (plan.step5) {
    if (layout && L + 1 < layout.heads.length) {
      var s5 = applyLineEndOnLine(layout, L, hangOpts, preCombo);
      if (s5) {
        parts.push(s5);
        if (s5.charEl) charEl = s5.charEl;
        layout = relayout();
        if (!s5.usedPushFallback && layout && L < layout.heads.length) {
          var more = applyComboSymbolsOnLine(layout, L);
          if (more.length) {
            parts.push(punctHit('combo', L, more, { count: more.length, afterPull: true }));
            layout = relayout() || layout;
          }
        }
      }
    }
    if (layout && L < layout.heads.length && !isParagraphLastLine(layout, L)) {
      var merged = mergeJukugoOnLine(layout, L, hangOpts, charItemRubyEl);
      if (merged) {
        if (block) void block.offsetHeight;
        layout = relayout() || layout;
        fillLineLeftover(layout, L, null);
      }
    }
  }

  if (restoreDisplacedHangs(block, frozen)) layout = relayout() || layout;
  return finish(parts, charEl);
}
