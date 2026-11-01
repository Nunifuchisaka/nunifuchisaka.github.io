// トップページのライト/ダーク手動切り替え。
// 初期値は OS の設定（prefers-color-scheme）。ボタンで切り替えると html[data-theme] に保存値を当てる。
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".js_theme_toggle");
  if (!buttons.length) return;

  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const currentTheme = () => root.getAttribute("data-theme") || (media.matches ? "dark" : "light");

  // ボタンには「押すと何になるか」を書く
  const render = () => {
    const isDark = currentTheme() === "dark";
    buttons.forEach((button) => {
      button.textContent = isDark ? button.dataset.labelLight : button.dataset.labelDark;
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        // 保存できない環境では、このページを開いている間だけ切り替える
      }
      render();
    });
  });

  media.addEventListener("change", render);
  render();
});
