// アバター改変の解説「ギミックが動かないとき」の、困りごとで原因の一覧を絞る部品（.js_debug_picker）
// 表の行（tr）の data-symptoms に、その行が当てはまる困りごとの id を空白区切りで書いておく。選んだ id を含む行だけを出す
// JS が無いときは、部品は hidden のまま隠れていて、表にはすべての行が出ている
document.querySelectorAll(".js_debug_picker").forEach((picker) => {
  const t = picker.dataset;
  const table = document.getElementById(t.target);
  if (!table) return;
  const rows = table.querySelectorAll("tbody tr");
  const radios = picker.querySelectorAll(".js_debug_symptom");
  const count = picker.querySelector(".js_debug_count");

  const update = () => {
    const value = [...radios].find((r) => r.checked).value;
    let n = 0;
    rows.forEach((row) => {
      const show = value === "all" || (row.dataset.symptoms || "").split(" ").includes(value);
      row.hidden = !show;
      if (show) n += 1;
    });
    count.textContent = (value === "all" ? t.all : t.some).replace("{n}", String(n));
  };

  radios.forEach((radio) => radio.addEventListener("change", update));
  picker.hidden = false;
  update();
});
