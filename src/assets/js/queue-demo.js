// アバター改変の解説「Render Queue」の、動かして確かめる図（.js_queue_demo）
// 数字の小さい方から描く。同じ数字なら、カメラから中心が遠い方から描く。
// パーツは水面より手前にあるので、水面が先なら正しく、パーツが先なら水面に塗られておかしく見える
document.querySelectorAll(".js_queue_demo").forEach((demo) => {
  const isEn = document.documentElement.lang === "en";
  const t = demo.dataset;
  const inputs = demo.querySelectorAll(".js_queue_input");
  const nears = demo.querySelectorAll(".js_queue_near");
  const order = demo.querySelector(".js_queue_order");
  const why = demo.querySelector(".js_queue_why");
  const result = demo.querySelector(".js_queue_result");
  const layers = { part: demo.querySelector(".js_queue_part"), water: demo.querySelector(".js_queue_water") };
  const paren = (n) => (isEn ? ` (${n})` : `（${n}）`);

  const update = () => {
    const queue = {};
    inputs.forEach((input) => {
      queue[input.dataset.target] = Number(input.value);
      const output = input.closest(".demo_1__range").querySelector("output");
      if (output) output.value = input.value;
    });
    const near = [...nears].find((r) => r.checked).value;
    let drawn;
    if (queue.part !== queue.water) {
      drawn = queue.part < queue.water ? ["part", "water"] : ["water", "part"];
      why.textContent = t.byNumber;
    } else {
      // 同じ数字なら、遠い方（近くない方）を先に描く
      drawn = near === "part" ? ["water", "part"] : ["part", "water"];
      why.textContent = t.tie;
    }
    order.innerHTML = "";
    drawn.forEach((key) => {
      const li = document.createElement("li");
      li.textContent = t[key] + paren(queue[key]);
      order.append(li);
    });
    // 後から描いた方を上に重ねる
    drawn.forEach((key, i) => { layers[key].style.zIndex = String(i + 1); });
    const ok = drawn[0] === "water";
    result.textContent = ok ? t.ok : t.ng;
    result.classList.toggle("is_ok", ok);
    result.classList.toggle("is_ng", !ok);
    demo.classList.toggle("is_ng", !ok);
  };

  inputs.forEach((input) => input.addEventListener("input", update));
  nears.forEach((radio) => radio.addEventListener("change", update));
  update();
});
