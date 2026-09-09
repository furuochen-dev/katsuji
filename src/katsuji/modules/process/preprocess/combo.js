/** 组合符号：固定 ts-gap margin，不参与后续可调空 */
import { defaultRoot, getDocument } from '../../env.js';
import { flattenParagraph } from '../../measure/paragraph-items.js';
import { punctGapClass } from '../../text/punctuation-rules.js';

function findPrevCharIndex(items, fromIdx) {
  for (var j = fromIdx - 1; j >= 0; j--) {
    if (items[j].type === 'char') return j;
  }
  return -1;
}

function findNextCharIndex(items, fromIdx) {
  for (var j = fromIdx + 1; j < items.length; j++) {
    if (items[j].type === 'char') return j;
  }
  return -1;
}

function wrapNoneRunSameNode(node, startOff, endOff) {
  var par = node.parentElement;
  if (par && par.getAttribute('data-ts-none-run') === '1') return;
  var tv = node.nodeValue;
  var doc = node.ownerDocument || getDocument(node);
  if (!doc || !tv || startOff > endOff) return;
  var span = doc.createElement('span');
  span.setAttribute('data-ts-none-run', '1');
  span.style.whiteSpace = 'nowrap';
  span.textContent = tv.slice(startOff, endOff + 1);
  var frag = doc.createDocumentFragment();
  if (startOff > 0) frag.appendChild(doc.createTextNode(tv.slice(0, startOff)));
  frag.appendChild(span);
  if (endOff + 1 < tv.length) frag.appendChild(doc.createTextNode(tv.slice(endOff + 1)));
  node.parentNode.replaceChild(frag, node);
}

/** 连续 `两侧无空`（如 ……）绑在一起，中间不折行 */
export function glueAdjacentNonePunct(block) {
  var items = flattenParagraph(block);
  var runs = [];
  var i = 0;
  while (i < items.length) {
    if (items[i].type !== 'char' || punctGapClass(items[i].ch) !== 'none') {
      i += 1;
      continue;
    }
    var start = i;
    i += 1;
    while (i < items.length && items[i].type === 'char' && punctGapClass(items[i].ch) === 'none') {
      i += 1;
    }
    if (i - start >= 2) runs.push({ start: start, end: i - 1 });
  }
  for (var r = runs.length - 1; r >= 0; r--) {
    var a = items[runs[r].start];
    var b = items[runs[r].end];
    if (!a || !b || a.node !== b.node) continue;
    wrapNoneRunSameNode(a.node, a.offset, b.offset);
  }
}

export function applyComboSymbolsBlock(block, limit) {
  glueAdjacentNonePunct(block);
  var items = flattenParagraph(block);
  var applied = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].type !== 'gap') continue;
    var el = items[i].el;
    if (el.getAttribute('data-ts-combo-fixed') === '1') continue;
    if (i < 1 || items[i - 1].type !== 'char') continue;
    var pi = findPrevCharIndex(items, i);
    var ni = findNextCharIndex(items, i);
    if (pi < 0 || ni < 0) continue;
    var p = punctGapClass(items[pi].ch);
    var n = punctGapClass(items[ni].ch);
    if (p == null || n == null) continue;
    if (p !== 'after' && n !== 'before') continue;
    el.setAttribute('data-ts-combo-fixed', '1');
    el.classList.add('ts-gap-combo');
    el.style.paddingLeft = '0';
    el.style.marginLeft = '-0.5em';
    applied.push(el);
    if (limit != null && applied.length >= limit) break;
  }
  return applied;
}

export function applyComboSymbols(root) {
  root = defaultRoot(root);
  if (!root) return;
  var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
    applyComboSymbolsBlock(block);
  }
}
