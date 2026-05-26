/** 半角标点 span：包/拆 ts-half-punct、ts-line-end-half */
(function (AT) {
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

  function unwrapHalfPunctInBlock(block) {
    unwrapHalfSpansInBlock(block, 'span.ts-half-punct, span.ts-line-end-half');
  }

  function wrapCharAsHalfPunct(item) {
    if (!item || item.type !== 'char') return false;
    var node = item.node;
    var offset = item.offset;
    var ch = item.ch;
    if (!node || !node.parentNode) return false;
    var par = node.parentElement;
    if (par && par.classList && par.classList.contains('ts-half-punct')) return false;

    var doc = node.ownerDocument || KatsujiInternal.global.document;
    var span = doc.createElement('span');
    span.setAttribute('class', 'ts-half-punct');
    span.setAttribute('data-ts-half-punct', '1');
    span.textContent = ch;
    span.style.display = 'inline-block';
    span.style.width = '0.5em';
    span.style.textAlign = 'left';
    span.style.verticalAlign = 'baseline';
    span.style.overflow = 'visible';
    span.style.boxSizing = 'content-box';

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

  function wrapCharAsLineEndHalf(item) {
    if (!item || item.type !== 'char') return false;
    var node = item.node;
    var offset = item.offset;
    var ch = item.ch;
    if (!node || !node.parentNode) return false;
    var par = node.parentElement;
    if (par && par.classList && par.classList.contains('ts-line-end-half')) return false;

    var doc = node.ownerDocument || KatsujiInternal.global.document;
    var span = doc.createElement('span');
    span.setAttribute('class', 'ts-line-end-half');
    span.setAttribute('data-ts-line-end-half', '1');
    span.textContent = ch;
    span.style.marginLeft = '-0.5em';

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

  function charItemIsHalfPunctWrapped(item) {
    if (!item || item.type !== 'char') return false;
    var par = item.node && item.node.parentElement;
    return !!(par && par.classList && par.classList.contains('ts-half-punct'));
  }

  function charItemIsLineEndHalfWrapped(item) {
    if (!item || item.type !== 'char') return false;
    var par = item.node && item.node.parentElement;
    return !!(par && par.classList && par.classList.contains('ts-line-end-half'));
  }

  AT.PunctWrap = {
    unwrapHalfPunctInBlock: unwrapHalfPunctInBlock,
    wrapCharAsHalfPunct: wrapCharAsHalfPunct,
    wrapCharAsLineEndHalf: wrapCharAsLineEndHalf,
    charItemIsHalfPunctWrapped: charItemIsHalfPunctWrapped,
    charItemIsLineEndHalfWrapped: charItemIsLineEndHalfWrapped,
  };
})(KatsujiInternal);
