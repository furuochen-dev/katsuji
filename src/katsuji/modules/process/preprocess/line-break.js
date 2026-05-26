/** 放宽容器 line-break，避免 UA 禁则断行抢在脚本避头之前 */
(function (AT) {
  function relaxBuiltinLineBreak(root) {
    if (!root || root.nodeType !== 1 || !root.style) return;
    if (root.getAttribute('data-ts-relax') === '1') return;
    var prev = root.style.getPropertyValue('line-break');
    root.setAttribute('data-ts-relax', '1');
    root.setAttribute('data-ts-prev-line-break', prev);
    root.style.setProperty('line-break', 'anywhere');
  }

  function unrelaxBuiltinLineBreak(root) {
    if (!root || root.nodeType !== 1 || !root.style) return;
    if (root.getAttribute('data-ts-relax') !== '1') return;
    var prev = root.getAttribute('data-ts-prev-line-break');
    if (prev) root.style.setProperty('line-break', prev);
    else root.style.removeProperty('line-break');
    root.removeAttribute('data-ts-relax');
    root.removeAttribute('data-ts-prev-line-break');
  }

  AT.LineBreak = {
    relaxBuiltinLineBreak: relaxBuiltinLineBreak,
    unrelaxBuiltinLineBreak: unrelaxBuiltinLineBreak,
  };
})(KatsujiInternal);
