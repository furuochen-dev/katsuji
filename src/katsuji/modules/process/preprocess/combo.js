/** 组合符号：固定 ts-gap margin，不参与后续可调空 */
(function (AT) {
  var flattenParagraph = AT.ParagraphItems.flattenParagraph;
  var comboBracketClass = AT.PunctuationRules.comboBracketClass;

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

  function applyComboSymbolsBlock(block) {
    var items = flattenParagraph(block);
    for (var i = 0; i < items.length; i++) {
      if (items[i].type !== 'gap') continue;
      var el = items[i].el;
      if (el.getAttribute('data-ts-combo-fixed') === '1') continue;
      if (i < 1 || items[i - 1].type !== 'char') continue;
      var pi = findPrevCharIndex(items, i);
      var ni = findNextCharIndex(items, i);
      if (pi < 0 || ni < 0) continue;
      var p = comboBracketClass(items[pi].ch);
      var n = comboBracketClass(items[ni].ch);
      if (p == null || n == null) continue;
      var hit =
        (p === 'N' && n === 'L') ||
        (p === 'R' && n === 'N') ||
        (p === 'N' && n === 'N') ||
        (p === 'R' && n === 'L');
      if (!hit) continue;
      el.setAttribute('data-ts-combo-fixed', '1');
      el.classList.add('ts-gap-combo');
      el.style.paddingLeft = '0';
      el.style.marginLeft = '-0.5em';
    }
  }

  function applyComboSymbols(root) {
    var g = AT.global;
    root = root || g.document.body;
    var blocks = root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      if (block.closest && block.closest('script, style, textarea, noscript, pre, code')) continue;
      applyComboSymbolsBlock(block);
    }
  }

  AT.Combo = {
    applyComboSymbolsBlock: applyComboSymbolsBlock,
    applyComboSymbols: applyComboSymbols,
  };
})(KatsujiInternal);
