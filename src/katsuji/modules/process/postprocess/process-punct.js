/** 行边界：先空，后非法。一次只做成一件 */
import { buildBlockLayout } from '../../measure/line-width.js';
import { hangConfig } from '../../core/config.js';
import { applySpaceOnEdge } from './space-on-edge.js';
import { applyIllegalOnEdge } from './illegal-on-edge.js';

export function applyProcessPunct(block, hangOpts) {
  hangOpts = hangOpts || hangConfig;
  var layout = buildBlockLayout(block);
  if (!layout || !layout.items.length || layout.heads.length < 1) return false;
  var hit = applySpaceOnEdge(layout, hangOpts);
  if (hit) return hit;
  return applyIllegalOnEdge(layout, hangOpts);
}
