/** 按禁则在标点外侧插入 ts-gap，把段落切成 char / gap 可遍历结构 */
(function (AT) {
  var g = AT.global;
  var shouldSkipTextParent = AT.DomUtil.shouldSkipTextParent;
  var BEFORE_OPEN_GAP = AT.PunctuationRules.BEFORE_OPEN_GAP;
  var AFTER_CHARS = AT.PunctuationRules.AFTER_CHARS;

  function collectTextNodes(root) {
    var list = [];
    var doc = root.ownerDocument || g.document;
    if (!doc || !root) return list;
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (shouldSkipTextParent(node.parentElement)) continue;
      list.push(node);
    }
    return list;
  }

  function splitTextWithMarkers(text, doc) {
    var frag = doc.createDocumentFragment();
    var buf = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (BEFORE_OPEN_GAP[ch]) {
        if (buf) {
          frag.appendChild(doc.createTextNode(buf));
          buf = '';
        }
        var spanBefore = doc.createElement('span');
        spanBefore.setAttribute('class', 'ts-gap');
        spanBefore.setAttribute('data-ts-open-gap', '1');
        spanBefore.setAttribute('style', 'padding-left: 0px;');
        frag.appendChild(spanBefore);
        buf += ch;
        continue;
      }
      buf += ch;
      if (AFTER_CHARS[ch]) {
        frag.appendChild(doc.createTextNode(buf));
        var span = doc.createElement('span');
        span.setAttribute('class', 'ts-gap');
        span.setAttribute('style', 'padding-left: 0px;');
        frag.appendChild(span);
        buf = '';
      }
    }
    if (buf) frag.appendChild(doc.createTextNode(buf));
    return frag;
  }

  function processTextNode(textNode) {
    var text = textNode.nodeValue;
    if (!text) return;
    var parent = textNode.parentNode;
    if (!parent) return;
    var doc = textNode.ownerDocument || g.document;
    var frag = splitTextWithMarkers(text, doc);
    if (frag.childNodes.length === 1 && frag.firstChild.nodeType === Node.TEXT_NODE) return;
    parent.replaceChild(frag, textNode);
  }

  function apply(root) {
    root = root || g.document.body;
    var nodes = collectTextNodes(root);
    for (var i = 0; i < nodes.length; i++) {
      processTextNode(nodes[i]);
    }
  }

  function resetGapStyles(block) {
    var spans = block.querySelectorAll('span.ts-gap:not([data-ts-combo-fixed])');
    for (var i = 0; i < spans.length; i++) {
      spans[i].style.paddingLeft = '0px';
      spans[i].style.marginLeft = '0px';
      spans[i].removeAttribute('data-ts-head-punct-trail');
    }
  }

  AT.Segmenter = {
    apply: apply,
    collectTextNodes: collectTextNodes,
    processTextNode: processTextNode,
    resetGapStyles: resetGapStyles,
  };
})(KatsujiInternal);
