// アバター改変の解説の本文の用語リンク（.term_2。_glossary_link.ejs が付ける）に、マウスを乗せたとき・キーボードで選んだときに、
// VRChat 用語集の短い説明（data-name・data-tip）を吹き出しで出す。
// - タッチでは出さない（押すと用語集へ飛ぶ）。JS が無いときも、リンクとして用語集へ飛べる
// - 吹き出しの上にもマウスを移せる（少し待ってから消す）。Esc・スクロールで消す
(() => {
  const terms = document.querySelectorAll(".term_2[data-tip]");
  if (!terms.length) return;

  const tip = document.createElement("div");
  tip.className = "tip_1";
  tip.id = "term-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  const name = document.createElement("strong");
  name.className = "tip_1__name";
  const text = document.createElement("span");
  text.className = "tip_1__text";
  tip.append(name, text);
  document.body.append(tip);

  const GAP = 8;
  const EDGE = 8;
  let current = null;
  let hideTimer = 0;

  // リンクが行をまたぐときは、最初の行の箱に合わせる
  const place = (el) => {
    const rect = el.getClientRects()[0] || el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    tip.style.left = "0px";
    tip.style.top = "0px";
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(Math.max(rect.left, EDGE), Math.max(EDGE, vw - w - EDGE));
    let top = rect.bottom + GAP;
    if (top + h > vh - EDGE && rect.top - GAP - h > EDGE) top = rect.top - GAP - h;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  };

  const show = (el) => {
    clearTimeout(hideTimer);
    if (current && current !== el) current.removeAttribute("aria-describedby");
    current = el;
    name.textContent = el.dataset.name;
    text.textContent = el.dataset.tip;
    tip.hidden = false;
    place(el);
    el.setAttribute("aria-describedby", tip.id);
  };

  const hide = () => {
    clearTimeout(hideTimer);
    tip.hidden = true;
    if (current) current.removeAttribute("aria-describedby");
    current = null;
  };

  const hideSoon = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 200);
  };

  terms.forEach((el) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "touch") show(el);
    });
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "touch") hideSoon();
    });
    el.addEventListener("focus", () => {
      if (el.matches(":focus-visible")) show(el);
    });
    el.addEventListener("blur", hide);
  });
  tip.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  tip.addEventListener("pointerleave", hideSoon);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) hide();
  });
  window.addEventListener("scroll", () => current && hide(), { passive: true });
  window.addEventListener("resize", () => current && hide());
})();
