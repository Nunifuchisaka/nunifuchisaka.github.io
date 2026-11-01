// トップページ「思い出をなぞる」。
// 案内写真を1枚大きく見せ、下の時間軸（1本＝1枚、日付の位置）をなぞると、その日の写真に替える。
// なぞっている間は縮小版のアトラス（assets/img/guide-atlas.webp）から canvas に描き、
// 手を止めたら元の写真（img）に差し替える。読み込み時に一度だけ、最初の日から最新まで早送りする。

const SETTLE_MS = 140;
const AUTOPLAY_MS = 5000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const initScrub = (root) => {
  const dataEl = root.querySelector(".js_scrub_data");
  const img = root.querySelector(".js_scrub_img");
  const canvas = root.querySelector(".js_scrub_canvas");
  const dateEl = root.querySelector(".js_scrub_date");
  const countEl = root.querySelector(".js_scrub_count");
  const openEl = root.querySelector(".js_scrub_open");
  const track = root.querySelector(".js_scrub_track");
  const thumb = root.querySelector(".js_scrub_thumb");
  if (!dataEl || !img || !canvas || !track) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch {
    return;
  }
  const photos = data.photos || [];
  const last = photos.length - 1;
  if (last < 0) return;

  const separator = data.locale === "en" ? ", " : "、";
  const monthOf = (photo) => (photo.file.match(/\d{4}-\d{2}/) || [""])[0];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ctx = canvas.getContext("2d");

  let index = last;
  let atlas = null;
  let settleTimer = null;
  let autoplayFrame = null;

  // ---- 描画 ----
  const resizeCanvas = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    if (root.classList.contains("is_scrubbing")) drawTile(index);
  };

  const drawTile = (i) => {
    if (!atlas || !canvas.width) return false;
    const { tileWidth, tileHeight, cols } = data;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      atlas,
      (i % cols) * tileWidth,
      Math.floor(i / cols) * tileHeight,
      tileWidth,
      tileHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return true;
  };

  // 手を止めたら、元の写真を読み込んでから差し替える（読み込み中は縮小版のまま）
  const settle = () => {
    const target = index;
    const photo = photos[target];
    const src = `/assets/img/guide/${photo.file}`;
    const full = new Image();
    full.src = src;
    const show = () => {
      if (index !== target) return;
      img.src = src;
      img.alt = photo.alt;
      root.classList.remove("is_scrubbing");
    };
    (full.decode ? full.decode() : Promise.resolve()).then(show, show);
  };

  const setIndex = (next) => {
    const i = clamp(next, 0, last);
    if (i === index) return;
    index = i;
    const photo = photos[i];
    dateEl.textContent = photo.date;
    countEl.textContent = photo.label;
    openEl.href = `/assets/img/guide/${photo.file}`;
    track.setAttribute("aria-valuenow", String(i + 1));
    track.setAttribute("aria-valuetext", `${photo.date}${separator}${photo.label}`);
    thumb.style.left = `${photo.x}%`;
    if (drawTile(i)) root.classList.add("is_scrubbing");
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
  };

  // ---- なぞる ----
  // 時間軸上の位置から、いちばん近い写真を探す（x は古い順に並んでいる）
  const indexFromPointer = (clientX) => {
    const rect = track.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    let low = 0;
    let high = last;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (photos[mid].x < percent) low = mid + 1;
      else high = mid;
    }
    if (low > 0 && Math.abs(photos[low - 1].x - percent) <= Math.abs(photos[low].x - percent)) return low - 1;
    return low;
  };

  const stopAutoplay = () => {
    if (autoplayFrame !== null) cancelAnimationFrame(autoplayFrame);
    autoplayFrame = null;
  };

  let dragging = false;
  track.addEventListener("pointerdown", (event) => {
    stopAutoplay();
    dragging = true;
    track.setPointerCapture(event.pointerId);
    setIndex(indexFromPointer(event.clientX));
  });
  track.addEventListener("pointermove", (event) => {
    // マウスは押さなくても、上を通るだけで替える
    if (!dragging && event.pointerType !== "mouse") return;
    stopAutoplay();
    setIndex(indexFromPointer(event.clientX));
  });
  const endDrag = () => {
    dragging = false;
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // ---- キーボード（スライダーの作法に合わせる） ----
  const monthStart = (from, direction) => {
    const current = monthOf(photos[from]);
    let i = from;
    if (direction > 0) {
      while (i < last && monthOf(photos[i]) === current) i++;
      return i;
    }
    // 前の月の最初の1枚
    while (i > 0 && monthOf(photos[i]) === current) i--;
    const previous = monthOf(photos[i]);
    while (i > 0 && monthOf(photos[i - 1]) === previous) i--;
    return i;
  };

  track.addEventListener("keydown", (event) => {
    const actions = {
      ArrowRight: () => index + 1,
      ArrowUp: () => index + 1,
      ArrowLeft: () => index - 1,
      ArrowDown: () => index - 1,
      PageUp: () => monthStart(index, 1),
      PageDown: () => monthStart(index, -1),
      Home: () => 0,
      End: () => last,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    stopAutoplay();
    setIndex(action());
  });

  // 「この写真を開く」は、下の一覧の同じ写真から写真ビューアで開く（前後の日へ送れる）
  openEl.addEventListener("click", (event) => {
    const file = photos[index].file;
    const link = document.querySelector(`#guide a[href$="/${CSS.escape(file)}"]`);
    if (!link) return;
    event.preventDefault();
    link.click();
  });

  // ---- 読み込み時の早送り（一度だけ） ----
  const autoplay = () => {
    if (reduceMotion.matches) return;
    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      const t = Math.min((now - start) / AUTOPLAY_MS, 1);
      // 始めと終わりをゆっくりにする
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setIndex(Math.round(eased * last));
      autoplayFrame = t < 1 ? requestAnimationFrame(step) : null;
    };
    index = -1;
    autoplayFrame = requestAnimationFrame(step);
  };

  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();

  const atlasImage = new Image();
  atlasImage.onload = () => {
    atlas = atlasImage;
    autoplay();
  };
  atlasImage.src = data.atlas;
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

const scrub = document.querySelector(".js_scrub");
if (scrub) initScrub(scrub);
initClusterMore();
