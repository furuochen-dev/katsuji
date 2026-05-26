/**
 * 加载 dist/katsuji.js（需先 npm run build）
 */
(function () {
  var s = document.createElement('script');
  s.src = '../dist/katsuji.js';
  s.onload = function () {
    window.__katsujiReady = true;
    window.dispatchEvent(new Event('katsuji-ready'));
  };
  s.onerror = function () {
    console.error('[demo] failed to load ../dist/katsuji.js — run: npm run build');
  };
  document.head.appendChild(s);
})();
