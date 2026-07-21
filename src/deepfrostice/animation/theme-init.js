(function () {
  var KEY = 'dfiAnimTheme';
  var VALID = ['dark', 'light', 'sepia', 'contrast'];
  var theme = 'dark';
  try {
    var saved = localStorage.getItem(KEY);
    if (VALID.indexOf(saved) >= 0) {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      theme = 'light';
    }
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
