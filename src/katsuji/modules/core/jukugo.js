/** 熟语：`<jukugo>` 包一字一 ruby；`<ruby jukugo>` 已是一颗。关键字可配。 */
import { lineItemBounds } from '../measure/paragraph-items.js';

export function resolveJukugoName(hangOpts) {
  var n = hangOpts && hangOpts.jukugo;
  if (n == null || String(n).trim() === '') return 'jukugo';
  return String(n).trim();
}

export function closestJukugoWrapper(el, name) {
  if (!el || !el.closest || !name) return null;
  try {
    return el.closest(name);
  } catch (err) {
    return null;
  }
}

export function rubyHasJukugoAttr(ruby, name) {
  return !!(ruby && ruby.hasAttribute && name && ruby.hasAttribute(name));
}

export function rubyPairs(ruby) {
  var pairs = [];
  if (!ruby) return pairs;
  var base = '';
  var kids = ruby.childNodes;
  for (var i = 0; i < kids.length; i++) {
    var n = kids[i];
    if (n.nodeType === 1) {
      var tag = n.tagName && n.tagName.toUpperCase();
      if (tag === 'RT') {
        pairs.push({ base: base, rt: n.textContent || '' });
        base = '';
        continue;
      }
      if (tag === 'RP' || tag === 'RTC') continue;
      if (tag === 'RB') {
        base += n.textContent || '';
        continue;
      }
      base += n.textContent || '';
      continue;
    }
    if (n.nodeType === 3) base += n.nodeValue || '';
  }
  return pairs;
}

function appendPairsToRuby(ruby, pairs, doc) {
  for (var i = 0; i < pairs.length; i++) {
    if (pairs[i].base) ruby.appendChild(doc.createTextNode(pairs[i].base));
    var rt = doc.createElement('rt');
    rt.textContent = pairs[i].rt;
    ruby.appendChild(rt);
  }
}

export function collectRubyPairs(rubies) {
  var pairs = [];
  if (!rubies) return pairs;
  for (var i = 0; i < rubies.length; i++) {
    var p = rubyPairs(rubies[i]);
    if (p.length) {
      for (var j = 0; j < p.length; j++) pairs.push(p[j]);
    } else {
      pairs.push({ base: rubies[i].textContent || '', rt: '' });
    }
  }
  return pairs;
}

function isAlreadyGroupRuby(ruby) {
  var pairs = rubyPairs(ruby);
  if (pairs.length !== 1) return false;
  return (pairs[0].base || '').length > 1;
}

function writeStoredPairs(ruby, pairs, from) {
  try {
    ruby.setAttribute('data-ts-jukugo-pairs', JSON.stringify(pairs));
  } catch (err) {
    /* ignore */
  }
  if (from) ruby.setAttribute('data-ts-jukugo-from', from);
}

function readStoredPairs(ruby) {
  var raw = ruby && ruby.getAttribute && ruby.getAttribute('data-ts-jukugo-pairs');
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    return parsed && parsed.length ? parsed : null;
  } catch (err) {
    return null;
  }
}

function fillGroupRuby(ruby, pairs, doc) {
  var base = '';
  var reading = '';
  for (var i = 0; i < pairs.length; i++) {
    base += pairs[i].base || '';
    reading += pairs[i].rt || '';
  }
  if (base) ruby.appendChild(doc.createTextNode(base));
  var rt = doc.createElement('rt');
  rt.textContent = reading;
  ruby.appendChild(rt);
}

