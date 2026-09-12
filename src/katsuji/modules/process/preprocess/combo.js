/** 组合符号：前面的字收半角盒，中间那条缝删掉 */
import { defaultRoot, getDocument } from '../../env.js';
import { flattenParagraph, findLineFirstCharIndices, lineItemBounds } from '../../measure/paragraph-items.js';
import { wrapCharAsHalfPunct, wrapCharAsLineStartOpen, charItemIsHalfPunctWrapped } from '../../core/punct-wrap.js';
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
  var guard = 0;
  while (guard++ < 32) {
    var items = flattenParagraph(block);
    var run = null;
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
      if (i - start < 2) continue;
      var a = items[start];
      var b = items[i - 1];
      if (!a || !b || a.node !== b.node || !a.node.parentNode) continue;
      run = { node: a.node, startOff: a.offset, endOff: b.offset };
    }
    if (!run) return;
    wrapNoneRunSameNode(run.node, run.startOff, run.endOff);
  }
}

/** 后有空露左墨；前有空和行首顶格一样，盒里左移半字只露右墨。 */
function wrapComboHalf(item) {
  if (!item || item.type !== 'char') return null;
  if (punctGapClass(item.ch) === 'before') return wrapCharAsLineStartOpen(item) || null;
  return wrapCharAsHalfPunct(item) || null;
}

function firstGapBetween(items, leftIdx, rightIdx) {
  var lo = Math.min(leftIdx, rightIdx);
  var hi = Math.max(leftIdx, rightIdx);
  for (var g = lo + 1; g < hi; g++) {
    if (items[g].type === 'gap') return items[g].el;
  }
  return null;
}

/**
 * 成对：前面的字收半角盒，中间第一条缝删掉。
 * 前面已经是半角盒时，改收后面的，合仍少 0.5em。
 * 没有缝（已经收过）则不动。
 */
export function applyComboPair(items, leftIdx, rightIdx) {
  if (leftIdx < 0 || rightIdx < 0) return null;
  var left = items[leftIdx];
  var right = items[rightIdx];
  if (!left || left.type !== 'char' || !right || right.type !== 'char') return null;
  var kind = comboPairKind(left.ch, right.ch);
  if (!kind) return null;
  var gap = firstGapBetween(items, leftIdx, rightIdx);
  if (!gap) return null;
  // 4.1 只删前一条。前面已经是半角盒时，剩下的是后字前有空，不要再收。
  if (charItemIsHalfPunctWrapped(left) && kind === 'after-before') return null;
  var wrapped = null;
  if (!charItemIsHalfPunctWrapped(left)) {
    wrapped = wrapComboHalf(left);
  } else if (!charItemIsHalfPunctWrapped(right)) {
    wrapped = wrapComboHalf(right);
  }
  if (gap.parentNode) gap.parentNode.removeChild(gap);
  return wrapped || gap;
}

/** 压入：接缝 + 串内成对都先收。还没折上来也收，折行器才能看见少的 0.5em。 */
export function applyComboPairsOnPullRun(items, lastIdx, pullIdxs) {
  var applied = [];
  if (lastIdx >= 0 && pullIdxs && pullIdxs[0] != null) {
    var junction = applyComboPair(items, lastIdx, pullIdxs[0]);
    if (junction) applied.push(junction);
  }
  if (!pullIdxs) return applied;
  for (var i = 0; i < pullIdxs.length - 1; i++) {
    var a = pullIdxs[i];
    var b = pullIdxs[i + 1];
    if (a == null || b == null) continue;
    var hit = applyComboPair(items, a, b);
    if (hit) applied.push(hit);
  }
  return applied;
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

/** 只看本行。4.1 `）（` 两条缝只删前一条；一次只收一对，调用方再扫。 */
export function applyComboSymbolsOnLine(layout, L) {
  if (!layout || L < 0 || L >= layout.heads.length) return [];
  var items = layout.items;
  var range = lineItemBounds(items, layout.heads, L);
  var chars = significantCharIndicesInRange(items, range.startIndex, range.endIndex);
  for (var c = 0; c < chars.length - 1; c++) {
    var pi = chars[c];
    var ni = chars[c + 1];
    if (!comboPairKind(items[pi].ch, items[ni].ch)) continue;
    var hit = applyComboPair(items, pi, ni);
    if (hit) return [hit];
  }
  return [];
}

export function applyComboSymbolsBlock(block, limit) {
  glueAdjacentNonePunct(block);
  void block.offsetHeight;
  var applied = [];
  var guard = 0;
  while (guard++ < 64) {
    var items = flattenParagraph(block);
    var heads = findLineFirstCharIndices(items);
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
    var found = false;
    for (var L = 0; L < layout.heads.length; L++) {
      var more = applyComboSymbolsOnLine(layout, L);
      if (!more.length) continue;
      for (var i = 0; i < more.length; i++) {
        applied.push(more[i]);
        if (limit != null && applied.length >= limit) return applied;
      }
      found = true;
      break;
    }
    if (!found) break;
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
