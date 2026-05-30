/** @layer 0 标点分类配置与预设 */
import {
  DEFAULT_GAP_BEFORE,
  DEFAULT_GAP_NONE,
  DEFAULT_GAP_AFTER,
  rebuildPunctSets,
} from '../text/punctuation-rules.js';

/** JIS 严格：叠字符号、假名叠字符号、小假名、片假名长音 → 3 类 */
var JIS_STRICT_GAP_NONE_ADD = '々〻ゝゞヽヾーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ';

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

  if (cfg.jisStrict) gapNone += JIS_STRICT_GAP_NONE_ADD;

  if (cfg.vertical) {
    gapAfter = removeChars(gapAfter, '？！');
    gapNone += '？！' + VERTICAL_GAP_NONE_ADD;
    gapBefore += VERTICAL_GAP_BEFORE_ADD;
    gapAfter += VERTICAL_GAP_AFTER_ADD;
  }

  if (cfg.gapBefore != null) gapBefore = cfg.gapBefore;
  if (cfg.gapNone != null) gapNone = cfg.gapNone;
  if (cfg.gapAfter != null) gapAfter = cfg.gapAfter;

  return { gapBefore: gapBefore, gapNone: gapNone, gapAfter: gapAfter };
}

export const punctConfig = {
  jisStrict: false,
  vertical: false,
  gapBefore: null,
  gapNone: null,
  gapAfter: null,
};

function applyResolvedPunct() {
  var s = resolvePunctStrings(punctConfig);
  rebuildPunctSets(s.gapBefore, s.gapNone, s.gapAfter);
}

export function mergePunctConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return punctConfig;
  if (overrides.jisStrict != null) punctConfig.jisStrict = !!overrides.jisStrict;
  if (overrides.vertical != null) punctConfig.vertical = !!overrides.vertical;
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
