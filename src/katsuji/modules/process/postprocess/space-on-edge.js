/** 第 3 步：行首 `前有空` 顶格。段首行也做；左挂两档只决定要不要再推盒。 */
import {
  firstSignificantCharIndexOnLine,
  gapElAdjacentBeforeChar,
} from '../../measure/paragraph-items.js';
import { isSpaceOnEdgeStart } from '../../text/punctuation-rules.js';
import {
  wrapCharAsLineStartOpen,
  charItemIsHalfPunctWrapped,
  glueLineStartOpenToNext,
  protrudeHalfPunctStart,
} from '../../core/punct-wrap.js';
import { shouldProtrudeLineStartOpen } from '../typeset-rules.js';
import { punctHit } from './edge-shared.js';

/** 行首是 `前有空`：去掉前空，0.5em 盒只露右边的墨。 */
export function trySpaceOnEdgeStart(layout, L, hp) {
  var items = layout.items;
  var heads = layout.heads;
  var lineStart = heads[L];
  var nextLineStart = L + 1 < heads.length ? heads[L + 1] : items.length;
  var sig = firstSignificantCharIndexOnLine(items, lineStart, nextLineStart);
  if (sig < 0) return false;
  if (!isSpaceOnEdgeStart(items[sig].ch)) return false;
  if (charItemIsHalfPunctWrapped(items[sig])) return false;

  var openGap = gapElAdjacentBeforeChar(items, sig);
  if (openGap) {
    openGap.style.paddingLeft = '0';
    openGap.style.marginLeft = '0';
    openGap.setAttribute('data-ts-line-start-open-gap', '1');
  }
  var charEl = wrapCharAsLineStartOpen(items[sig]) || null;
  if (!charEl && !openGap) return false;
  var protrude = shouldProtrudeLineStartOpen(L, layout.indentEm || 0, hp);
  if ((L >= 1 || protrude) && charEl) glueLineStartOpenToNext(charEl);
  if (charEl && protrude) protrudeHalfPunctStart(charEl);
  return punctHit('space-start', L, openGap ? [openGap] : [], {
    ch: items[sig].ch,
    charEl: charEl,
  });
}
