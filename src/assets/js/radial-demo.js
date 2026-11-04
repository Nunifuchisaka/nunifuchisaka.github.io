// アバター改変の解説「段階で切り替える・少しずつ変えるギミック」の、動かして確かめる図（.js_radial_demo）
// Radial Puppet の値 v（0〜1）を Motion Time に使い、60 フレームのクリップの v × 60 フレーム目の値を見せる。
// クリップは 0 フレーム目と終わりにキーがあり、図では、キーの間を一定の割合で変わるものとして描く。
// 大きさは Scale 0.5 → 1.5、色は青 → 赤。ほかの人に届く値は、8 bit（1/127 ずつ）に丸めた目安
document.querySelectorAll(".js_radial_demo").forEach((demo) => {
  const t = demo.dataset;
  const frames = Number(t.frames);
  const slider = demo.querySelector(".js_radial_value");
  const output = demo.querySelector(`output[for="${slider.id}"]`);
  const modes = demo.querySelectorAll(".js_radial_mode");
  const hat = demo.querySelector(".js_radial_hat");
  const fills = demo.querySelectorAll(".js_radial_fill");
  const head = demo.querySelector(".js_radial_head");
  const frameText = demo.querySelector(".js_radial_frame");
  const why = demo.querySelector(".js_radial_why");
  const result = demo.querySelector(".js_radial_result");
  const remoteText = demo.querySelector(".js_radial_remote");
  const fill = (text, values) => text.replace(/\{(\w)\}/g, (m, key) => (key in values ? String(values[key]) : m));
  const blue = [111, 143, 214];
  const red = [214, 95, 95];
  const mix = (v) => `rgb(${blue.map((b, i) => Math.round(b + (red[i] - b) * v)).join(" ")})`;

  const update = () => {
    const v = Number(slider.value) / 100;
    const mode = [...modes].find((r) => r.checked).value;
    const f = Math.round(v * frames);
    output.value = v.toFixed(2);

    const scale = mode === "size" ? 0.5 + v : 1;
    const color = mode === "color" ? mix(v) : mix(0);
    hat.setAttribute("transform", `translate(60 40) scale(${scale.toFixed(2)}) translate(-60 -40)`);
    fills.forEach((el) => el.setAttribute("fill", color));

    const x = (16 + 128 * v).toFixed(1);
    head.setAttribute("x1", x);
    head.setAttribute("x2", x);
    frameText.setAttribute("x", x);
    frameText.textContent = String(f);

    why.textContent = fill(t.frame, { v: v.toFixed(2), f });
    result.textContent = mode === "size"
      ? fill(t.size, { x: scale.toFixed(2) })
      : fill(t.color, { p: Math.round(v * 100) });
    remoteText.textContent = fill(t.remote, { r: (Math.round(v * 127) / 127).toFixed(3) });
  };

  slider.addEventListener("input", update);
  modes.forEach((radio) => radio.addEventListener("change", update));
  update();
});
