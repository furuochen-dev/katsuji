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

/** 竖排国标九字 U+FE10–FE18（CJK 竖排标点形） */
var VERTICAL_GAP_AFTER_ADD = '\uFE10\uFE11\uFE12\uFE18';
var VERTICAL_GAP_BEFORE_ADD = '\uFE17';
var VERTICAL_GAP_NONE_ADD = '\uFE13\uFE14\uFE15\uFE16';

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

export function resolvePunctStrings(cfg) {
  var gapBefore = DEFAULT_GAP_BEFORE;
  var gapNone = DEFAULT_GAP_NONE;
  var gapAfter = DEFAULT_GAP_AFTER;

  if (cfg.vertical) {
    gapAfter = removeChars(gapAfter, '？！');
    gapNone += '？！' + VERTICAL_GAP_NONE_ADD;
    gapBefore += VERTICAL_GAP_BEFORE_ADD;
    gapAfter += VERTICAL_GAP_AFTER_ADD;
  }

  if (cfg.gapBefore != null) gapBefore = cfg.gapBefore;
  if (cfg.gapNone != null) gapNone = cfg.gapNone;
  if (cfg.gapAfter != null) gapAfter = cfg.gapAfter;

  var centerStops = cfg.punctAlign === 'center' ? CENTER_ALIGN_STOPS : '';
  var centerFixed = cfg.punctAlign === 'center' ? CENTER_ALIGN_FIXED : '';

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
  punctAlign: 'corner',
  gapBefore: null,
  gapNone: null,
  gapAfter: null,
};

function applyResolvedPunct() {
  var s = resolvePunctStrings(punctConfig);
  rebuildPunctSets(s.gapBefore, s.gapNone, s.gapAfter, s.centerStops, s.centerFixed, s.twoEmKeep, s.noLineStart);
}

export function mergePunctConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return punctConfig;
  if (overrides.jisStrict != null) punctConfig.jisStrict = !!overrides.jisStrict;
  if (overrides.vertical != null) punctConfig.vertical = !!overrides.vertical;
  if (overrides.punctAlign === 'center' || overrides.punctAlign === 'corner') {
    punctConfig.punctAlign = overrides.punctAlign;
  }
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
      punctAlign: 'corner',
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

applyResolvedPunct();
