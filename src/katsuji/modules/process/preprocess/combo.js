/** 组合符号：固定 ts-gap margin，不参与后续可调空 */
import { defaultRoot, getDocument } from '../../env.js';
import { flattenParagraph, findLineFirstCharIndices, lineItemBounds } from '../../measure/paragraph-items.js';
import { punctGapClass } from '../../text/punctuation-rules.js';
import { comboPairKind, isLayoutWhitespace } from '../typeset-rules.js';

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

export function lockComboGap(el) {
  if (!el || el.getAttribute('data-ts-combo-fixed') === '1') return false;
  el.setAttribute('data-ts-combo-fixed', '1');
  el.classList.add('ts-gap-combo');
  el.style.paddingLeft = '0';
  el.style.marginLeft = '-0.5em';
  return true;
}

function significantCharIndicesInRange(items, startIndex, endIndex) {
  var out = [];
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    if (isLayoutWhitespace(items[i].ch)) continue;
    out.push(i);
  }
  return out;
}

/** 只看本行。4.1 `）（` 两条缝只锁前一条；4.2 锁中间那一条。 */
export function applyComboSymbolsOnLine(layout, L) {
  if (!layout || L < 0 || L >= layout.heads.length) return [];
  var items = layout.items;
  var range = lineItemBounds(items, layout.heads, L);
  var chars = significantCharIndicesInRange(items, range.startIndex, range.endIndex);
  var applied = [];
  for (var c = 0; c < chars.length - 1; c++) {
    var pi = chars[c];
    var ni = chars[c + 1];
    var kind = comboPairKind(items[pi].ch, items[ni].ch);
    if (!kind) continue;
    var firstGap = null;
    for (var g = pi + 1; g < ni; g++) {
      if (items[g].type === 'gap') {
        firstGap = items[g].el;
        break;
      }
    }
    if (firstGap && lockComboGap(firstGap)) applied.push(firstGap);
  }
  return applied;
}

export function applyComboSymbolsBlock(block, limit) {
  glueAdjacentNonePunct(block);
  void block.offsetHeight;
  var items = flattenParagraph(block);
  var heads = findLineFirstCharIndices(items);
  var applied = [];
  if (!heads.length) {
    for (var j = 0; j < items.length; j++) {
      if (items[j].type === 'char') {
        heads = [j];
        break;
      }
    }
    if (!heads.length) return applied;
  }
  var layout = { items: items, heads: heads };
  for (var L = 0; L < layout.heads.length; L++) {
    var more = applyComboSymbolsOnLine(layout, L);
    for (var i = 0; i < more.length; i++) {
      applied.push(more[i]);
      if (limit != null && applied.length >= limit) return applied;
    }
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
