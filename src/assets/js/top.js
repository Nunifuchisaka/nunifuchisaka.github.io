// トップページ「六花の記録」。
// 案内写真を六角形に切り、古い順に中心から外へ並べて、一つの雪の結晶（六花）を組み上げる。
// 読み込み時に一度だけ、日付の順に結晶が育つ。写真に触れると日付が出て、クリックで写真ビューアが開く。
// 写真は webpack が作るアトラス（assets/img/guide-atlas.webp）1枚から読む。
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  MathUtils,
  Matrix4,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

const FOV = 20;
const CAMERA_Z = 10;
const GROW_MS = 2800;
const TILE_GAP = 0.9; // マスに対する写真の大きさ（隙間が霜の筋になる）
const HOVER_SCALE = 3.2;
const TILT = 0.14; // ポインターに合わせて傾ける最大角（rad）

// ---- 結晶の形（六角格子の軸座標 q, r） ----

// 60度回す
const rotate = ([q, r]) => [-r, q + r];
const rotateTimes = (cell, times) => {
  let out = cell;
  for (let i = 0; i < times; i++) out = rotate(out);
  return out;
};

// 一本の枝（0度方向）のマスを、中心からの距離順に作る。
// 主軸 k に対し、偶数の k から左右 60 度に側枝を伸ばす（長さは k に比例）。
const buildBranch = (length) => {
  const cells = [];
  for (let k = 1; k <= length; k++) {
    cells.push({ cell: [k, 0], dist: k, order: 0 });
    if (k >= 4 && k % 2 === 0) {
      const side = Math.floor(k * 0.45);
      for (let j = 1; j <= side; j++) {
        cells.push({ cell: [k, j], dist: k + j, order: j * 2 - 1 });
        cells.push({ cell: [k + j, -j], dist: k + j, order: j * 2 });
      }
    }
  }
  return cells;
};

// 必要な枚数ぶんのマスを、育つ順（＝日付順）に返す。先頭は中心。
const buildFlake = (count) => {
  let length = 1;
  while (1 + buildBranch(length).length * 6 < count) length++;
  const placements = [];
  buildBranch(length).forEach((entry) => {
    for (let arm = 0; arm < 6; arm++) {
      placements.push({ cell: rotateTimes(entry.cell, arm), dist: entry.dist, order: entry.order, arm });
    }
  });
  placements.sort((a, b) => a.dist - b.dist || a.order - b.order || a.arm - b.arm);
  return [[0, 0], ...placements.map((p) => p.cell)].slice(0, count);
};

// 尖った頂点が上下に来る六角形（外接円の半径 1）の中心座標
const toXY = ([q, r]) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];

// ---- シェーダー ----

