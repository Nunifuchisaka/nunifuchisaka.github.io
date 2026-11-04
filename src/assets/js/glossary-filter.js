// VRChat 用語集（.js_glossary）の、ことばでの絞り込み
// 空白で区切ると、すべてを含む用語だけを残す。全角と半角、大文字と小文字、ひらがなとカタカナの違いは無視する。
// JS が無いときは、絞り込みの部品を出さず（hidden のまま）、すべての用語を並べる
document.querySelectorAll(".js_glossary").forEach((box) => {
  const controls = box.querySelector(".js_glossary_controls");
  const search = box.querySelector(".js_glossary_search");
  const count = box.querySelector(".js_glossary_count");
  const none = box.querySelector(".js_glossary_none");
  const cats = box.querySelectorAll(".js_glossary_cat");
  const normalize = (text) => text.normalize("NFKC").toLowerCase().replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const items = [...box.querySelectorAll(".js_glossary_item")];
  items.forEach((item) => {
    item.dataset.text = normalize(item.dataset.text || item.textContent);
  });

  const update = () => {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let shown = 0;
    items.forEach((item) => {
      const hit = words.every((w) => item.dataset.text.includes(w));
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
  controls.hidden = false;
  update();
});
