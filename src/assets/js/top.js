// トップページ「召喚の氷晶」。
// 六角柱の氷晶（屈折率 1.31 ＝ 氷）の中に本人の写真を封じ、その奥に名前を置く。
// 名前は氷晶越しに屈折して見える。読み込み時に一度だけ氷晶が育つ（召喚）。
// 横ドラッグで回せる。WebGL が使えなければ何もせず、CSS の静止画（.stage_1__fallback）が残る。
import {
  CanvasTexture,
  Color,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const FONT_FAMILY = '"Zen Kaku Gothic Antique"';
const CAMERA_Z = 10;
const BACKDROP_Z = -3;
const FOV = 30;
const SUMMON_MS = 1800;
const IDLE_SPEED = 0.08; // rad/s
const ICE_IOR = 1.31;

const readToken = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const visibleHeightAt = (distance) => 2 * distance * Math.tan(MathUtils.degToRad(FOV / 2));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

const init = (stage) => {
  const mount = stage.querySelector(".js_crystal_canvas");
  const nameEl = stage.querySelector(".js_crystal_name");
  if (!mount || !nameEl) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = NoToneMapping;
  mount.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  camera.position.set(0, 0, CAMERA_Z);

  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // 奥の板：背景色の上に名前を描く。屈折の材料になるので不透明にする
  const textCanvas = document.createElement("canvas");
  const textTexture = new CanvasTexture(textCanvas);
  textTexture.colorSpace = SRGBColorSpace;
  const backdrop = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ map: textTexture, toneMapped: false }),
  );
  backdrop.position.z = BACKDROP_Z;
  scene.add(backdrop);

  // 氷晶：先の尖った六角柱（雪の結晶の角柱と同じ形）
  const RADIUS = 0.62;
  const SHOULDER = 1.25;
  const TIP = 1.95;
  const crystalGeometry = new LatheGeometry(
    [new Vector2(0, -TIP), new Vector2(RADIUS, -SHOULDER), new Vector2(RADIUS, SHOULDER), new Vector2(0, TIP)],
    6,
  );
  const ice = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 1.6,
    ior: ICE_IOR,
    dispersion: 0.6,
    attenuationColor: new Color(readToken("--color-ice") || "#9db7c6"),
    attenuationDistance: 3.4,
    specularIntensity: 1,
    envMapIntensity: 1.1,
    flatShading: true,
  });
  const crystal = new Mesh(crystalGeometry, ice);
  const crystalGroup = new Group();
  crystalGroup.rotation.z = -0.16;
  crystalGroup.add(crystal);
  scene.add(crystalGroup);

  // 氷晶の中の写真。回転させず、常にこちらを向かせる（回るのは氷だけ）
  const PHOTO_HEIGHT = 1.3;
  const photoMaterial = new MeshBasicMaterial({ toneMapped: false });
  const photo = new Mesh(new PlaneGeometry(PHOTO_HEIGHT * (400 / 540), PHOTO_HEIGHT), photoMaterial);
  photo.visible = false;
  scene.add(photo);
  new TextureLoader().load(stage.dataset.photo, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    photo.geometry.dispose();
    photo.geometry = new PlaneGeometry(PHOTO_HEIGHT * (texture.image.width / texture.image.height), PHOTO_HEIGHT);
    photoMaterial.map = texture;
    photoMaterial.needsUpdate = true;
    photo.visible = true;
    requestRender();
  });

  const layout = { baseScale: 1, centerY: 0, width: 1, height: 1 };

  const drawName = () => {
    const pixelRatio = renderer.getPixelRatio();
    const width = Math.min(Math.round(layout.width * pixelRatio), 2048);
    const height = Math.min(Math.round(layout.height * pixelRatio), 2048);
    textCanvas.width = width;
    textCanvas.height = height;
    const ctx = textCanvas.getContext("2d");
    const bg = readToken("--color-bg") || "#e9f1f5";
    const fg = readToken("--color-text") || "#2b2420";
    scene.background = new Color(bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const name = nameEl.textContent.trim();
    ctx.font = `900 100px ${FONT_FAMILY}, sans-serif`;
    const measured = ctx.measureText(name).width || 1;
    const size = Math.min((100 * width * 0.9) / measured, height * 0.3);
    ctx.font = `900 ${size}px ${FONT_FAMILY}, sans-serif`;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 氷晶の中心の高さに名前を置く（奥の板への投影位置に合わせる）
    const backdropHeight = visibleHeightAt(CAMERA_Z - BACKDROP_Z);
    const projectedY = layout.centerY * ((CAMERA_Z - BACKDROP_Z) / CAMERA_Z);
    const y = height / 2 - (projectedY / backdropHeight) * height;
    ctx.fillText(name, width / 2, y);
    textTexture.needsUpdate = true;
  };

  const resize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    layout.width = width;
    layout.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const backdropHeight = visibleHeightAt(CAMERA_Z - BACKDROP_Z) * 1.02;
    backdrop.scale.set(backdropHeight * camera.aspect, backdropHeight, 1);

    const frontHeight = visibleHeightAt(CAMERA_Z);
    const frontWidth = frontHeight * camera.aspect;
    const crystalHeight = TIP * 2;
    const byHeight = (frontHeight * 0.6) / crystalHeight;
    const byWidth = (frontWidth * 0.42) / (RADIUS * 2);
    layout.baseScale = Math.min(byHeight, byWidth);
    // 下端の文字（読み・ひとこと）に重ならないよう、少し上に置く
    layout.centerY = frontHeight * 0.08;
    crystalGroup.position.y = layout.centerY;
    photo.position.y = layout.centerY;

    drawName();
    requestRender();
  };

  // 回転：アイドルのゆっくりした回転＋横ドラッグ（慣性つき）
  let angle = 0.5;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastMoveTime = 0;

  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastMoveTime = performance.now();
    velocity = 0;
    canvas.setPointerCapture(event.pointerId);
    requestRender();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dt = Math.max(now - lastMoveTime, 1) / 1000;
    angle += dx * 0.01;
    velocity = (dx * 0.01) / dt;
    lastX = event.clientX;
    lastMoveTime = now;
    requestRender();
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // 描画ループ：画面内かつタブが表示中のときだけ回す
  let summonStart = null;
  let lastTime = null;
  let frameId = null;
  let onScreen = true;

  const shouldAnimate = () => onScreen && !document.hidden;

  const render = (now) => {
    frameId = null;
    if (summonStart === null) summonStart = now;
    const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const still = reduceMotion.matches;
    const progress = still ? 1 : easeOutCubic(Math.min((now - summonStart) / SUMMON_MS, 1));

    if (!dragging) {
      angle += velocity * dt;
      velocity *= Math.pow(0.04, dt);
      if (Math.abs(velocity) < 0.01) velocity = 0;
      if (!still) angle += IDLE_SPEED * dt;
    }

    const s = layout.baseScale;
    const grow = Math.max(progress, 0.001);
    crystalGroup.scale.set(s * (0.55 + 0.45 * grow), s * grow, s * (0.55 + 0.45 * grow));
    crystal.rotation.y = angle + (1 - progress) * 2.6;
    photo.scale.setScalar(s * grow);

    renderer.render(scene, camera);
    if (!stage.classList.contains("is_ready")) stage.classList.add("is_ready");

    const moving = !still || dragging || velocity !== 0 || progress < 1;
    if (moving && shouldAnimate()) requestRender();
  };

  function requestRender() {
    if (frameId === null && shouldAnimate()) {
      frameId = requestAnimationFrame(render);
    }
  }

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen) {
      lastTime = null;
      requestRender();
    }
  }).observe(stage);

  document.addEventListener("visibilitychange", () => {
    lastTime = null;
    requestRender();
  });

  // テーマが変わったら名前の板を描き直す
  const redraw = () => {
    drawName();
    requestRender();
  };
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  reduceMotion.addEventListener("change", requestRender);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stage.classList.remove("is_ready");
  });

  new ResizeObserver(resize).observe(stage);
  resize();

  // 書体が届いたら名前を描き直す（届く前は代替書体で描いている）
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`900 100px ${FONT_FAMILY}`, nameEl.textContent.trim()).then(redraw, () => {});
  }
};

const stage = document.querySelector(".js_crystal_stage");
if (stage) init(stage);
