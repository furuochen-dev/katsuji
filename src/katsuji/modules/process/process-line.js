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

export function processLine(block, L, hangOpts) {
  hangOpts = hangOpts || hangConfig;
  var hp = resolveHangingPunctuation(hangOpts.hangingPunctuation);
  var layout = buildBlockLayout(block);
  if (!layout || L < 0 || L >= layout.heads.length) return null;
  var plan = lineStepPlan(L, layout.heads.length, hp);
  var parts = [];
  var charEl = null;

  if (plan.step3) {
    var s3 = trySpaceOnEdgeStart(layout, L, hp);
    if (s3) {
      parts.push(s3);
      if (s3.charEl) charEl = s3.charEl;
      layout = buildBlockLayout(block);
      if (!layout || L >= layout.heads.length) return lineHit(L, parts, charEl);
    }
  }

  var preCombo = null;
  if (plan.step4) {
    glueTwoEmKeepPairs(block);
    layout = buildBlockLayout(block) || layout;
    if (layout && L + 1 < layout.heads.length) preCombo = snapshotLinePair(layout, L);
    var comboPass = 0;
    while (comboPass++ < 8) {
      layout = buildBlockLayout(block) || layout;
      if (!layout || L >= layout.heads.length) break;
      var comboGaps = applyComboSymbolsOnLine(layout, L);
      if (!comboGaps.length) break;
      parts.push(punctHit('combo', L, comboGaps, { count: comboGaps.length }));
    }
  }

  if (plan.step5) {
    layout = buildBlockLayout(block);
    if (layout && L + 1 < layout.heads.length) {
      var s5 = applyLineEndOnLine(layout, L, hangOpts, preCombo);
      if (s5) {
        parts.push(s5);
        if (s5.charEl) charEl = s5.charEl;
        if (!s5.usedPushFallback) {
          layout = buildBlockLayout(block);
          if (layout && L < layout.heads.length) {
            var more = applyComboSymbolsOnLine(layout, L);
            if (more.length) {
              parts.push(punctHit('combo', L, more, { count: more.length, afterPull: true }));
            }
          }
        }
      }
    }
    layout = buildBlockLayout(block);
    if (layout && L < layout.heads.length && !isParagraphLastLine(layout, L)) {
      var merged = mergeJukugoOnLine(layout, L, hangOpts, charItemRubyEl);
      if (merged) {
        if (block) void block.offsetHeight;
        layout = buildBlockLayout(block) || layout;
        fillLineLeftover(layout, L, null);
      }
    }
  }

  restoreDisplacedHangs(block);
  return lineHit(L, parts, charEl);
}
