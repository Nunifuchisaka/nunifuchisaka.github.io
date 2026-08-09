// 初期テーマ確定（FOUC防止）。localStorage → prefers-color-scheme の順に解決してからbodyを描く
(function () {
  var KEY = 'pwSiteTheme';
  var theme = 'dark';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
