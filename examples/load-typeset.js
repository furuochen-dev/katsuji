/**
 * Demo：默认加载 src/katsuji/modules；?bundle=1 用 dist/katsuji.js
 */
(function () {
  var useBundle = /(?:^|[?&])bundle(?:=1)?(?:&|$)/.test(location.search);

  function done() {
    window.__katsujiReady = true;
    window.dispatchEvent(new Event('katsuji-ready'));
  }

  if (useBundle) {
    var s = document.createElement('script');
    s.src = '../dist/katsuji.js';
    s.onload = done;
    s.onerror = function () {
      console.error('[demo] failed to load dist/katsuji.js — run npm run build');
    };
    document.head.appendChild(s);
    return;
  }

  fetch('../src/katsuji/modules/manifest.json')
    .then(function (r) {
      if (!r.ok) throw new Error('manifest.json missing — run: npm run demo');
      return r.json();
    })
    .then(function (files) {
      var base = '../src/katsuji/modules/';
      var i = 0;
      function next() {
        if (i >= files.length) {
          done();
          return;
        }
        var el = document.createElement('script');
        el.src = base + files[i++];
        el.onload = next;
        el.onerror = function () {
          console.error('[demo] failed to load', el.src);
        };
        document.head.appendChild(el);
      }
      next();
    })
    .catch(function (err) {
      console.error('[demo]', err.message || err);
    });
})();
