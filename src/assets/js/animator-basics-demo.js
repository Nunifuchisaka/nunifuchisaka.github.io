// アバター改変の解説「Animator のしくみ」の、動かして確かめる図（.js_ab_demo）
// メニューの Toggle が Expression Parameters の Hat を変える。Animator のパラメーター名が同じなら Animator の値も変わり、
// トランジションの条件で Hat_OFF と Hat_ON のどちらかのステートに入る。レイヤーの Weight が 1 なら、ステートのクリップが帽子の Is Active を書く。
// Weight が 0 なら、ステートは動いていても値は使われず、帽子はアップロードしたときのまま（オフ）
document.querySelectorAll(".js_ab_demo").forEach((demo) => {
  const t = demo.dataset;
  const menu = demo.querySelector(".js_ab_menu");
  const weights = demo.querySelectorAll(".js_ab_weight");
  const names = demo.querySelectorAll(".js_ab_name");
  const why = (step) => demo.querySelector(`.js_ab_why[data-step="${step}"]`);
  const result = demo.querySelector(".js_ab_result");
  const stateName = demo.querySelector(".js_ab_state_name");
  const active = demo.querySelector(".js_ab_active");
  const hat = demo.querySelector(".js_ab_hat");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  // Expression Parameters 側の名前。Animator 側の名前がこれと同じときだけ、メニューの値が届く
  const EXPRESSION_NAME = "Hat";
  // アップロードしたときの帽子の Is Active（Unity でオフにしてある）
  const UPLOADED = 0;

  const drawStates = (current) => {
    demo.querySelectorAll(".js_ab_state").forEach((rect) => {
      rect.setAttribute("fill", rect.dataset.state === current ? "#4c7fbf" : "#e9edf2");
    });
    demo.querySelectorAll(".js_ab_state_text").forEach((text) => {
      text.setAttribute("fill", text.dataset.state === current ? "#fff" : "#1b2a3a");
    });
  };

  const update = () => {
    const menuOn = menu.checked;
    const weight = [...weights].find((r) => r.checked).value;
    const name = [...names].find((r) => r.checked).value;
    const linked = name === EXPRESSION_NAME;
    // Animator 側の値。名前が違うと、メニューの値は届かず、Default の false のまま
    const animValue = linked ? menuOn : false;
    const state = animValue ? "on" : "off";
    const stateText = animValue ? "Hat_ON" : "Hat_OFF";
    const clipValue = animValue ? 1 : 0;
    const shown = weight === "1" ? clipValue : UPLOADED;

    why("param").textContent = fill(linked ? t.paramSame : t.paramDiff, { v: String(menuOn) });
    why("state").textContent = fill(animValue ? t.stateOn : t.stateOff, { n: name });
    why("write").textContent = fill(weight === "1" ? t.write1 : t.write0, { s: stateText, a: clipValue });

    demo.querySelectorAll(".js_ab_cond").forEach((text) => {
      text.textContent = `${name} = ${text.dataset.value}`;
    });
    drawStates(state);
    stateName.textContent = stateText;
    active.textContent = String(shown);
    hat.setAttribute("opacity", String(shown));

    const ok = (shown === 1) === menuOn;
    result.textContent = fill(ok ? t.ok : t.ng, { x: shown === 1 ? t.shown : t.hidden });
    result.classList.toggle("is_ok", ok);
    result.classList.toggle("is_ng", !ok);
  };

  menu.addEventListener("change", update);
  weights.forEach((radio) => radio.addEventListener("change", update));
  names.forEach((radio) => radio.addEventListener("change", update));
  update();
});
