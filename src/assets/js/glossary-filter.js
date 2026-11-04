// VRChat 用語集（.js_glossary）の、ことばでの絞り込み
// 空白で区切ると、すべてを含む用語だけを残す。全角と半角、大文字と小文字、ひらがなとカタカナ、「ー」のあるなしの違いは無視する。
// 用語の読み（glossary.json の yomi）も data-text に入っているので、漢字の用語もひらがなで探せる
// JS が無いときは、絞り込みの部品を出さず（hidden のまま）、すべての用語を並べる
// 説明の文の漢字も、読みの辞書（_yomi.js）でひらがなから当てる
import { foldKana, loadYomi, yomiAlts } from "./_yomi.js";

document.querySelectorAll(".js_glossary").forEach((box) => {
  const controls = box.querySelector(".js_glossary_controls");
  const search = box.querySelector(".js_glossary_search");
  const count = box.querySelector(".js_glossary_count");
  const none = box.querySelector(".js_glossary_none");
  const cats = box.querySelectorAll(".js_glossary_cat");
  const normalize = foldKana;
  const items = [...box.querySelectorAll(".js_glossary_item")];
  items.forEach((item) => {
    item.dataset.text = normalize(item.dataset.text || item.textContent);
  });

  const update = () => {
    const words = search.value.split(/\s+/).map(normalize).filter(Boolean).map((w) => [w, ...yomiAlts(w).map(normalize)]);
    let shown = 0;
    items.forEach((item) => {
      const hit = words.every((alts) => alts.some((a) => item.dataset.text.includes(a)));
      item.hidden = !hit;
      if (hit) shown += 1;
    });
    cats.forEach((cat) => {
      cat.hidden = !cat.querySelector(".js_glossary_item:not([hidden])");
    });
    count.textContent = box.dataset.count.replace("{n}", String(shown));
    none.hidden = shown !== 0;
  };

  search.addEventListener("input", update);
  search.addEventListener("focus", () => loadYomi().then(update), { once: true });
  if (search.value) loadYomi().then(update);
  controls.hidden = false;
  update();
});
