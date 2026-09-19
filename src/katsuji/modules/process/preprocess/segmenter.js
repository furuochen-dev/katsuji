/** 按禁则在标点外侧插入 ts-gap，把段落切成 char / gap 可遍历结构 */
import { getDocument, defaultRoot } from '../../env.js';
import { shouldSkipTextParent } from '../../core/dom-util.js';
import { flattenParagraph } from '../../measure/paragraph-items.js';
import { gapInsertSide } from '../typeset-rules.js';

function collectTextNodes(root) {
  var list = [];
  var documentRef = getDocument(root);
  if (!documentRef || !root) return list;
  var walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  var node;
  while ((node = walker.nextNode())) {
    if (shouldSkipTextParent(node.parentElement)) continue;
    list.push(node);
  }
  return list;
}

function splitTextWithMarkers(text, documentRef) {
  var frag = documentRef.createDocumentFragment();
  var buf = '';
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    var side = gapInsertSide(ch);
    if (side === 'before' || side === 'both') {
      if (buf) {
        frag.appendChild(documentRef.createTextNode(buf));
        buf = '';
      }
      var spanBefore = documentRef.createElement('span');
      spanBefore.setAttribute('class', 'ts-gap');
      spanBefore.setAttribute('data-ts-open-gap', '1');
      spanBefore.setAttribute('style', 'padding-left: 0px;');
      frag.appendChild(spanBefore);
    }
    buf += ch;
    if (side === 'after' || side === 'both') {
      frag.appendChild(documentRef.createTextNode(buf));
      var span = documentRef.createElement('span');
      span.setAttribute('class', 'ts-gap');
      span.setAttribute('style', 'padding-left: 0px;');
      frag.appendChild(span);
      buf = '';
    }
  }
  if (buf) frag.appendChild(documentRef.createTextNode(buf));
  return frag;
}

function processTextNode(textNode) {
  var text = textNode.nodeValue;
  if (!text) return;
  var parent = textNode.parentNode;
  if (!parent) return;
  var documentRef = getDocument(textNode);
  if (!documentRef) return;
  var frag = splitTextWithMarkers(text, documentRef);
  if (frag.childNodes.length === 1 && frag.firstChild.nodeType === Node.TEXT_NODE) return;
  parent.replaceChild(frag, textNode);
}

export function apply(root) {
  root = defaultRoot(root);
  if (!root) return;
  var nodes = collectTextNodes(root);
  for (var i = 0; i < nodes.length; i++) {
    processTextNode(nodes[i]);
  }
}

export function resetGapStyles(block) {
  var spans = block.querySelectorAll('span.ts-gap');
  for (var i = 0; i < spans.length; i++) {
    spans[i].style.paddingLeft = '0px';
    spans[i].style.marginLeft = '0px';
    spans[i].removeAttribute('data-ts-head-punct-trail');
    spans[i].removeAttribute('data-ts-line-start-open-gap');
    spans[i].removeAttribute('data-ts-line-end-gap');
  }
}

/** 清掉 hang / surplus 写在 gap 上的样式，保留 ts-gap 本身 */
export function resetAllGapStyles(block) {
  resetGapStyles(block);
}

function nextNonWs(items, start) {
  for (var j = start; j < items.length; j++) {
    if (items[j].type === 'gap') return items[j];
    if (items[j].type === 'char') return items[j];
  }
  return null;
}

function prevNonWs(items, start) {
  for (var k = start; k >= 0; k--) {
    if (items[k].type === 'gap') return items[k];
    if (items[k].type === 'char') return items[k];
  }
  return null;
}

function insertGapBesideChar(item, side, doc) {
  var node = item.node;
  var offset = item.offset;
  if (!node || !node.parentNode) return;
  var parent = node.parentNode;
  var span = doc.createElement('span');
  span.setAttribute('class', 'ts-gap');
  span.setAttribute('style', 'padding-left: 0px;');
  if (side === 'before') span.setAttribute('data-ts-open-gap', '1');
  var tv = node.nodeValue || '';
  if (node.nodeType === Node.TEXT_NODE && tv.length === 1 && offset === 0) {
    if (side === 'after') parent.insertBefore(span, node.nextSibling);
    else parent.insertBefore(span, node);
    return;
  }
  if (node.nodeType !== Node.TEXT_NODE || offset < 0 || offset >= tv.length) {
    if (side === 'after') parent.insertBefore(span, node.nextSibling);
    else parent.insertBefore(span, node);
    return;
  }
  var before = tv.slice(0, offset);
  var ch = tv.charAt(offset);
  var after = tv.slice(offset + 1);
  var frag = doc.createDocumentFragment();
  if (side === 'before') {
    if (before) frag.appendChild(doc.createTextNode(before));
    frag.appendChild(span);
    frag.appendChild(doc.createTextNode(ch + after));
  } else {
    if (before) frag.appendChild(doc.createTextNode(before));
    frag.appendChild(doc.createTextNode(ch));
    frag.appendChild(span);
    if (after) frag.appendChild(doc.createTextNode(after));
  }
  parent.replaceChild(frag, node);
}

function findFirstMissingGap(items) {
  for (var i = 0; i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var ch = items[i].ch;
    var side = gapInsertSide(ch);
    if (side === 'after' || side === 'both') {
      var next = nextNonWs(items, i + 1);
      if (next && next.type === 'char') return { item: items[i], side: 'after' };
    }
    if (side === 'before' || side === 'both') {
      var prev = prevNonWs(items, i - 1);
      if (prev && prev.type === 'char') return { item: items[i], side: 'before' };
    }
  }
  return null;
}

/** 连写删掉的缝，拆半角盒之后补回去，下一轮才能再切 */
export function restoreMissingGaps(block) {
  var documentRef = getDocument(block);
  if (!documentRef || !block) return;
  var guard = 0;
  while (guard++ < 200) {
    var job = findFirstMissingGap(flattenParagraph(block));
    if (!job) return;
    insertGapBesideChar(job.item, job.side, documentRef);
  }
}
