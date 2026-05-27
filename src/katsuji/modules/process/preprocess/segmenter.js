/** 按禁则在标点外侧插入 ts-gap，把段落切成 char / gap 可遍历结构 */
import { getDocument, defaultRoot } from '../../env.js';
import { shouldSkipTextParent } from '../../core/dom-util.js';
import { BEFORE_OPEN_GAP, AFTER_CHARS } from '../../text/punctuation-rules.js';

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
    if (BEFORE_OPEN_GAP[ch]) {
      if (buf) {
        frag.appendChild(documentRef.createTextNode(buf));
        buf = '';
      }
      var spanBefore = documentRef.createElement('span');
      spanBefore.setAttribute('class', 'ts-gap');
      spanBefore.setAttribute('data-ts-open-gap', '1');
      spanBefore.setAttribute('style', 'padding-left: 0px;');
      frag.appendChild(spanBefore);
      buf += ch;
      continue;
    }
    buf += ch;
    if (AFTER_CHARS[ch]) {
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
  var spans = block.querySelectorAll('span.ts-gap:not([data-ts-combo-fixed])');
  for (var i = 0; i < spans.length; i++) {
    spans[i].style.paddingLeft = '0px';
    spans[i].style.marginLeft = '0px';
    spans[i].removeAttribute('data-ts-head-punct-trail');
  }
}
