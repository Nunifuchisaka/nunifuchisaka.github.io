// トップページのキービジュアル用。バナー写真の上に「アニメ調の霜」を WebGL2 で描く（ライブラリなし）。
//
// 見た目の方針：写実ではなくデフォルメ。
// - 氷は大きな結晶の破片（セル）に割れていて、破片ごとに平坦な2〜3階調のセル塗り
// - 溶ける境界は破片単位でパキッと剥がれ、境界には濃い青の輪郭線と内側の白いハイライト線（氷の線画）
// - 破片の継ぎ目に白い細線、厚い所に斜めの白いハイライト帯、ところどころに四芒星のキラッ
// - 開いたときは縁からギザギザに凍りつき、なぞった所が溶け、離すとゆっくり凍り直す。放置中は吐息のような溶け跡が漂う
//
// 仕組み：
// - 「溶け具合」を低解像度のテクスチャ（ピンポン2枚）に持ち、毎フレーム「凍り直す／ポインタで溶かす」を更新する
// - 本描画では、写真のテクスチャ・溶け具合・ボロノイ（セル）ノイズから、階調化した氷を合成する
// - WebGL2 が無い／画像が読めないときは何もしない（下の <img> がそのまま見える）
// - 画面外・タブ非表示では止める。「視差効果を減らす」設定では、入場・漂い・きらめきを止め、なぞった時だけ動く

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// 溶け具合の更新。r = 溶け具合（0 = 凍っている, 1 = 溶けている）
// ポインタは「前フレームの位置→今の位置」の線分として扱い、加算ではなく max で穴をあける（速く動かしても塊が並ばない）
const MASK_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec4 uSeg;      // 前フレームの位置 xy と今の位置 zw（0〜1）
uniform float uSegOn;   // 1 で溶かす
uniform float uSegRadius;
uniform vec3 uDrift;    // 吐息の位置 xy と有効 z。厚い層だけ溶かして薄い層を残す
uniform float uDriftRadius;
uniform float uDt;
uniform float uRefreeze;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * t);
}
void main() {
  float m = texture(uPrev, vUv).r;
  m -= uDt * uRefreeze;
  vec2 s = vec2(uAspect, 1.0);
  float r = segDist(vUv * s, uSeg.xy * s, uSeg.zw * s);
  m = max(m, (1.0 - smoothstep(uSegRadius * 0.4, uSegRadius, r)) * uSegOn);
  float rd = length((vUv - uDrift.xy) * s);
  m = max(m, (1.0 - smoothstep(uDriftRadius * 0.2, uDriftRadius, rd)) * 0.55 * uDrift.z);
  outColor = vec4(clamp(m, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const MAIN_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform float uIntro;    // 0〜1。縁から凍りついていく進み具合
uniform float uMotion;   // 1 で動く、0 で止める（視差効果を減らす設定）
uniform vec3 uTintThin;
uniform vec3 uTintThick;
uniform vec3 uLine;
in vec2 vUv;
out vec4 outColor;

float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash2(vec2 p) {
  float h = hash1(p);
  return vec2(h, hash1(p + h + 7.13));
}

// ボロノイ。戻り値：x = 最寄り中心までの距離, y = 2番目までの距離, zw = 最寄りセルの id
vec4 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = n + g; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec4(sqrt(d1), sqrt(d2), id);
}

// 四芒星。d はセル中心からの差、s は大きさ
float star(vec2 d, float s) {
  vec2 a = abs(d) / s;
  float h = (1.0 - smoothstep(0.0, 1.0, a.x)) * (1.0 - smoothstep(0.0, 0.12, a.y));
  float v = (1.0 - smoothstep(0.0, 1.0, a.y)) * (1.0 - smoothstep(0.0, 0.12, a.x));
  return pow(max(h, v), 2.0);
}

// 段差の境界に細い線を引く。x が t をまたぐ所に幅 px ピクセルの線
float band(float x, float t, float px) {
  float w = max(fwidth(x) * px, 1e-4); // 平坦な所で 0 になると smoothstep が未定義になるので下限を入れる
  return 1.0 - smoothstep(0.0, w, abs(x - t));
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * vec2(uAspect, 1.0);

  // 結晶の破片。大きめのセルで、アニメの氷らしく大ぶりに
  float scale = 7.0;
  vec4 vo = voronoi(p * scale + vec2(3.1, 1.7));
  vec2 id = vo.zw;
  float h = hash1(id + 0.5);
  vec2 center = (id + hash2(id)) / scale;
  float seam = 1.0 - smoothstep(0.0, 0.07, vo.y - vo.x); // 破片の継ぎ目

  // 凍り具合。溶け具合（マスク）と入場の両方から決め、破片ごとに少しずらして破片単位で剥がれるようにする
  float melt = texture(uMask, uv).r;
  float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  float front = uIntro * 1.5 - 0.3 - edge * 1.6 + (h - 0.5) * 0.35;
  float frozenIntro = smoothstep(-0.02, 0.02, front);
  float frozen = (1.0 - melt) * frozenIntro;
  float fz = frozen + (h - 0.5) * 0.3; // 破片ごとのずれ。大きいほど破片単位でパキッと剥がれる

  // 2段階の階調：厚い（fz > 0.62）／薄い（fz > 0.28）／溶けている
  float aa = max(fwidth(fz) * 1.2, 1e-4);
  float thick = smoothstep(0.62 - aa, 0.62 + aa, fz);
  float thin = smoothstep(0.28 - aa, 0.28 + aa, fz);

  // 写真。氷の下では破片ごとに少しずれて見える（面ごとの屈折）。厚い所はぼかす
  vec2 refr = (hash2(id + 2.0) - 0.5) * 0.022 * vec2(1.0, uAspect);
  vec3 photo = texture(uImage, uv).rgb;
  vec3 underThin = textureLod(uImage, uv + refr * 0.5, 1.5).rgb;
  vec3 underThick = textureLod(uImage, uv + refr, 2.5).rgb;

  // セル塗り。破片ごとに2階調
  float tone = step(0.5, hash1(id + 9.0)) * 0.08;
  vec3 thinCol = mix(underThin, uTintThin, 0.36) * (1.0 - tone * 0.5);
  vec3 thickCol = mix(underThick, uTintThick, 0.62) * (1.0 - tone);

  // 斜めのハイライト帯（厚い所だけ、ゆっくり流れる）
  float s1 = step(0.985, fract((p.x - p.y) * 0.9 + uTime * 0.02 * uMotion + h * 0.37));
  float s2 = step(0.992, fract((p.x - p.y) * 0.9 + 0.31 + uTime * 0.013 * uMotion));
  thickCol = mix(thickCol, vec3(1.0), (s1 + s2) * 0.5);

  vec3 col = photo;
  col = mix(col, thinCol, thin);
  col = mix(col, thickCol, thick);

  // 破片の継ぎ目（白い細線）
  col = mix(col, vec3(1.0), seam * (thin * 0.3 + thick * 0.4));

  // 氷の線画：段差の境界に濃い青の輪郭、そのすぐ内側に白いハイライト線
  float outline = band(fz, 0.28, 1.6); // 濃い線は氷と素の写真の境目だけ
  float rim = max(band(fz, 0.28 + aa * 3.0, 1.4), band(fz, 0.62, 1.2) * 0.7);
  col = mix(col, vec3(1.0), rim * thin * 0.9);
  col = mix(col, uLine, outline * 0.85);

  // キラッ（四芒星）。破片の中心あたりで、破片ごとに違うタイミングで瞬く
  float blink = pow(max(0.0, sin(uTime * 0.9 * uMotion + h * 6.2831)), 8.0);
  blink = mix(step(0.5, h) * 0.6, blink, uMotion);
  vec2 sd = (p - center) + (hash2(id + 4.0) - 0.5) * 0.06;
  float sp = star(sd, 0.036 + h * 0.02) * blink * step(0.3, h);
  col = mix(col, vec3(1.0), sp * thick);

  outColor = vec4(col, 1.0);
}`;

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const compile = (gl, type, src) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("frost: shader error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const program = (gl, frag) => {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("frost: link error", gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const init = (host) => {
  const src = host.dataset.frostSrc;
  if (!src || host.querySelector("canvas")) return;

  const canvas = document.createElement("canvas");
  canvas.className = "profile_2__canvas";
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return;

  const maskProg = program(gl, MASK_FRAG);
  const mainProg = program(gl, MAIN_FRAG);
  if (!maskProg || !mainProg) return;

  // 画面いっぱいの三角形
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // 溶け具合のテクスチャ（低解像度・固定サイズのピンポン）
  const MASK_W = 384, MASK_H = 128;
  const masks = [0, 1].map(() => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, MASK_W, MASK_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let cur = 0;

  const u = (prog, name) => gl.getUniformLocation(prog, name);
  const U = {
    mPrev: u(maskProg, "uPrev"), mSeg: u(maskProg, "uSeg"), mSegOn: u(maskProg, "uSegOn"), mSegRadius: u(maskProg, "uSegRadius"),
    mDrift: u(maskProg, "uDrift"), mDriftRadius: u(maskProg, "uDriftRadius"),
    mDt: u(maskProg, "uDt"), mRefreeze: u(maskProg, "uRefreeze"), mAspect: u(maskProg, "uAspect"),
    image: u(mainProg, "uImage"), mask: u(mainProg, "uMask"), res: u(mainProg, "uRes"), aspect: u(mainProg, "uAspect"),
    time: u(mainProg, "uTime"), intro: u(mainProg, "uIntro"), motion: u(mainProg, "uMotion"),
    tintThin: u(mainProg, "uTintThin"), tintThick: u(mainProg, "uTintThick"), line: u(mainProg, "uLine"),
  };

  // 写真のテクスチャ（ぼかし用にミップマップを作る）
  const imageTex = gl.createTexture();
  const image = new Image();
  image.decoding = "async";

  // 状態
  let width = 0, height = 0, aspect = 3;
  let running = false, visible = true, raf = 0;
  let last = 0, time = 0, intro = 0, started = 0;
  let lastPointerAt = -1e9;
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, on: 0 };
  const drift = { x: 0.5, y: 0.5, on: 0 };
  const reduced = () => prefersReduced.matches;
  const INTRO_SEC = 3.0;

  const resize = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.min(Math.round(rect.width * dpr), 1600);
    const hgt = Math.round(w * rect.height / rect.width);
    if (w === width && hgt === height) return;
    width = w; height = hgt; aspect = w / hgt;
    canvas.width = w; canvas.height = hgt;
  };

  const stepMask = (dt) => {
    const next = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, masks[next].fbo);
    gl.viewport(0, 0, MASK_W, MASK_H);
    gl.useProgram(maskProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, masks[cur].tex);
    gl.uniform1i(U.mPrev, 0);
    gl.uniform4f(U.mSeg, pointer.px, pointer.py, pointer.x, pointer.y);
    gl.uniform1f(U.mSegOn, pointer.on);
    gl.uniform1f(U.mSegRadius, 0.15);
    gl.uniform3f(U.mDrift, drift.x, drift.y, drift.on);
    gl.uniform1f(U.mDriftRadius, 0.14);
    gl.uniform1f(U.mDt, dt);
    gl.uniform1f(U.mRefreeze, 0.09);
    gl.uniform1f(U.mAspect, aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = next;
    pointer.px = pointer.x;
    pointer.py = pointer.y;
  };

  const draw = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(mainProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, imageTex);
    gl.uniform1i(U.image, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, masks[cur].tex);
    gl.uniform1i(U.mask, 1);
    gl.uniform2f(U.res, width, height);
    gl.uniform1f(U.aspect, aspect);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.intro, intro);
    gl.uniform1f(U.motion, reduced() ? 0 : 1);
    gl.uniform3fv(U.tintThin, hexToRgb("#cfe8f6"));
    gl.uniform3fv(U.tintThick, hexToRgb("#eaf6fb"));
    gl.uniform3fv(U.line, hexToRgb("#3b6d92"));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    resize();

    const motion = !reduced();
    // 入場。視差効果を減らす設定では最初から凍っている
    if (!started) started = now;
    const t = (now - started) / 1000;
    intro = motion ? Math.min(1, t / INTRO_SEC) : 1;
    intro = 1 - (1 - intro) * (1 - intro); // ease-out

    // 放置中の「吐息」。しばらくポインタが無いとき、ゆっくり漂う弱い溶け跡
    const idle = (now - lastPointerAt) / 1000 > 3 && intro >= 1 && motion;
    drift.on = idle ? 1 : 0;
    if (idle) {
      drift.x = 0.5 + 0.36 * Math.sin(time * 0.21);
      drift.y = 0.5 + 0.30 * Math.sin(time * 0.33 + 1.4);
    }

    stepMask(dt);
    draw();

    // 動かし続ける条件：動きあり、または最近ポインタが触れた（溶け跡が凍り直すまで）
    const keep = motion || (now - lastPointerAt) / 1000 < 14;
    if (running && visible && !document.hidden && keep) raf = requestAnimationFrame(frame);
    else last = 0;
  };

  const kick = () => {
    if (!running || raf || !visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
  };

  // ポインタ。縦スクロールの邪魔をしないよう touch-action は CSS で pan-y にしてある
  const toUv = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - rect.left) / rect.width;
    pointer.y = 1 - (event.clientY - rect.top) / rect.height;
  };
  const onMove = (event) => {
    toUv(event);
    if (!pointer.on) { pointer.px = pointer.x; pointer.py = pointer.y; }
    pointer.on = 1;
    lastPointerAt = performance.now();
    kick();
  };
  const onEnd = () => { pointer.on = 0; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onMove);
  canvas.addEventListener("pointerup", onEnd);
  canvas.addEventListener("pointerleave", onEnd);
  canvas.addEventListener("pointercancel", onEnd);

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) kick();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
  prefersReduced.addEventListener("change", kick);
  window.addEventListener("resize", kick);

  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, imageTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    resize();
    running = true;
    io.observe(canvas);
    kick();
  };
  image.onerror = () => { /* 読めなければ何もしない（<img> のまま） */ };
  image.src = src;

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    running = false;
    canvas.remove();
  });
};

document.querySelectorAll(".js_frost").forEach(init);
