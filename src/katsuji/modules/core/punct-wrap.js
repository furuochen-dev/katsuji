/** 半角标点 span：包/拆 ts-half-punct、ts-line-end-half */
import { getDocument } from '../env.js';

function unwrapHalfSpansInBlock(block, selector) {
  var halfs = block.querySelectorAll(selector);
  for (var i = 0; i < halfs.length; i++) {
    var span = halfs[i];
    var parent = span.parentNode;
    if (!parent) continue;
    var text = span.textContent || '';
    if (!text) {
      parent.removeChild(span);
      continue;
    }
    parent.replaceChild(span.ownerDocument.createTextNode(text), span);
  }
}

export function unwrapHalfPunctInBlock(block) {
  unwrapHalfSpansInBlock(block, 'span.ts-half-punct, span.ts-line-end-half');
}

function wrapCharInHalfSpan(item, className, dataAttr, extraStyle) {
  if (!item || item.type !== 'char') return false;
  var node = item.node;
  var offset = item.offset;
  var ch = item.ch;
  if (!node || !node.parentNode) return false;
  var par = node.parentElement;
  if (par && par.classList && par.classList.contains(className)) return false;

  var doc = getDocument(node);
  if (!doc) return false;
  var span = doc.createElement('span');
  span.setAttribute('class', className);
  span.setAttribute(dataAttr, '1');
  span.textContent = ch;
  Object.assign(span.style, extraStyle);

  var tv = node.nodeValue;
  if (tv.length === 1 && offset === 0) {
    node.parentNode.replaceChild(span, node);
    return true;
  }
  if (offset < 0 || offset >= tv.length) return false;
  var before = tv.slice(0, offset);
  var after = tv.slice(offset + 1);
  var frag = doc.createDocumentFragment();
  if (before) frag.appendChild(doc.createTextNode(before));
  frag.appendChild(span);
  if (after) frag.appendChild(doc.createTextNode(after));
  node.parentNode.replaceChild(frag, node);
  return true;
}

export function wrapCharAsHalfPunct(item) {
  return wrapCharInHalfSpan(item, 'ts-half-punct', 'data-ts-half-punct', {
    display: 'inline-block',
    width: '0.5em',
    textAlign: 'left',
    verticalAlign: 'baseline',
    overflow: 'visible',
    boxSizing: 'content-box',
  });
}

export function wrapCharAsLineEndHalf(item) {
  return wrapCharInHalfSpan(item, 'ts-line-end-half', 'data-ts-line-end-half', {
    marginLeft: '-0.5em',
  });
}

export function charItemIsHalfPunctWrapped(item) {
  if (!item || item.type !== 'char') return false;
  var par = item.node && item.node.parentElement;
  return !!(par && par.classList && par.classList.contains('ts-half-punct'));
}

export function charItemIsLineEndHalfWrapped(item) {
  if (!item || item.type !== 'char') return false;
  var par = item.node && item.node.parentElement;
  return !!(par && par.classList && par.classList.contains('ts-line-end-half'));
}
