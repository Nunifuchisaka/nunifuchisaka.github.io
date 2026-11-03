// アバター改変の解説「ハンドサインで表情を変える」の、動かして確かめる図（.js_gesture_demo）
// 左手と右手のレイヤーは、どちらも顔の同じ BlendShape を書く。下のレイヤーが書いた値が勝つ。
// 上のレイヤーの Neutral は、いつもの顔を書く。下のレイヤーの Neutral は、表情を書かない（pass）か、すべて 0 と書く（reset）
document.querySelectorAll(".js_gesture_demo").forEach((demo) => {
  const t = demo.dataset;
  const selects = { left: demo.querySelector(".js_gesture_left"), right: demo.querySelector(".js_gesture_right") };
  const orders = demo.querySelectorAll(".js_gesture_order");
  const neutrals = demo.querySelectorAll(".js_gesture_neutral");
  const why = demo.querySelector(".js_gesture_why");
  const result = demo.querySelector(".js_gesture_result");
  const hands = { left: t.handLeft, right: t.handRight };
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  const NEUTRAL = "neutral";

  // いま選んでいるハンドサイン（番号、絵の名前、表情の名前）
  const pick = (hand) => {
    const option = selects[hand].selectedOptions[0];
    return { no: Number(option.value), expr: option.dataset.expr, face: option.dataset.face };
  };

  // 顔の絵を切り替える。dim は「表情を書かない」レイヤーの薄い表示
  const drawFace = (name, expr, dim) => {
    const box = demo.querySelector(`.js_gesture_face[data-face="${name}"]`);
    box.querySelectorAll("[data-expr]").forEach((g) => {
      g.setAttribute("display", g.dataset.expr === expr ? "inline" : "none");
    });
    box.querySelector(".js_gesture_dim").setAttribute("opacity", dim ? "0.35" : "1");
  };

  const update = () => {
    const lower = [...orders].find((r) => r.checked).value;
    const upper = lower === "right" ? "left" : "right";
    const neutralMode = [...neutrals].find((r) => r.checked).value;
    const g = { [upper]: pick(upper), [lower]: pick(lower) };
    const neutralFace = selects[upper].querySelector('option[value="0"]').dataset.face;

    // それぞれのレイヤーが書くもの。null は「表情を書かない」
    const writes = {
      [upper]: g[upper],
      [lower]: g[lower].no !== 0 ? g[lower] : (neutralMode === "pass" ? null : { no: 0, expr: NEUTRAL, face: neutralFace }),
    };
    ["left", "right"].forEach((hand) => {
      demo.querySelector(`.js_gesture_who[data-face="${hand}"]`).textContent = hands[hand] + t.layer + (hand === lower ? t.lower : t.upper);
      const w = writes[hand];
      drawFace(hand, w ? w.expr : NEUTRAL, !w);
      demo.querySelector(`.js_gesture_num[data-face="${hand}"]`).textContent = w ? w.face : t.pass;
    });

    // 下のレイヤーが書いていれば、その値が見える。書いていなければ、上のレイヤーの値が見える
    const names = { l: hands[lower], u: hands[upper] };
    let view;
    let who;
    let text;
    let ok = true;
    if (g[lower].no !== 0) {
      view = g[lower];
      who = lower;
      text = fill(t.whyLower, { ...names, e: view.face });
      if (g[upper].no !== 0) text += fill(t.whyHidden, { ...names, h: g[upper].face });
    } else if (neutralMode === "pass") {
      view = g[upper];
      who = upper;
      text = fill(t.whyPass, { ...names, e: view.face });
    } else {
      view = writes[lower];
      who = lower;
      text = fill(t.whyReset, names);
      ok = g[upper].no === 0;
    }
    drawFace("view", view.expr, false);
    why.textContent = text;
    result.textContent = ok ? fill(t.ok, { e: view.face, w: hands[who] }) : fill(t.ng, { ...names, e: view.face });
    result.classList.toggle("is_ok", ok);
    result.classList.toggle("is_ng", !ok);
  };

  Object.values(selects).forEach((select) => select.addEventListener("change", update));
  orders.forEach((radio) => radio.addEventListener("change", update));
  neutrals.forEach((radio) => radio.addEventListener("change", update));
  update();
});
