// アバター改変の解説「Unity と VRChat で見た目が変わる」の、動かして確かめる図（.js_shape_demo）
// いまのステートのクリップに eye_smile があれば、その値を書く。
// 無ければ、Write Defaults が ON なら既定値（Unity で入れた値）を書き、OFF なら何も書かない（直前の値が残る）
document.querySelectorAll(".js_shape_demo").forEach((demo) => {
  const t = demo.dataset;
  const slider = demo.querySelector(".js_shape_unity");
  const output = demo.querySelector(`output[for="${slider.id}"]`);
  const wds = demo.querySelectorAll(".js_shape_wd");
  const states = demo.querySelectorAll(".js_shape_state");
  const why = demo.querySelector(".js_shape_why");
  const result = demo.querySelector(".js_shape_result");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  // 直前に書かれた値（Write Defaults が OFF のときに残る値）。読み込んだときは Unity の値
  let last = Number(slider.value);

  const drawFace = (name, v) => {
    const r = v / 100;
    demo.querySelectorAll(`.js_shape_face[data-face="${name}"] .js_eye_open`).forEach((el) => {
      el.setAttribute("ry", Math.max(0.4, 8 * (1 - r)).toFixed(2));
    });
    demo.querySelectorAll(`.js_shape_face[data-face="${name}"] .js_eye_smile`).forEach((el) => {
      el.setAttribute("opacity", r.toFixed(2));
    });
    demo.querySelector(`.js_shape_num[data-face="${name}"]`).textContent = String(v);
  };

  const update = () => {
    const u = Number(slider.value);
    output.value = String(u);
    const wdOn = [...wds].find((r) => r.checked).value === "on";
    const clip = [...states].find((r) => r.checked).dataset.clip;
    let v;
    if (clip !== "") {
      v = Number(clip);
      why.textContent = fill(t.clip, { c: v });
    } else if (wdOn) {
      v = u;
      why.textContent = fill(t.on, { u });
    } else {
      v = last;
      why.textContent = fill(t.off, { v });
    }
    last = v;
    drawFace("unity", u);
    drawFace("vrc", v);
    const same = v === u;
    result.textContent = same ? t.same : fill(t.diff, { u, v });
    result.classList.toggle("is_ok", same);
    result.classList.toggle("is_ng", !same);
  };

  // 値を変えたら、アップロードし直したものとして、直前の値も Unity の値から数え直す
  slider.addEventListener("input", () => { last = Number(slider.value); update(); });
  wds.forEach((radio) => radio.addEventListener("change", update));
  states.forEach((radio) => radio.addEventListener("change", update));
  update();
});
