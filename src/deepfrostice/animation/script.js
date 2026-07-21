// テーマ切替：クリック/Enter/Spaceで data-theme を切替え、localStorage に記憶。
// aria-pressed で現在テーマを支援技術へ伝える。初期テーマは head 側で確定済み。
(function () {
  var KEY = 'dfiAnimTheme';
  var root = document.documentElement;
  var btns = Array.prototype.slice.call(document.querySelectorAll('.theme-btn'));

  function sync() {
    var current = root.getAttribute('data-theme');
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-value') === current ? 'true' : 'false');
    });
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var value = b.getAttribute('data-theme-value');
      root.setAttribute('data-theme', value);
      try { localStorage.setItem(KEY, value); } catch (e) {}
      sync();
    });
  });

  sync();
})();
