/** 按合装箱的行头落到 DOM：段上 nowrap，行界插 br。画面跟行头一致。 */
import { getDocument } from '../../env.js';
import { buildBlockLayout } from '../../measure/line-width.js';

export function clearOwnBreaks(block) {
  if (!block) return;
  var brs = block.querySelectorAll('br.ts-br');
  for (var i = 0; i < brs.length; i++) {
    if (brs[i].parentNode) brs[i].parentNode.removeChild(brs[i]);
  }
  if (block.classList) block.classList.remove('ts-own-breaks');
}

function tokenRoot(block, item) {
  if (!item) return null;
  var node = item.type === 'gap' ? item.el : item.node;
  if (!node) return null;
  if (item.type === 'char' && node.nodeType === 3 && item.offset > 0 && item.offset < node.nodeValue.length) {
    node = node.splitText(item.offset);
  }
  while (node.parentNode && node.parentNode !== block) node = node.parentNode;
  return node.parentNode === block ? node : null;
}

function applyOwnBreaks(block, layout) {
  var doc = getDocument(block);
  if (!doc || !layout || !layout.heads) return;
  for (var L = layout.heads.length - 1; L >= 1; L--) {
    var node = tokenRoot(block, layout.items[layout.heads[L]]);
    if (!node || !node.parentNode) continue;
    var br = doc.createElement('br');
    br.setAttribute('class', 'ts-br');
    node.parentNode.insertBefore(br, node);
  }
  if (layout.heads.length > 1 && block.classList) block.classList.add('ts-own-breaks');
}

export function syncOwnBreaks(block) {
  clearOwnBreaks(block);
  var layout = buildBlockLayout(block);
  if (!layout) return null;
  applyOwnBreaks(block, layout);
  return layout;
}
