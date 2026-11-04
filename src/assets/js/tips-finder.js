// アバター改変の解説の一覧「困りごとから探す」（.js_tips_finder）の絞り込み
// 種類（ラジオボタン）と、ことば（空白で区切ると、すべてを含むものだけ）で、困りごとの行を残す。
// JS が無いときは、絞り込みの部品を出さず（hidden のまま）、すべての行を並べる
// ひらがなで打つと、読みの辞書（_yomi.js）で本文の漢字の書き方にも当てる（例：「ひょうじょう」で「表情」）
import { foldKana, loadYomi, yomiAlts } from "./_yomi.js";

document.querySelectorAll(".js_tips_finder").forEach((finder) => {
  const controls = finder.querySelector(".js_tips_controls");
  const search = finder.querySelector(".js_tips_search");
  const groups = finder.querySelectorAll(".js_tips_group");
  const boxes = finder.querySelectorAll(".js_tips_group_box");
  const count = finder.querySelector(".js_tips_count");
  const none = finder.querySelector(".js_tips_none");
  // 全角と半角、大文字と小文字、ひらがなとカタカナ、「ー」のあるなしの違いを無視して比べる
  const normalize = foldKana;
  boxes.forEach((box) => {
    box.querySelectorAll(".js_tips_item").forEach((item) => {
      item.dataset.text = normalize(item.textContent);
    });
  });

  const update = () => {
    const group = [...groups].find((r) => r.checked).value;
    const words = search.value.split(/\s+/).map(normalize).filter(Boolean).map((w) => [w, ...yomiAlts(w).map(normalize)]);
    let shown = 0;
    boxes.forEach((box) => {
      let inBox = 0;
      box.querySelectorAll(".js_tips_item").forEach((item) => {
        const hit = (group === "all" || box.dataset.group === group) && words.every((alts) => alts.some((a) => item.dataset.text.includes(a)));
        item.hidden = !hit;
        if (hit) inBox += 1;
      });
      box.hidden = inBox === 0;
      shown += inBox;
    });
    count.textContent = finder.dataset.count.replace("{n}", String(shown));
    none.hidden = shown !== 0;
  };

  groups.forEach((r) => r.addEventListener("change", update));
  search.addEventListener("input", update);
  search.addEventListener("focus", () => loadYomi().then(update), { once: true });
  if (search.value) loadYomi().then(update);
  controls.hidden = false;
  update();
});
