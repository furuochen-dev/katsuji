/** 2′：在块现有 padding 上行头、行尾侧再加 0.5em 当悬挂沟 */
import { win } from '../env.js';
import { hangingPadPlan, nextHangPadEm } from './typeset-rules.js';

function addPad(block, cssProp, dataKey) {
  var inline = block.style.getPropertyValue(cssProp);
  block.setAttribute(dataKey, inline === '' || inline == null ? '__none__' : inline);
  var emPx = 16;
  var curPx = 0;
  if (win && win.getComputedStyle) {
    var cs = win.getComputedStyle(block);
    emPx = parseFloat(cs.fontSize) || 16;
    curPx = parseFloat(cs.getPropertyValue(cssProp)) || 0;
  }
  block.style.setProperty(cssProp, nextHangPadEm(curPx / emPx) + 'em');
}

function restorePad(block, cssProp, dataKey) {
  var prev = block.getAttribute(dataKey);
  if (prev == null) return;
  block.removeAttribute(dataKey);
  if (prev === '__none__') {
    block.style.removeProperty(cssProp);
    return;
  }
  block.style.setProperty(cssProp, prev);
}

export function clearHangGutter(block) {
  if (!block || !block.getAttribute) return;
  var sides = block.getAttribute('data-ts-hang-pad');
  if (!sides) return;
  restorePad(block, 'padding-inline-end', 'data-ts-hang-pad-end');
  restorePad(block, 'padding-inline-start', 'data-ts-hang-pad-start');
  restorePad(block, 'paddingRight', 'data-ts-hang-pad-right');
  restorePad(block, 'paddingLeft', 'data-ts-hang-pad-left');
  block.removeAttribute('data-ts-hang-pad');
}

/** 2′ 造成的假剩余：两侧都加后内容盒已是正文框；只加一侧再扣 0.5 */
export function hangPadEmFromBlock(block) {
  var sides = block && block.getAttribute && block.getAttribute('data-ts-hang-pad');
  if (sides === 'start' || sides === 'end' || sides === 'left' || sides === 'right') return 0.5;
  return 0;
}

export function applyHangGutter(block, hangingPunctuation) {
  clearHangGutter(block);
  var plan = hangingPadPlan(hangingPunctuation);
  if (!plan.start && !plan.end) return;
  if (plan.end) addPad(block, 'padding-inline-end', 'data-ts-hang-pad-end');
  if (plan.start) addPad(block, 'padding-inline-start', 'data-ts-hang-pad-start');
  block.setAttribute('data-ts-hang-pad', plan.start && plan.end ? 'both' : plan.start ? 'start' : 'end');
}
