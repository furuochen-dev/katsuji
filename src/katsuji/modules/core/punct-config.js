/** @layer 0 标点分类配置与预设 */
import {
  DEFAULT_GAP_BEFORE,
  DEFAULT_GAP_NONE,
  DEFAULT_GAP_AFTER,
  CENTER_ALIGN_STOPS,
  CENTER_ALIGN_FIXED,
  DEFAULT_TWO_EM_KEEP,
  DEFAULT_NO_LINE_START,
  rebuildPunctSets,
} from '../text/punctuation-rules.js';
import { isVerticalWritingMode } from './flow.js';

function removeChars(str, toRemove) {
  var drop = Object.create(null);
  for (var i = 0; i < toRemove.length; i++) drop[toRemove.charAt(i)] = true;
  var out = '';
  for (var j = 0; j < str.length; j++) {
    var c = str.charAt(j);
    if (!drop[c]) out += c;
  }
  return out;
}

function appendUnique(base, extra) {
  var have = Object.create(null);
  var out = base || '';
  for (var i = 0; i < out.length; i++) have[out.charAt(i)] = true;
  var add = extra || '';
  for (var j = 0; j < add.length; j++) {
    var c = add.charAt(j);
    if (have[c]) continue;
    have[c] = true;
    out += c;
  }
  return out;
}

function onlyIn(str, allowed) {
  var out = '';
  var s = str || '';
  var allow = allowed || '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (allow.indexOf(c) >= 0) out += c;
  }
  return out;
}

export function resolvePunctStrings(cfg) {
  var gapBefore = DEFAULT_GAP_BEFORE;
  var gapNone = DEFAULT_GAP_NONE;
  var gapAfter = DEFAULT_GAP_AFTER;

  if (cfg.vertical) {
    gapAfter = removeChars(gapAfter, '？！');
    gapNone = appendUnique(gapNone, '？！');
    if (!cfg.rotateColon) {
      gapAfter = removeChars(gapAfter, '：；');
      gapNone = appendUnique(gapNone, '：；');
    }
  }

  if (cfg.gapBefore != null) gapBefore = cfg.gapBefore;
  if (cfg.gapNone != null) gapNone = cfg.gapNone;
  if (cfg.gapAfter != null) gapAfter = cfg.gapAfter;

  var centerStops = '';
  var centerFixed = '';
  if (cfg.punctAlign === 'center') {
    centerStops = onlyIn(CENTER_ALIGN_STOPS, gapAfter);
    centerFixed = onlyIn(CENTER_ALIGN_FIXED, gapAfter);
  }

  return {
    gapBefore: gapBefore,
    gapNone: gapNone,
    gapAfter: gapAfter,
    centerStops: centerStops,
    centerFixed: centerFixed,
    twoEmKeep: DEFAULT_TWO_EM_KEEP,
    noLineStart: cfg.jisStrict ? DEFAULT_NO_LINE_START : '',
  };
}

export const punctConfig = {
  jisStrict: false,
  vertical: false,
  rotateColon: false,
  punctAlign: 'corner',
  comboCenterPunct: true,
  gapBefore: null,
  gapNone: null,
  gapAfter: null,
};

function applyResolvedFrom(cfg) {
  var s = resolvePunctStrings(cfg);
  rebuildPunctSets(s.gapBefore, s.gapNone, s.gapAfter, s.centerStops, s.centerFixed, s.twoEmKeep, s.noLineStart);
}

function applyResolvedPunct() {
  applyResolvedFrom(punctConfig);
}

/** 按块 writing-mode 叠问叹。rotateColon：日标转 90° 则：；留后有空；默认国标竖直，：；两侧无空。 */
export function applyPunctForElement(el) {
  applyResolvedFrom({
    jisStrict: punctConfig.jisStrict,
    vertical: !!(punctConfig.vertical || isVerticalWritingMode(el)),
    rotateColon: punctConfig.rotateColon,
    punctAlign: punctConfig.punctAlign,
    comboCenterPunct: punctConfig.comboCenterPunct,
    gapBefore: punctConfig.gapBefore,
    gapNone: punctConfig.gapNone,
    gapAfter: punctConfig.gapAfter,
  });
}

export function mergePunctConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return punctConfig;
  if (overrides.jisStrict != null) punctConfig.jisStrict = !!overrides.jisStrict;
  if (overrides.vertical != null) punctConfig.vertical = !!overrides.vertical;
  if (overrides.rotateColon != null) punctConfig.rotateColon = !!overrides.rotateColon;
  if (overrides.punctAlign === 'center' || overrides.punctAlign === 'corner') {
    punctConfig.punctAlign = overrides.punctAlign;
  }
  if (overrides.comboCenterPunct != null) punctConfig.comboCenterPunct = !!overrides.comboCenterPunct;
  if (overrides.gapBefore !== undefined) punctConfig.gapBefore = overrides.gapBefore;
  if (overrides.gapNone !== undefined) punctConfig.gapNone = overrides.gapNone;
  if (overrides.gapAfter !== undefined) punctConfig.gapAfter = overrides.gapAfter;
  applyResolvedPunct();
  return punctConfig;
}

/** @param {'default'|'jis-strict'|'vertical'} name */
export function applyPunctPreset(name) {
  if (name === 'default') {
    return mergePunctConfig({
      jisStrict: false,
      vertical: false,
      rotateColon: false,
      punctAlign: 'corner',
      comboCenterPunct: true,
      gapBefore: null,
      gapNone: null,
      gapAfter: null,
    });
  }
  if (name === 'jis-strict') {
    return mergePunctConfig({ jisStrict: true });
  }
  if (name === 'vertical') {
    return mergePunctConfig({ vertical: true });
  }
  return punctConfig;
}

export function restorePunctFromConfig() {
  applyResolvedPunct();
}

applyResolvedPunct();
