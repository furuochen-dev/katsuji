/** 半角标点 span：包/拆 ts-half-punct、ts-line-end-half */
import { getDocument } from '../env.js';
import { AFTER_CHARS } from '../text/punctuation-rules.js';

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

function unwrapNamedWraps(block, selector) {
  var wraps = block.querySelectorAll(selector);
  for (var i = 0; i < wraps.length; i++) {
    var wrap = wraps[i];
    var parent = wrap.parentNode;
    if (!parent) continue;
    while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
    parent.removeChild(wrap);
  }
}

export function unwrapHalfPunctInBlock(block) {
  unwrapHalfSpansInBlock(block, 'span.ts-half-punct, span.ts-line-end-half');
  unwrapNamedWraps(block, 'span[data-ts-line-start-nowrap]');
}

export function unwrapNoneRuns(block) {
  unwrapNamedWraps(block, 'span[data-ts-none-run]');
}

/** 和后面第一个字绑在一起：半宽后仍超过上一行剩余，软折不会抽回去 */
export function glueLineStartOpenToNext(charEl) {
  if (!charEl || !charEl.parentNode) return null;
  if (charEl.parentElement && charEl.parentElement.getAttribute('data-ts-line-start-nowrap') === '1') {
    return charEl.parentElement;
  }
  var doc = charEl.ownerDocument || getDocument(charEl);
  if (!doc) return null;
  var wrap = doc.createElement('span');
  wrap.setAttribute('data-ts-line-start-nowrap', '1');
  wrap.style.whiteSpace = 'nowrap';
  charEl.parentNode.insertBefore(wrap, charEl);
  wrap.appendChild(charEl);
  var n = wrap.nextSibling;
  while (n && n.nodeType === 1 && n.classList && n.classList.contains('ts-gap')) {
    wrap.appendChild(n);
    n = wrap.nextSibling;
  }
  if (n && n.nodeType === 3 && n.nodeValue) {
    if (n.nodeValue.length === 1) {
      wrap.appendChild(n);
    } else {
      var rest = n.nodeValue.slice(1);
      wrap.appendChild(doc.createTextNode(n.nodeValue.charAt(0)));
      n.nodeValue = rest;
    }
  }
  return wrap;
}

function wrapCharInHalfSpan(item, className, dataAttr, extraStyle) {
  if (!item || item.type !== 'char') return false;
  var node = item.node;
  var offset = item.offset;
  var ch = item.ch;
  if (!node || !node.parentNode) return false;
  if (closestNamedSpan(node, className)) return false;

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
    return span;
  }
  if (offset < 0 || offset >= tv.length) return false;
  var before = tv.slice(0, offset);
  var after = tv.slice(offset + 1);
  var frag = doc.createDocumentFragment();
  if (before) frag.appendChild(doc.createTextNode(before));
  frag.appendChild(span);
  if (after) frag.appendChild(doc.createTextNode(after));
  node.parentNode.replaceChild(frag, node);
  return span;
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

function isLayoutWhitespace(ch) {
  return ch === '\n' || ch === '\r' || ch === ' ' || ch === '\t' || ch === '\u00a0' || ch === '\u3000';
}

/**
 * 行尾连续 `后有空` 里优先包 `」` 等闭括，否则包最后一个。
 * 推出整字宽时若只动缝、不收行尾 `」`，剩半格会溢出，浏览器再把 `」` 和前一个字一起折走。
 */
export function wrapTrailingAfterPunctOnLine(items, startIndex, endExcl) {
  var last = -1;
  var closer = -1;
  for (var i = Math.min(endExcl, items.length) - 1; i >= startIndex; i--) {
    if (items[i].type !== 'char') continue;
    var ch = items[i].ch;
    if (isLayoutWhitespace(ch)) continue;
    if (!AFTER_CHARS[ch]) break;
    if (last < 0) last = i;
    if ('」』）】｝〉》)]}'.indexOf(ch) !== -1) closer = i;
  }
  var target = closer >= 0 ? closer : last;
  if (target < 0 || charItemIsHalfPunctWrapped(items[target])) return null;
  return wrapCharAsHalfPunct(items[target]) || null;
}

/** 行首开括号：0.5em 盒与行尾半角相同；里边只拉 margin，露出右边的墨 */
export function wrapCharAsLineStartOpen(item) {
  var span = wrapCharInHalfSpan(item, 'ts-half-punct', 'data-ts-line-start-open', {
    display: 'inline-block',
    width: '0.5em',
    verticalAlign: 'baseline',
    overflow: 'visible',
    boxSizing: 'content-box',
  });
  if (!span) return span;
  var inner = span.ownerDocument.createElement('span');
  inner.setAttribute('data-ts-line-start-open-glyph', '1');
  inner.style.marginLeft = '-0.5em';
  inner.textContent = span.textContent;
  span.textContent = '';
  span.appendChild(inner);
  return span;
}

function closestNamedSpan(node, className) {
  var el = node && node.parentElement;
  while (el) {
    if (el.classList && el.classList.contains(className)) return el;
    el = el.parentElement;
  }
  return null;
}

export function charItemIsHalfPunctWrapped(item) {
  if (!item || item.type !== 'char') return false;
  return !!closestNamedSpan(item.node, 'ts-half-punct');
}