export function probeJukugoRunWidthPx(rubies) {
  if (!rubies || !rubies.length) return 0;
  var first = rubies[0];
  if (
    rubies.length === 1 &&
    (isAlreadyGroupRuby(first) ||
      (first.getAttribute && first.getAttribute('data-ts-jukugo-merged') === '1') ||
      rubyPairs(first).length < 2)
  ) {
    var live = first.getBoundingClientRect().width;
    return live > 0 ? live : 0;
  }
  var pairs = collectRubyPairs(rubies);
  if (pairs.length < 2 && rubies.length < 2) {
    var own = first.getBoundingClientRect().width;
    return own > 0 ? own : 0;
  }
  var doc = first.ownerDocument;
  var host =
    (first.closest && first.closest('p, h1, h2, h3, h4, h5, h6, li')) || first.parentNode;
  if (!doc || !host || !host.parentNode) return 0;
  var clone = host.cloneNode(true);
  clone.style.position = 'absolute';
  clone.style.left = '-99999px';
  clone.style.top = '0';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  var hostW = host.clientWidth || host.getBoundingClientRect().width;
  if (hostW > 0) clone.style.width = hostW + 'px';
  host.parentNode.appendChild(clone);
  var srcList = host.querySelectorAll('ruby');
  var dstList = clone.querySelectorAll('ruby');
  var run = [];
  for (var i = 0; i < rubies.length; i++) {
    var idx = -1;
    for (var s = 0; s < srcList.length; s++) {
      if (srcList[s] === rubies[i]) {
        idx = s;
        break;
      }
    }
    if (idx >= 0 && dstList[idx]) run.push(dstList[idx]);
  }
  var w = 0;
  if (run.length && (pairs.length >= 2 || rubies.length >= 2)) {
    var merged = mergeJukugoRubies(run, null);
    if (merged) w = merged.getBoundingClientRect().width;
  }
  if (clone.parentNode) clone.parentNode.removeChild(clone);
  return w > 0 ? w : 0;
}

function isSkippableBetweenRubies(node) {
  if (!node) return false;
  if (node.nodeType === 3) return !String(node.nodeValue || '').replace(/\s+/g, '');
  if (node.nodeType !== 1) return true;
  return !!(node.classList && node.classList.contains('ts-gap'));
}