const vertexShader = /* glsl */ `
  attribute vec2 aTile;
  attribute float aBirth;
  attribute float aIndex;
  uniform float uProgress;
  uniform float uHover;
  varying vec2 vUv;
  varying vec2 vTile;
  varying float vAppear;
  varying float vHover;

  void main() {
    float appear = smoothstep(aBirth, aBirth + 0.12, uProgress);
    float hover = 1.0 - step(0.5, abs(aIndex - uHover));
    vec3 p = position * max(appear, 0.001) * mix(1.0, ${HOVER_SCALE.toFixed(2)}, hover);
    vec4 local = instanceMatrix * vec4(p, 1.0);
    local.z += hover * 0.6;
    gl_Position = projectionMatrix * modelViewMatrix * local;
    vUv = uv;
    vTile = aTile;
    vAppear = appear;
    vHover = hover;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform vec3 uIce;
  varying vec2 vUv;
  varying vec2 vTile;
  varying float vAppear;
  varying float vHover;

  void main() {
    // 六角形の内側か（尖りが上下・外接円の半径 1）
    vec2 p = (vUv - 0.5) * vec2(1.7320508, 2.0);
    vec2 a = abs(p);
    float edge = 1.0 - (a.y + a.x * 0.5773503);
    float aa = fwidth(edge);
    float alpha = smoothstep(0.0, aa * 1.5, edge);
    if (alpha <= 0.0) discard;

    // アトラスの 1 マス（正方形）から、六角形の外接矩形ぶんを読む
    vec2 tileUv = vec2(0.5 + p.x * 0.5, 0.5 + p.y * 0.5) * 0.94 + 0.03;
    vec2 atlasUv = vec2(
      (vTile.x + tileUv.x) / uGrid.x,
      1.0 - (vTile.y + (1.0 - tileUv.y)) / uGrid.y
    );
    vec3 photo = texture2D(uAtlas, atlasUv).rgb;

    // 現れる途中は氷の色から写真へ澄んでいく。縁には薄く霜を残す
    vec3 color = mix(uIce, photo, smoothstep(0.55, 1.0, vAppear));
    float rim = 1.0 - smoothstep(0.0, 0.14, edge);
    color = mix(color, uIce, rim * 0.6 * (1.0 - vHover));

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

// ---- 本体 ----

const init = (stage) => {
  const mount = stage.querySelector(".js_flake_canvas");
  const dateEl = stage.querySelector(".js_flake_date");
  const dataEl = stage.querySelector(".js_flake_data");
  if (!mount || !dataEl) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch {
    return;
  }
  const photos = data.photos || [];
  if (!photos.length) return;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    stage.classList.add("is_unsupported");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, CAMERA_Z);

  // 配置
  const cells = buildFlake(photos.length);
  const centers = cells.map(toXY);
  const extentX = Math.max(...centers.map(([x]) => Math.abs(x))) + 1;
  const extentY = Math.max(...centers.map(([, y]) => Math.abs(y))) + 1;
  const rows = Math.ceil(photos.length / data.cols);

  const geometry = new PlaneGeometry(Math.sqrt(3), 2);
  const tiles = new Float32Array(photos.length * 2);
  const births = new Float32Array(photos.length);
  const indices = new Float32Array(photos.length);
  photos.forEach((photo, i) => {
    tiles[i * 2] = i % data.cols;
    tiles[i * 2 + 1] = Math.floor(i / data.cols);
    births[i] = (photos.length > 1 ? i / (photos.length - 1) : 0) * 0.88;
    indices[i] = i;
  });
  geometry.setAttribute("aTile", new InstancedBufferAttribute(tiles, 2));
  geometry.setAttribute("aBirth", new InstancedBufferAttribute(births, 1));
  geometry.setAttribute("aIndex", new InstancedBufferAttribute(indices, 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAtlas: { value: null },
      uGrid: { value: new Vector2(data.cols, rows) },
      uIce: { value: new Color("#c9dce6") },
      uProgress: { value: 0 },
      uHover: { value: -1 },
    },
    alphaToCoverage: true,
  });

  const mesh = new InstancedMesh(geometry, material, photos.length);
  const matrix = new Matrix4();
  centers.forEach(([x, y], i) => {
    matrix.makeTranslation(x, y, 0);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  // 大きさ合わせ：結晶全体が画面の枠に収まるよう、1マスの大きさ（mesh.scale）を決める
  const resize = () => {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const visibleHeight = 2 * CAMERA_Z * Math.tan(MathUtils.degToRad(FOV / 2));
    const visibleWidth = visibleHeight * camera.aspect;
    const scale = Math.min((visibleWidth * 0.48) / extentX, (visibleHeight * 0.49) / extentY);
    mesh.scale.set(scale * TILE_GAP, scale * TILE_GAP, scale * TILE_GAP);
    // 位置は格子の間隔で決め、写真だけを少し小さく描く
    centers.forEach(([x, y], i) => {
      matrix.makeTranslation(x / TILE_GAP, y / TILE_GAP, 0);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    requestRender();
  };

  // ---- ポインター ----
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const plane = new Plane();
  const hit = new Vector3();
  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let hovered = -1;

  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    mesh.updateMatrixWorld();
    plane.setFromNormalAndCoplanarPoint(
      new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion),
      mesh.position,
    );
    if (!raycaster.ray.intersectPlane(plane, hit)) return -1;
    mesh.worldToLocal(hit);
    const lx = hit.x * TILE_GAP;
    const ly = hit.y * TILE_GAP;
    let best = -1;
    let bestDist = 0.95 * 0.95;
    centers.forEach(([x, y], i) => {
      const d = (x - lx) ** 2 + (y - ly) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const showDate = (index, event) => {
    if (index < 0) {
      dateEl.classList.remove("is_visible");
      return;
    }
    dateEl.textContent = photos[index].date;
    const rect = stage.getBoundingClientRect();
    dateEl.style.setProperty("--x", `${event.clientX - rect.left}px`);
    dateEl.style.setProperty("--y", `${event.clientY - rect.top}px`);
    dateEl.classList.add("is_visible");
  };

  const setHover = (index) => {
    if (index === hovered) return;
    hovered = index;
    material.uniforms.uHover.value = index;
    canvas.style.cursor = index >= 0 ? "pointer" : "";
    requestRender();
  };

  canvas.addEventListener("pointermove", (event) => {
    if (!reduceMotion.matches) {
      const rect = canvas.getBoundingClientRect();
      tilt.targetY = (((event.clientX - rect.left) / rect.width) * 2 - 1) * TILT;
      tilt.targetX = (((event.clientY - rect.top) / rect.height) * 2 - 1) * TILT;
    }
    if (event.pointerType === "mouse") {
      const index = pick(event);
      setHover(index);
      showDate(index, event);
    }
    requestRender();
  });
  canvas.addEventListener("pointerleave", () => {
    tilt.targetX = 0;
    tilt.targetY = 0;
    setHover(-1);
    dateEl.classList.remove("is_visible");
    requestRender();
  });
  // クリック（タップ）で、下の一覧にある同じ写真のリンクを押して写真ビューアを開く
  canvas.addEventListener("click", (event) => {
    const index = pick(event);
    if (index < 0) return;
    const link = document.querySelector(`#guide a[href$="/${CSS.escape(photos[index].file)}"]`);
    if (link) link.click();
  });

  // ---- 描画ループ（必要なときだけ回す） ----
  let growStart = null;
  let frameId = null;
  let onScreen = true;
  let atlasReady = false;

  const render = (now) => {
    frameId = null;
    if (!atlasReady) return;
    if (growStart === null) growStart = now;
    const still = reduceMotion.matches;
    const t = still ? 1 : Math.min((now - growStart) / GROW_MS, 1);
    // 前半はゆっくり、後半は速く（案内が増えていった流れに合わせる）
    material.uniforms.uProgress.value = still ? 1 : t * t * (3 - 2 * t) * 0.6 + t * 0.4;

    tilt.x += (tilt.targetX - tilt.x) * 0.12;
    tilt.y += (tilt.targetY - tilt.y) * 0.12;
    mesh.rotation.x = tilt.x;
    mesh.rotation.y = tilt.y;

    renderer.render(scene, camera);
    stage.classList.add("is_ready");

    const tiltMoving = Math.abs(tilt.targetX - tilt.x) + Math.abs(tilt.targetY - tilt.y) > 0.0005;
    if ((t < 1 || tiltMoving) && onScreen && !document.hidden) requestRender();
  };

  function requestRender() {
    if (frameId === null && onScreen && !document.hidden) {
      frameId = requestAnimationFrame(render);
    }
  }

  new TextureLoader().load(
    data.atlas,
    (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      material.uniforms.uAtlas.value = texture;
      atlasReady = true;
      requestRender();
    },
    undefined,
    () => stage.classList.add("is_unsupported"),
  );

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    requestRender();
  }).observe(stage);
  document.addEventListener("visibilitychange", requestRender);
  reduceMotion.addEventListener("change", requestRender);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stage.classList.add("is_unsupported");
  });

  new ResizeObserver(resize).observe(mount);
  resize();
};

// cluster の写真：最初は一部だけ出し、ボタンで残りを出す
const initClusterMore = () => {
  const button = document.querySelector(".js_cluster_show");
  if (!button) return;
  button.addEventListener("click", () => {
    const items = document.querySelectorAll(".js_cluster_more");
    items.forEach((item) => item.classList.remove("is_none"));
    button.remove();
    // 新しく出た最初の写真へフォーカスを移す
    items[0]?.querySelector("a")?.focus();
  });
};

const stage = document.querySelector(".js_flake_stage");
if (stage) init(stage);
initClusterMore();
