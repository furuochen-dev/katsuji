/** 组合符号：一对包一个半角盒，只删这个字自己朝向另一字的缝 */
import { defaultRoot, getDocument } from '../../env.js';
import { flattenParagraph, findLineFirstCharIndices, lineItemBounds } from '../../measure/paragraph-items.js';
import { wrapCharAsHalfPunct, wrapCharAsLineStartOpen, charItemIsHalfPunctWrapped, charItemHalfPunctSpan } from '../../core/punct-wrap.js';
import { isInsideRuby } from '../../core/dom-util.js';
import { isVerticalWritingMode } from '../../core/flow.js';
import { applyPunctForElement, restorePunctFromConfig } from '../../core/punct-config.js';
import { isSpaceOnEdgeStart, isCenterStop, isCenterFixed, twoEmKeepRuns } from '../../text/punctuation-rules.js';
import { comboPairKind, gapInsertSide, isLayoutWhitespace } from '../typeset-rules.js';

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

/** `两字一体` 成对绑在一起，中间不折行。相邻无空不一律绑 */
export function glueTwoEmKeepPairs(block) {
  applyPunctForElement(block);
  var changed = false;
  var guard = 0;
  while (guard++ < 32) {
    var items = flattenParagraph(block);
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type !== 'char') continue;
      var node = items[i].node;
      if (!node || !node.nodeValue || !node.parentNode) continue;
      var par = node.parentElement;
      if (par && par.getAttribute('data-ts-none-run') === '1') continue;
      if (isInsideRuby(par)) continue;
      var runs = twoEmKeepRuns(node.nodeValue);
      if (!runs.length) continue;
      found = { node: node, startOff: runs[0].start, endOff: runs[0].end };
      break;
    }
    if (!found) return changed;
    wrapNoneRunSameNode(found.node, found.startOff, found.endOff);
    changed = true;
  }
  return changed;
}

export function glueAdjacentNonePunct(block) {
  glueTwoEmKeepPairs(block);
}

/** 收半角落左墨；前有空和行首顶格一样，盒里左移半字只露右墨。 */
function wrapComboHalf(item) {
  if (!item || item.type !== 'char') return null;
  if (isSpaceOnEdgeStart(item.ch)) return wrapCharAsLineStartOpen(item) || null;
  return wrapCharAsHalfPunct(item) || null;
}

function isOpenGapEl(el) {
  return !!(el && el.getAttribute && el.getAttribute('data-ts-open-gap') === '1');
}

function isCenterAlignChar(ch) {
  return isCenterStop(ch) || isCenterFixed(ch);
}

function isLineStartOpenWrapped(item) {
  var span = charItemHalfPunctSpan(item);
  return !!(span && span.getAttribute('data-ts-line-start-open') === '1');
}

/** 一对只包一个：左还能包就包左；左是置中或已是顶格前有空盒才包右。置中不进盒。 */
function pickComboTarget(left, right) {
  if (!isCenterAlignChar(left.ch) && !charItemIsHalfPunctWrapped(left)) return left;
  if (
    !isCenterAlignChar(right.ch) &&
    !charItemIsHalfPunctWrapped(right) &&
    (isCenterAlignChar(left.ch) || isLineStartOpenWrapped(left))
  ) {
    return right;
  }
  return null;
}

/** 只删被包的字朝向另一字的那条自己的缝。 */
function facingOwnedGap(items, leftIdx, rightIdx, target, left) {
  var side = gapInsertSide(target.ch);
  var g;
  if (target === left) {
    if (side !== 'after' && side !== 'both') return null;
    for (g = leftIdx + 1; g < rightIdx; g++) {
      if (items[g].type !== 'gap') continue;
      if (isOpenGapEl(items[g].el)) continue;
      return items[g].el;
    }
    return null;
  }
  if (side !== 'before' && side !== 'both') return null;
  var found = null;
  for (g = leftIdx + 1; g < rightIdx; g++) {
    if (items[g].type !== 'gap') continue;
    if (isOpenGapEl(items[g].el)) found = items[g].el;
  }
  return found;
}

/**
 * 成对：包一个半角盒，只删这个字自己朝向另一字的缝。
 */
export function applyComboPair(items, leftIdx, rightIdx) {
  if (leftIdx < 0 || rightIdx < 0) return null;
  var left = items[leftIdx];
  var right = items[rightIdx];
  if (!left || left.type !== 'char' || !right || right.type !== 'char') return null;
  if (!comboPairKind(left.ch, right.ch)) return null;
  var target = pickComboTarget(left, right);
  if (!target) return null;
  var wrapped = wrapComboHalf(target);
  if (!wrapped) return null;
  var drop = facingOwnedGap(items, leftIdx, rightIdx, target, left);
  if (drop && drop.parentNode) drop.parentNode.removeChild(drop);
  return wrapped;
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

/** 只看本行。一次只收一对，调用方再扫。 */
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
  applyPunctForElement(block);
  glueTwoEmKeepPairs(block);
  void block.offsetHeight;
  var applied = [];
  var guard = 0;
  while (guard++ < 64) {
    var items = flattenParagraph(block);
    var heads = findLineFirstCharIndices(items, isVerticalWritingMode(block));
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
  restorePunctFromConfig();
}