export function splitContiguousRubyRuns(rubies) {
  var runs = [];
  var cur = [];
  for (var i = 0; i < rubies.length; i++) {
    if (!cur.length) {
      cur.push(rubies[i]);
      continue;
    }
    var prev = cur[cur.length - 1];
    var ok = prev.parentNode && prev.parentNode === rubies[i].parentNode;
    var node = prev.nextSibling;
    while (ok && node && node !== rubies[i]) {
      if (!isSkippableBetweenRubies(node)) ok = false;
      node = node.nextSibling;
    }
    if (ok && node === rubies[i]) cur.push(rubies[i]);
    else {
      runs.push(cur);
      cur = [rubies[i]];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

export function jukugoRubiesOnLine(wrapper, items, startIndex, endIndex, charItemRubyEl, name) {
  var seen = [];
  if (!wrapper) return seen;
  for (var i = startIndex; i <= endIndex && i < items.length; i++) {
    if (items[i].type !== 'char') continue;
    var ruby = charItemRubyEl(items[i]);
    if (!ruby) continue;
    if (closestJukugoWrapper(ruby, name) !== wrapper) continue;
    if (seen.indexOf(ruby) >= 0) continue;
    seen.push(ruby);
  }
  return seen;
}

export function contiguousJukugoRunOnLine(ruby, items, startIndex, endIndex, charItemRubyEl, name) {
  if (!ruby) return [];
  var wrap = closestJukugoWrapper(ruby, name);
  var all = jukugoRubiesOnLine(wrap, items, startIndex, endIndex, charItemRubyEl, name);
  var runs = splitContiguousRubyRuns(all);
  for (var i = 0; i < runs.length; i++) {
    if (runs[i].indexOf(ruby) >= 0) return runs[i];
  }
  return all.indexOf(ruby) >= 0 ? [ruby] : [];
}

export function mergeJukugoRubies(rubies, name) {
  if (!rubies || !rubies.length) return null;
  var pairs = collectRubyPairs(rubies);
  if (pairs.length < 2 && rubies.length < 2) return null;
  var first = rubies[0];
  if (!first || !first.parentNode) return null;
  var doc = first.ownerDocument;
  var merged = doc.createElement('ruby');
  if (name) {
    merged.setAttribute(name, '');
    merged.setAttribute('data-ts-jukugo-name', name);
  }
  merged.setAttribute('data-ts-jukugo-merged', '1');
  writeStoredPairs(merged, pairs, rubies.length === 1 ? 'B' : 'A');
  fillGroupRuby(merged, pairs, doc);
  first.parentNode.insertBefore(merged, first);
  var node = first;
  var last = rubies[rubies.length - 1];
  var drop = [];
  while (node) {
    var next = node.nextSibling;
    if (rubies.indexOf(node) >= 0 || isSkippableBetweenRubies(node)) drop.push(node);
    if (node === last) break;
    node = next;
  }
  for (var j = 0; j < drop.length; j++) {
    if (drop[j].parentNode) drop[j].parentNode.removeChild(drop[j]);
  }
  return merged;
}

function unmergeOne(ruby) {
  var parent = ruby.parentNode;
  if (!parent) return;
  var doc = ruby.ownerDocument;
  var pairs = readStoredPairs(ruby) || rubyPairs(ruby);
  var from = ruby.getAttribute('data-ts-jukugo-from');
  var name = ruby.getAttribute('data-ts-jukugo-name');
  if (!name && ruby.hasAttribute('jukugo')) name = 'jukugo';
  if (pairs.length < 2) {
    ruby.removeAttribute('data-ts-jukugo-merged');
    ruby.removeAttribute('data-ts-jukugo-pairs');
    ruby.removeAttribute('data-ts-jukugo-from');
    return;
  }
  if (from === 'B') {
    var b = doc.createElement('ruby');
    if (name) b.setAttribute(name, '');
    appendPairsToRuby(b, pairs, doc);
    parent.insertBefore(b, ruby);
    parent.removeChild(ruby);
    return;
  }
  for (var i = 0; i < pairs.length; i++) {
    var r = doc.createElement('ruby');
    if (pairs[i].base) r.appendChild(doc.createTextNode(pairs[i].base));
    var rt = doc.createElement('rt');
    rt.textContent = pairs[i].rt;
    r.appendChild(rt);
    parent.insertBefore(r, ruby);
  }
  parent.removeChild(ruby);
}

export function unmergeJukugoInBlock(block) {
  if (!block || !block.querySelectorAll) return;
  var merged = block.querySelectorAll('ruby[data-ts-jukugo-merged]');
  for (var i = 0; i < merged.length; i++) unmergeOne(merged[i]);
}

function canMergeRun(run) {
  if (!run || !run.length) return false;
  if (run[0].getAttribute && run[0].getAttribute('data-ts-jukugo-merged') === '1') return false;
  if (run.length >= 2) return true;
  return rubyPairs(run[0]).length >= 2 && !isAlreadyGroupRuby(run[0]);
}

function collectJukugoMergeRuns(layout, L, hangOpts, charItemRubyEl) {
  if (!layout || !layout.items || L < 0 || L >= layout.heads.length) return [];
  var name = resolveJukugoName(hangOpts);
  var range = lineItemBounds(layout.items, layout.heads, L);
  var wrappers = [];
  var lone = [];
  for (var i = range.startIndex; i <= range.endIndex && i < layout.items.length; i++) {
    if (layout.items[i].type !== 'char') continue;
    var ruby = charItemRubyEl(layout.items[i]);
    if (!ruby) continue;
    if (ruby.getAttribute && ruby.getAttribute('data-ts-jukugo-merged') === '1') continue;
    if (isAlreadyGroupRuby(ruby)) continue;
    var wrap = closestJukugoWrapper(ruby, name);
    if (wrap) {
      if (wrappers.indexOf(wrap) >= 0) continue;
      wrappers.push(wrap);
      continue;
    }
    if (rubyHasJukugoAttr(ruby, name) && rubyPairs(ruby).length >= 2) {
      if (lone.indexOf(ruby) >= 0) continue;
      lone.push(ruby);
    }
  }
  var out = [];
  for (var w = 0; w < wrappers.length; w++) {
    var all = jukugoRubiesOnLine(
      wrappers[w],
      layout.items,
      range.startIndex,
      range.endIndex,
      charItemRubyEl,
      name,
    );
    var runs = splitContiguousRubyRuns(all);
    for (var r = 0; r < runs.length; r++) {
      if (canMergeRun(runs[r])) out.push(runs[r]);
    }
  }
  for (var b = 0; b < lone.length; b++) {
    if (canMergeRun([lone[b]])) out.push([lone[b]]);
  }
  return out;
}

export function willMergeJukugoOnLine(layout, L, hangOpts, charItemRubyEl) {
  return collectJukugoMergeRuns(layout, L, hangOpts, charItemRubyEl).length > 0;
}

export function mergeJukugoOnLine(layout, L, hangOpts, charItemRubyEl) {
  var runs = collectJukugoMergeRuns(layout, L, hangOpts, charItemRubyEl);
  var name = resolveJukugoName(hangOpts);
  var n = 0;
  for (var r = 0; r < runs.length; r++) {
    if (mergeJukugoRubies(runs[r], name)) n += 1;
  }
  return n;
}
