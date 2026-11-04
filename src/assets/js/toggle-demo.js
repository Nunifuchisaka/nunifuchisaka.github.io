// アバター改変の解説「メニューでオンオフするギミックを作る」の、動かして確かめる図（.js_toggle_demo）
// メニューの「帽子」がオンのとき、作り方のチェックに合わせて、自分とほかの人から帽子が見えるかを決める。
// パラメーター名が違えば HatOn は変わらない。Weight が 0 ならレイヤーは何も書かない。
// Synced でなければ、ほかの人には Default（false）のまま。Has Exit Time があれば、一拍遅れて切り替わる
document.querySelectorAll(".js_toggle_demo").forEach((demo) => {
  const t = demo.dataset;
  const menu = demo.querySelector(".js_toggle_menu");
  const checks = demo.querySelectorAll(".js_toggle_check");
  const why = demo.querySelector(".js_toggle_why");
  const result = demo.querySelector(".js_toggle_result");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  const LATE_MS = 700;
  let timer = 0;

  const isOn = (name) => [...checks].find((c) => c.dataset.check === name).checked;
  const drawHat = (face, shown) => {
    demo.querySelectorAll(`.js_toggle_face[data-face="${face}"] .js_toggle_hat`).forEach((el) => {
      el.setAttribute("opacity", shown ? "1" : "0");
    });
  };

  const update = () => {
    const on = menu.checked;
    const weight = isOn("weight");
    const name = isOn("name");
    const exit = isOn("exit");
    const synced = isOn("synced");
    let self = false;
    let other = false;
    const reasons = [];
    if (!on) {
      reasons.push(t.idle);
    } else if (!name) {
      reasons.push(t.nameNg);
    } else if (!weight) {
      reasons.push(t.weightNg);
    } else {
      self = true;
      other = synced;
      if (!synced) reasons.push(t.syncedNg);
      if (!exit) reasons.push(t.exitNg);
      if (!reasons.length) reasons.push(t.ok);
    }
    // 理由の文のつなぎ。英語のページは data-sep に空白を入れる（日本語は詰めてつなぐ）
    why.textContent = reasons.join(t.sep || "");
    result.textContent = fill(t.result, { s: self ? t.shown : t.hidden, o: other ? t.shown : t.hidden });
    result.classList.toggle("is_ok", on && self && other && exit);
    result.classList.toggle("is_ng", on && !(self && other && exit));

    // Has Exit Time があるときは、帽子の絵だけ一拍遅らせて切り替える
    window.clearTimeout(timer);
    const draw = () => {
      drawHat("self", self);
      drawHat("other", other);
    };
    if (on && !exit) {
      timer = window.setTimeout(draw, LATE_MS);
    } else {
      draw();
    }
  };

  menu.addEventListener("change", update);
  checks.forEach((c) => c.addEventListener("change", update));
  update();
});
