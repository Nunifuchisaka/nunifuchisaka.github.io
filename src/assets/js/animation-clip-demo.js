// アバター改変の解説「アニメーションを作る」の、動かして確かめる図（.js_clip_demo）
// Hat_ON のクリップには、帽子のパスが data-clip（Accessories/Hat）で書かれている。
// 帽子の名前と置いた場所から、いまのパスを作り、クリップのパスと同じかを比べる（大文字小文字も区別する）。
// 合えばクリップが帽子の Is Active を 1 と書き、合わなければ Animation ウィンドウの行が黄色で Missing! になり、帽子は出ない
document.querySelectorAll(".js_clip_demo").forEach((demo) => {
  const t = demo.dataset;
  const nameInput = demo.querySelector(".js_clip_name");
  const parents = demo.querySelectorAll(".js_clip_parent");
  const row = demo.querySelector(".js_clip_row");
  const now = demo.querySelector(".js_clip_now");
  const active = demo.querySelector(".js_clip_active");
  const hat = demo.querySelector(".js_clip_hat");
  const why = demo.querySelector(".js_clip_why");
  const result = demo.querySelector(".js_clip_result");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  // Animation ウィンドウの行の名前は、クリップのパスのいちばん下の名前（帽子の名前を変えても変わらない）
  const rowName = `${t.clip.split("/").pop()} : Is Active`;
  const COLOR_OK = "#d2d2d2";
  const COLOR_MISSING = "#f2c94c";

  const update = () => {
    const name = nameInput.value;
    const parent = [...parents].find((r) => r.checked).value;
    const path = parent + name;
    const found = name !== "" && path === t.clip;

    now.textContent = path;
    row.textContent = found ? rowName : `${rowName} (Missing!)`;
    row.setAttribute("fill", found ? COLOR_OK : COLOR_MISSING);
    // 見つからないときは何も書かれず、帽子はアップロードしたときのまま（オフ）
    active.textContent = found ? "1" : t.none;
    hat.setAttribute("opacity", found ? "1" : "0");

    why.textContent = name === "" ? t.empty : fill(t.why, { c: t.clip, p: path });
    result.textContent = found ? t.ok : t.ng;
    result.classList.toggle("is_ok", found);
    result.classList.toggle("is_ng", !found);
  };

  nameInput.addEventListener("input", update);
  parents.forEach((radio) => radio.addEventListener("change", update));
  update();
});
