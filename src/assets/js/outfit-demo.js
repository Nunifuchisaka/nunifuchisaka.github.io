// アバター改変の解説「衣装を着せる」の、動かして確かめる図（.js_outfit_demo）
// 体の縮小の値を、Body に直接入れるか、衣装の MA Shape Changer で入れるかで、服を着たとき・脱いだときの体の形を比べる
// Body に直接入れた値は、服を脱いでも残る。Shape Changer は衣装がオンのときだけ値を入れ、脱ぐと 0 に戻る
document.querySelectorAll(".js_outfit_demo").forEach((demo) => {
  const t = demo.dataset;
  const slider = demo.querySelector(".js_outfit_shrink");
  const output = demo.querySelector(`output[for="${slider.id}"]`);
  const modes = demo.querySelectorAll(".js_outfit_mode");
  const why = demo.querySelector(".js_outfit_why");
  // 服の幅（半分）。体の幅（半分）がこれを超えると、服から突き抜ける
  const CLOTH_RX = 46;
  const bodyRx = (s) => 52 - 14 * (s / 100);

  const draw = (wear, s) => {
    demo.querySelectorAll(`.js_outfit_figure[data-wear="${wear}"] .js_outfit_body`).forEach((el) => {
      el.setAttribute("rx", bodyRx(s).toFixed(2));
    });
    demo.querySelector(`.js_outfit_num[data-wear="${wear}"]`).textContent = String(s);
  };

  const setResult = (wear, text, ok) => {
    const el = demo.querySelector(`.js_outfit_result[data-wear="${wear}"]`);
    el.textContent = text;
    el.classList.toggle("is_ok", ok);
    el.classList.toggle("is_ng", !ok);
  };

  const update = () => {
    const s = Number(slider.value);
    output.value = String(s);
    const changer = [...modes].find((r) => r.checked).value === "changer";
    // 服を着ているときは、どちらの縮め方でも値が入る。脱いだときは、Shape Changer なら 0 に戻る
    const worn = s;
    const nude = changer ? 0 : s;
    draw("1", worn);
    draw("0", nude);
    why.textContent = changer ? t.whyChanger : t.whyUnity;
    const poke = bodyRx(worn) > CLOTH_RX;
    setResult("1", poke ? t.poke : t.fit, !poke);
    setResult("0", nude > 0 ? t.stay.replace("{v}", String(nude)) : t.back, nude === 0);
  };

  slider.addEventListener("input", update);
  modes.forEach((radio) => radio.addEventListener("change", update));
  update();
});
