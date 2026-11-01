// トップページ用。
// 1. X の写真（.js_aspect）は縦横比がビルド時に分からないので、読み込んだら --ar に入れてトリミングせずに並べる
// 2. YouTube（.js_youtube）は最初はサムネイルだけを出し、押したらその場で再生する（プライバシー強化モードの埋め込み）

const initAspect = () => {
  document.querySelectorAll(".js_aspect").forEach((item) => {
    const img = item.querySelector("img");
    if (!img) return;
    const apply = () => {
      if (img.naturalWidth && img.naturalHeight) {
        item.style.setProperty("--ar", (img.naturalWidth / img.naturalHeight).toFixed(4));
      }
    };
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  });
};

const initYoutube = () => {
  document.querySelectorAll(".js_youtube").forEach((player) => {
    const poster = player.querySelector("a");
    if (!poster) return;
    poster.addEventListener("click", (event) => {
      // 新しいタブで開く操作（Ctrl・中ボタンなど）はそのまま YouTube へ
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(player.dataset.id)}?autoplay=1&rel=0`;
      iframe.title = poster.getAttribute("aria-label") || "YouTube";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      player.replaceChildren(iframe);
      iframe.focus();
    });
  });
};

initAspect();
initYoutube();
