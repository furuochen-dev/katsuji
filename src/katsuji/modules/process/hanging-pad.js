/** 2′：在块现有 padding 上再加 0.5em 当悬挂沟 */
import { win } from '../env.js';
import { hangingPadPlan, nextHangPadEm } from './typeset-rules.js';

function addPad(block, styleKey, dataKey) {
  var inline = block.style[styleKey];
  block.setAttribute(dataKey, inline === '' || inline == null ? '__none__' : inline);
  var emPx = 16;
  var curPx = 0;
  if (win && win.getComputedStyle) {
    var cs = win.getComputedStyle(block);
    emPx = parseFloat(cs.fontSize) || 16;
    curPx = parseFloat(cs[styleKey]) || 0;
  }
  block.style[styleKey] = nextHangPadEm(curPx / emPx) + 'em';
}

function restorePad(block, styleKey, dataKey) {
  var prev = block.getAttribute(dataKey);
  block.removeAttribute(dataKey);
  if (prev == null || prev === '__none__') {
    block.style[styleKey] = '';
    return;
  }
  block.style[styleKey] = prev;
}

export function clearHangGutter(block) {
  if (!block || !block.getAttribute) return;
  var sides = block.getAttribute('data-ts-hang-pad');
  if (!sides) return;
  if (sides === 'right' || sides === 'both') {
    restorePad(block, 'paddingRight', 'data-ts-hang-pad-right');
  }
  if (sides === 'left' || sides === 'both') {
    restorePad(block, 'paddingLeft', 'data-ts-hang-pad-left');
  }
  block.removeAttribute('data-ts-hang-pad');
}

/** 2′ 造成的假剩余：左右都加后内容盒已是正文框；只加一侧再扣 0.5 */
export function hangPadEmFromBlock(block) {
  var sides = block && block.getAttribute && block.getAttribute('data-ts-hang-pad');
  if (sides === 'left' || sides === 'right') return 0.5;
  return 0;
}

export function applyHangGutter(block, hangingPunctuation) {
  clearHangGutter(block);
  var plan = hangingPadPlan(hangingPunctuation);
  if (!plan.left && !plan.right) return;
  if (plan.right) addPad(block, 'paddingRight', 'data-ts-hang-pad-right');
  if (plan.left) addPad(block, 'paddingLeft', 'data-ts-hang-pad-left');
  block.setAttribute('data-ts-hang-pad', plan.left && plan.right ? 'both' : plan.left ? 'left' : 'right');
}
