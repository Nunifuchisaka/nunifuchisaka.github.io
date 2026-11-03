// トップページのキービジュアル用。バナー写真の上に「写実的な霜（凍結）」を WebGL2 で描く（ライブラリなし）。
//
// 見た目の方針：磨りガラスのように曇ったガラスに、雪の結晶（六角の樹枝状結晶）が大小さまざまに付いている。
// - 結晶は六角対称の線画を距離関数で描き、大・中・小の3層を格子に散らす。周りは細かい粒の磨りガラス
// - 霜の高さから法線を求め、屈折（下の写真がゆがむ）・拡散（白濁して彩度が落ちる）・鏡面ハイライト・フレネルで陰影をつける
// - 凍る前線の先には細い結晶の腕が伸び、溶けた直後の縁には水の膜と小さな水滴、厚い所には微細なきらめき
// - 開いたときは縁と内側のいくつかの核から雪の結晶が先に付いて周りが曇るように広がり、なぞった所が溶け、離すとゆっくり凍り直す。放置中は吐息のような溶け跡が漂う
//
// 仕組み：
// - 結晶の構造（雪の結晶・磨りガラスの粒・凍り始める核・きらめき用の乱数）は変化しないので、最初に一度だけテクスチャに描いておく（structure パス）
// - 「溶け具合」を低解像度のテクスチャ（ピンポン2枚）に持ち、毎フレーム「凍り直す／ポインタで溶かす」を更新する（mask パス）
// - 本描画では、写真・溶け具合・結晶構造から霜の高さを求め、近傍との差で法線を出して陰影をつける（main パス）
// - WebGL2 が無い／画像が読めないときは何もしない（下の <img> がそのまま見える）
// - 画面外・タブ非表示では止める。「視差効果を減らす」設定では、入場・漂い・きらめきを止め、なぞった時だけ動く

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// 共通のノイズ関数
const NOISE = `
float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), u.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + 1.0), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
// 尾根状のノイズ。細い筋が枝分かれして伸びる（霜の結晶の腕）
float ridged(vec2 p) {
  float a = 0.55, s = 0.0, w = 1.0;
  for (int i = 0; i < 6; i++) {
    float n = 1.0 - abs(2.0 * vnoise(p) - 1.0);
    n = n * n;
    s += a * n * w;
    w = clamp(n * 1.6, 0.0, 1.0);
    p = p * 2.1 + vec2(3.1, 1.3);
    a *= 0.5;
  }
  return s;
}`;

