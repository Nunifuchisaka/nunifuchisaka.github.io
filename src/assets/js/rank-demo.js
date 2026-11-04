// アバター改変の解説「パフォーマンスランクと軽量化」の、動かして確かめる図（.js_rank_demo）
// 項目ごとに、上限（Excellent・Good・Medium・Poor）と比べてランクを決める。どれも超えたら Very Poor
// アバター全体のランクは、いちばん低い項目のランクになる
// 文言・区切り（data-sep）・つなぎ（data-join）・数の書き方（data-num-locale）は、日英それぞれのページの data 属性から受け取る
document.querySelectorAll(".js_rank_demo").forEach((demo) => {
  const t = demo.dataset;
  const ranks = t.ranks.split(",");
  const inputs = [...demo.querySelectorAll(".js_rank_input")];
  const list = demo.querySelector(".js_rank_list");
  const why = demo.querySelector(".js_rank_why");
  const result = demo.querySelector(".js_rank_result");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  const format = (n) => n.toLocaleString(t.numLocale);
  // 上限を超えない、いちばん良いランクの番号（0 = Excellent … 4 = Very Poor）
  const rankOf = (value, limits) => {
    const i = limits.findIndex((limit) => value <= limit);
    return i === -1 ? limits.length : i;
  };

  const update = () => {
    const items = inputs.map((input) => {
      const value = Number(input.value);
      const limits = input.dataset.limits.split(",").map(Number);
      const unit = input.dataset.unit || "";
      const output = demo.querySelector(`output[for="${input.id}"]`);
      output.value = format(value) + unit;
      return { name: input.dataset.name, text: format(value) + unit, rank: rankOf(value, limits) };
    });
    const worst = Math.max(...items.map((item) => item.rank));

    list.replaceChildren(...items.map((item) => {
      const li = document.createElement("li");
      const line = `${item.name}${t.sep}${item.text} → ${ranks[item.rank]}`;
      if (item.rank === worst && worst > 0) {
        const strong = document.createElement("strong");
        strong.textContent = `${line}${t.mark}`;
        li.append(strong);
      } else {
        li.textContent = line;
      }
      return li;
    }));

    const names = items.filter((item) => item.rank === worst).map((item) => item.name).join(t.join);
    why.textContent = worst === 0 ? t.allBest : fill(t.why, { i: names, r: ranks[worst] });
    result.textContent = fill(worst <= 2 ? t.ok : t.ng, { r: ranks[worst] });
    result.classList.toggle("is_ok", worst <= 2);
    result.classList.toggle("is_ng", worst > 2);
  };

  inputs.forEach((input) => input.addEventListener("input", update));
  update();
});
