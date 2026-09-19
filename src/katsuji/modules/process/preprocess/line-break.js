/** 放宽容器 line-break，避免 UA 禁则断行抢在脚本避头之前 */
import { getDocument } from '../../env.js';

var RUBY_SKIP_STYLE_ID = 'ts-ruby-skip-line-break';
var RUBY_SKIP_CSS =
  '[data-ts-relax="1"] ruby, [data-ts-relax="1"] rt, [data-ts-relax="1"] rp, [data-ts-relax="1"] rtc {' +
  'line-break: auto; overflow-wrap: normal; }';

function ensureRubySkipStyle(root) {
  var documentRef = getDocument(root);
  if (!documentRef || !documentRef.head) return;
  if (documentRef.getElementById(RUBY_SKIP_STYLE_ID)) return;
  var style = documentRef.createElement('style');
  style.id = RUBY_SKIP_STYLE_ID;
  style.textContent = RUBY_SKIP_CSS;
  documentRef.head.appendChild(style);
}

export function relaxBuiltinLineBreak(root) {
  if (!root || root.nodeType !== 1 || !root.style) return;
  if (root.getAttribute('data-ts-relax') === '1') return;
  var prev = root.style.getPropertyValue('line-break');
  root.setAttribute('data-ts-relax', '1');
  root.setAttribute('data-ts-prev-line-break', prev);
  root.style.setProperty('line-break', 'anywhere');
  ensureRubySkipStyle(root);
}

export function unrelaxBuiltinLineBreak(root) {
  if (!root || root.nodeType !== 1 || !root.style) return;
  if (root.getAttribute('data-ts-relax') !== '1') return;
  var prev = root.getAttribute('data-ts-prev-line-break');
  if (prev) root.style.setProperty('line-break', prev);
  else root.style.removeProperty('line-break');
  root.removeAttribute('data-ts-relax');
  root.removeAttribute('data-ts-prev-line-break');
}