// 結晶構造。r = 結晶の模様（0〜1。磨りガラスの粒 ＋ 雪の結晶）, g = 凍り始める核からの遠さ（0〜1）, b = きらめき用の乱数
// 雪の結晶は六角対称。角度を 30 度の扇に折りたたみ、主脈・側枝（と隣の主脈から出る鏡像の枝）・中心の六角板への距離で線を引く
const STRUCT_FRAG = `#version 300 es
precision highp float;
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
${NOISE}
vec2 hash2(vec2 p) {
  float h = hash1(p);
  return vec2(h, hash1(p + h + 7.13));
}
mat2 rot(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * t);
}
// 雪の結晶ひとつ。q は結晶の中心からの座標、r は半径、seed で形が変わる
float flake(vec2 q, float r, float seed) {
  float d = length(q) / r;
  if (d > 1.05) return 0.0;
  float a = atan(q.y, q.x);
  const float sec = 1.0471976; // 60 度
  a = mod(a, sec);
  a = abs(a - sec * 0.5);        // 0〜30 度の扇に折りたたむ
  vec2 p = d * vec2(cos(a), sin(a));
  vec2 dir60 = vec2(0.5, 0.8660254);

  float best = segDist(p, vec2(0.0), vec2(1.0, 0.0)); // 主脈
  float nb = 2.0 + floor(hash1(vec2(seed, 2.0)) * 3.0); // 側枝 2〜4 本
  for (int i = 0; i < 4; i++) {
    if (float(i) >= nb) break;
    float fi = float(i);
    float t0 = 0.28 + 0.66 * (fi + 0.2 + hash1(vec2(seed, 3.0 + fi)) * 0.6) / nb; // 付け根の位置
    float len = (0.62 - 0.45 * t0) * (0.6 + 0.8 * hash1(vec2(seed, 7.0 + fi)));   // 外側ほど短い
    vec2 a0 = vec2(t0, 0.0);
    float db = segDist(p, a0, a0 + dir60 * len);
    vec2 a1 = dir60 * t0;                                   // 隣の主脈から出る枝の鏡像
    float dc = segDist(p, a1, a1 + vec2(len, 0.0));
    best = min(best, min(db, dc));
  }
  float plateR = 0.1 + hash1(vec2(seed, 5.0)) * 0.22;        // 中心の六角板（輪郭）
  best = min(best, segDist(p, vec2(plateR, 0.0), plateR * dir60));

  float w = (0.028 + hash1(vec2(seed, 1.0)) * 0.03) * (1.25 - 0.6 * d); // 先に行くほど細い
  float line = 1.0 - smoothstep(w, w + 0.025, best);
  float core = 1.0 - smoothstep(plateR * 0.35, plateR * 0.5, d);         // 中心の小さな芯
  return max(line, core * 0.8) * smoothstep(1.04, 0.96, d);
}
// 格子のマスごとに結晶を1つ置く層。マスからはみ出さない位置に置くので隣のマスは見なくてよい
float flakeLayer(vec2 p, float cell, float r, float prob, float seedOff) {
  vec2 g = floor(p / cell);
  float h = hash1(g + seedOff);
  if (h > prob) return 0.0;
  float rr = r * (0.7 + 0.6 * hash1(g + seedOff + 5.0));
  vec2 center = (g + 0.5 + (hash2(g + seedOff + 3.0) - 0.5) * (1.0 - 2.0 * rr / cell)) * cell;
  vec2 q = rot(hash1(g + seedOff + 9.0) * 6.2831) * (p - center);
  return flake(q, rr, h * 97.0 + seedOff);
}
void main() {
  vec2 p = vUv * vec2(uAspect, 1.0);

  // 磨りガラスの粒
  float micro = vnoise(p * 260.0) * 0.5 + vnoise(p * 520.0) * 0.5;

  // 雪の結晶。大・中・小
  float large = flakeLayer(p + 0.37, 0.32, 0.115, 0.4, 1.0);
  float medium = flakeLayer(p + 1.91, 0.16, 0.055, 0.4, 2.0);
  float small = flakeLayer(p + 5.13, 0.09, 0.032, 0.35, 3.0);
  float flakes = max(large, max(medium * 0.85, small * 0.6));

  float s = clamp(0.3 + (micro - 0.5) * 0.14 + flakes * 0.8, 0.0, 1.0);

  // 凍り始める核。低周波ノイズの高い所から広がる
  float low = fbm(p * 1.4 + 11.0);
  float far = clamp((0.7 - low) * 3.5, 0.0, 1.0);

  float glint = hash1(floor(p * 640.0));
  outColor = vec4(s, far, glint, 1.0);
}`;

