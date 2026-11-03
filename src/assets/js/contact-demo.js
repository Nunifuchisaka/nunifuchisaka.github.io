// アバター改変の解説「触ると反応するギミック」の、動かして確かめる図（.js_contact_demo）
// 頭の上の球の Receiver（半径 data-radius cm）に、手（Sender）が近づく。
// 手の表面から球の中心までの距離 d が半径より小さく、Allow Self・Allow Others で許されていれば「触れている」。
// Constant は触れている間 1、OnEnter は触れ始めた1回だけ 1、Proximity は中心に近いほど 1 に近づく（1 - d / 半径）
document.querySelectorAll(".js_contact_demo").forEach((demo) => {
  const t = demo.dataset;
  const radius = Number(t.radius);
  const slider = demo.querySelector(".js_contact_distance");
  const output = demo.querySelector(`output[for="${slider.id}"]`);
  const whos = demo.querySelectorAll(".js_contact_who");
  const allowSelf = demo.querySelector(".js_contact_self");
  const allowOthers = demo.querySelector(".js_contact_others");
  const types = demo.querySelectorAll(".js_contact_type");
  const zone = demo.querySelector(".js_contact_zone");
  const hand = demo.querySelector(".js_contact_hand");
  const blush = demo.querySelector(".js_contact_blush");
  const num = demo.querySelector(".js_contact_num");
  const why = demo.querySelector(".js_contact_why");
  const result = demo.querySelector(".js_contact_result");
  const value = (type) => demo.querySelector(`.js_contact_value[data-type="${type}"]`);
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  // 1 cm を図の 3 として描く。手の円の半径は 8
  const SCALE = 3;
  const HAND_R = 8;
  const CENTER_X = 60;
  // 直前に触れていたか（OnEnter は、触れていない → 触れている に変わったときだけ 1）
  let wasTouching = false;

  const update = () => {
    const d = Number(slider.value);
    output.value = String(d);
    const self = [...whos].find((r) => r.checked).value === "self";
    const type = [...types].find((r) => r.checked).value;
    const inside = d < radius;
    const allowed = self ? allowSelf.checked : allowOthers.checked;
    const touching = inside && allowed;
    const entered = touching && !wasTouching;
    wasTouching = touching;
    const proximity = touching ? Math.round((1 - d / radius) * 100) / 100 : 0;

    hand.setAttribute("cx", String(CENTER_X + d * SCALE + HAND_R));
    zone.setAttribute("fill-opacity", touching ? "0.35" : "0.12");
    value("constant").textContent = touching ? "1" : "0";
    value("onenter").textContent = entered ? t.enter : "0";
    value("proximity").textContent = proximity.toFixed(2);

    if (!inside) why.textContent = fill(t.whyOut, { r: radius });
    else if (!allowed) why.textContent = self ? t.whySelf : t.whyOthers;
    else why.textContent = fill(t.whyIn, { p: proximity.toFixed(2) });

    // 頬染めの値。Constant は 0 か 100、Proximity は Motion Time で 0〜100、OnEnter は1フレームだけなので見えない
    let b = 0;
    if (type === "constant") b = touching ? 100 : 0;
    else if (type === "proximity") b = Math.round(proximity * 100);
    blush.setAttribute("opacity", (b / 100).toFixed(2));
    num.textContent = String(b);
    if (type === "onenter" && touching) result.textContent = t.resultEnter;
    else result.textContent = b > 0 ? fill(t.resultOn, { b }) : t.resultOff;
    result.classList.toggle("is_ok", b > 0);
    result.classList.toggle("is_ng", b === 0);
  };

  slider.addEventListener("input", update);
  [...whos, ...types].forEach((radio) => radio.addEventListener("change", update));
  [allowSelf, allowOthers].forEach((box) => box.addEventListener("change", update));
  update();
});
