document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("js-lang-select");

  if (!select) return;

  select.addEventListener("change", () => {
    const value = select.value;
    const path = window.location.pathname;
    const isEn = path === "/en" || path.startsWith("/en/");

    if (value === "en" && !isEn) {
      window.location.href = "/en" + path;
    } else if (value === "ja" && isEn) {
      window.location.href = path.replace(/^\/en/, "") || "/";
    }
  });
});