// 溶け具合の更新。r = 溶け具合（0 = 凍っている, 1 = 溶けている）
// ポインタは「前フレームの位置→今の位置」の線分として扱い、加算ではなく max で穴をあける（速く動かしても塊が並ばない）
const MASK_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec4 uSeg;      // 前フレームの位置 xy と今の位置 zw（0〜1）
uniform float uSegOn;   // 1 で溶かす
uniform float uSegRadius;
uniform vec3 uDrift;    // 吐息の位置 xy と有効 z。薄く溶かす
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
  m = max(m, (1.0 - smoothstep(uSegRadius * 0.45, uSegRadius, r)) * uSegOn);
  float rd = length((vUv - uDrift.xy) * s);
  m = max(m, (1.0 - smoothstep(uDriftRadius * 0.2, uDriftRadius, rd)) * 0.6 * uDrift.z);
  outColor = vec4(clamp(m, 0.0, 1.0), 0.0, 0.0, 1.0);
}`;

const MAIN_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uMask;
uniform sampler2D uStruct;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform float uIntro;    // 0〜1。凍りついていく進み具合
uniform float uMotion;   // 1 で動く、0 で止める（視差効果を減らす設定）
in vec2 vUv;
out vec4 outColor;
${NOISE}

// 凍っている割合（0〜1）。溶け具合と入場から決め、結晶の模様で前線をぎざぎざにする
float coverage(vec2 uv, float s, float low) {
  float melt = texture(uMask, uv).r;
  float edge = min(min(uv.x, 1.0 - uv.x) * uAspect, min(uv.y, 1.0 - uv.y));
  float fromEdge = uIntro * 1.7 - 0.2 - edge * 1.5;            // 縁から
  float fromSeed = uIntro * 1.7 - 0.45 - low * 1.9;             // 内側の核から放射状に
  float front = max(fromEdge, fromSeed) + (s - 0.5) * 0.4;
  float intro = smoothstep(-0.18, 0.18, front);
  return (1.0 - melt) * intro;
}

// 霜の厚み（0〜1）
float thickness(float c, float s) {
  return smoothstep(0.08, 0.9, c * 1.45 - 0.5 * (1.0 - s));
}

// 霜の高さ。法線を出すために近傍でも評価する
float heightAt(vec2 uv) {
  vec3 st = texture(uStruct, uv).rgb;
  float c = coverage(uv, st.r, st.g);
  float t = thickness(c, st.r);
  return t * (0.25 + 0.75 * st.r);
}

// 水滴。溶けた直後の縁に残る小さな粒
vec3 droplets(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  float d = 8.0;
  vec2 off = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = vec2(hash1(n + g), hash1(n + g + 17.0));
      if (h.x < 0.55) continue;                     // 水滴が無いマスも多い
      vec2 r = g + mix(vec2(0.25), vec2(0.75), h) - f;
      float dd = dot(r, r);
      if (dd < d) { d = dd; off = r; }
    }
  }
  float rad = 0.22;
  float drop = 1.0 - smoothstep(rad * 0.7, rad, sqrt(d));
  return vec3(drop, off);
}

void main() {
  vec2 uv = vUv;
  vec2 sx = vec2(uAspect, 1.0);
  vec3 st = texture(uStruct, uv).rgb;
  float s = st.r;
  float c = coverage(uv, s, st.g);
  float t = thickness(c, s);
  float h = t * (0.25 + 0.75 * s);

  // 法線（ピクセル単位の高さの差から）
  vec2 e = 1.5 / uRes;
  float hx = heightAt(uv + vec2(e.x, 0.0));
  float hy = heightAt(uv + vec2(0.0, e.y));
  float bump = 10.0;
  vec3 n = normalize(vec3((h - hx) * bump, (h - hy) * bump, 1.0));

  // 屈折と拡散。厚いほど下の写真はゆがんでぼやけ、白濁して彩度が落ちる
  vec2 refr = n.xy * 0.03 * t;
  float lod = t * 4.2 + c * 0.5;
  vec3 col = textureLod(uImage, uv + refr * vec2(1.0, uAspect), lod).rgb;
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = mix(col, vec3(lum), t * 0.5);
  vec3 ice = vec3(0.87, 0.93, 0.98);
  col = mix(col, ice, t * (0.42 + 0.38 * s));

  // 陰影。光はやや左上から。動くときは光の向きがごくゆっくり揺れる
  float sway = sin(uTime * 0.15) * 0.12 * uMotion;
  vec3 L = normalize(vec3(-0.45 + sway, 0.55, 0.7));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = 0.78 + 0.22 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0) * t;
  float fres = pow(1.0 - max(n.z, 0.0), 2.2) * t;
  col = col * diff + vec3(1.0) * spec * 0.6 + ice * fres * 0.45;

  // 曇る前に先に付く雪の結晶（薄い所に白く浮かぶ）
  float arms = pow(s, 5.0) * smoothstep(0.0, 0.3, c) * (1.0 - t) * 0.85;
  col = mix(col, vec3(0.97, 0.99, 1.0), arms);

  // 溶けた直後の縁：水の膜で少し暗く透け、小さな水滴が残る
  float wet = smoothstep(0.0, 0.1, c) * (1.0 - smoothstep(0.1, 0.42, c));
  vec3 dr = droplets(uv * sx * 110.0);
  float drop = dr.x * wet;
  vec3 dn = normalize(vec3(dr.yz * 2.5, 1.0));
  vec3 under = textureLod(uImage, uv - dr.yz * 0.012, 0.0).rgb;
  col = mix(col, under * 0.92, drop);
  col += vec3(1.0) * pow(max(dot(reflect(-L, dn), V), 0.0), 40.0) * drop * 0.7;
  col *= 1.0 - 0.14 * wet * (1.0 - drop);

  // きらめき。厚い所の結晶の面が、ごく小さく光る
  float g = st.b;
  float flick = 0.5 + 0.5 * sin(uTime * 2.2 * uMotion + g * 62.8);
  float glint = step(0.991, g * 0.88 + flick * 0.12) * t * smoothstep(0.45, 0.9, s);
  col += glint * 0.9;

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

// 描画先つきのテクスチャ
const renderTarget = (gl, w, h) => {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo, w, h };
};

const init = (host) => {
  const src = host.dataset.frostSrc;
  if (!src || host.querySelector("canvas")) return;

  const canvas = document.createElement("canvas");
  canvas.className = "profile_2__canvas";
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return;

  const structProg = program(gl, STRUCT_FRAG);
  const maskProg = program(gl, MASK_FRAG);
  const mainProg = program(gl, MAIN_FRAG);
  if (!structProg || !maskProg || !mainProg) return;

  // 画面いっぱいの三角形
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // 結晶構造（固定）と溶け具合（低解像度・ピンポン）
  const ASPECT = 3;
  const structure = renderTarget(gl, 1536, 512);
  const masks = [renderTarget(gl, 384, 128), renderTarget(gl, 384, 128)];
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let cur = 0;

  const u = (prog, name) => gl.getUniformLocation(prog, name);
  const U = {
    sAspect: u(structProg, "uAspect"),
    mPrev: u(maskProg, "uPrev"), mSeg: u(maskProg, "uSeg"), mSegOn: u(maskProg, "uSegOn"), mSegRadius: u(maskProg, "uSegRadius"),
    mDrift: u(maskProg, "uDrift"), mDriftRadius: u(maskProg, "uDriftRadius"),
    mDt: u(maskProg, "uDt"), mRefreeze: u(maskProg, "uRefreeze"), mAspect: u(maskProg, "uAspect"),
    image: u(mainProg, "uImage"), mask: u(mainProg, "uMask"), struct: u(mainProg, "uStruct"),
    res: u(mainProg, "uRes"), aspect: u(mainProg, "uAspect"),
    time: u(mainProg, "uTime"), intro: u(mainProg, "uIntro"), motion: u(mainProg, "uMotion"),
  };

  // 結晶構造を一度だけ描く
  gl.bindFramebuffer(gl.FRAMEBUFFER, structure.fbo);
  gl.viewport(0, 0, structure.w, structure.h);
  gl.useProgram(structProg);
  gl.uniform1f(U.sAspect, ASPECT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // 写真のテクスチャ（ぼかし用にミップマップを作る）
  const imageTex = gl.createTexture();
  const image = new Image();
  image.decoding = "async";

  // 状態
  let width = 0, height = 0, aspect = ASPECT;
  let running = false, visible = true, raf = 0;
  let last = 0, time = 0, intro = 0, started = 0;
  let lastPointerAt = -1e9;
  const pointer = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, on: 0 };
  const drift = { x: 0.5, y: 0.5, on: 0 };
  const reduced = () => prefersReduced.matches;
  const INTRO_SEC = 4.0;

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
    gl.viewport(0, 0, masks[next].w, masks[next].h);
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
    gl.uniform1f(U.mRefreeze, 0.07);
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
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, structure.tex);
    gl.uniform1i(U.struct, 2);
    gl.uniform2f(U.res, width, height);
    gl.uniform1f(U.aspect, aspect);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.intro, intro);
    gl.uniform1f(U.motion, reduced() ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    resize();

    const motion = !reduced();
    // 入場。視差効果を減らす設定では最初から凍っている。開始時刻は初回描画（結晶構造の生成で時間がかかる）の後に取る
    const t = started ? (now - started) / 1000 : 0;
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
    if (!started) started = performance.now();

    // 動かし続ける条件：動きあり、または最近ポインタが触れた（溶け跡が凍り直すまで）
    const keep = motion || (now - lastPointerAt) / 1000 < 18;
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
