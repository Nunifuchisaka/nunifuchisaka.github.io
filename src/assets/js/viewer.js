// 写真ビューア（トップページ・cluster ページ）。
// 一覧の写真を押すと、View Transitions API でその写真がそのまま大きく広がって開く。閉じると元の位置へ戻る。
// 対応していないブラウザでは、ふつうに開閉する。リンク（.js_viewer）は JS が無ければ画像を新しいタブで開く。
// 同じ data-gallery の写真どうしで前後へ送れる（← → キー、ボタン、横スワイプ）。

const VT_NAME = "viewer-photo";

const TEXT = {
  ja: { close: "閉じる", prev: "前の写真", next: "次の写真", dialog: "写真" },
  en: { close: "Close", prev: "Previous photo", next: "Next photo", dialog: "Photo" },
};

const supportsViewTransition = typeof document.startViewTransition === "function";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// 画像が読み込めるまで待つ（遅すぎるときは待たずに進める）
const waitForImage = (img) => {
  const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  return Promise.race([decoded, new Promise((resolve) => setTimeout(resolve, 1500))]);
};

const transition = (update) => {
  if (!supportsViewTransition || reduceMotion.matches) {
    return Promise.resolve(update());
  }
  return document.startViewTransition(update).finished.catch(() => {});
};

const buildDialog = (text) => {
  const dialog = document.createElement("dialog");
  dialog.className = "viewer_1";
  dialog.setAttribute("aria-label", text.dialog);
  dialog.innerHTML = `
    <figure class="viewer_1__figure">
      <img class="viewer_1__img" alt="">
      <figcaption class="viewer_1__caption">
        <span class="viewer_1__title"></span>
        <span class="viewer_1__note"></span>
      </figcaption>
    </figure>
    <button type="button" class="viewer_1__button viewer_1__button--prev" aria-label="${text.prev}"><span aria-hidden="true">‹</span></button>
    <button type="button" class="viewer_1__button viewer_1__button--next" aria-label="${text.next}"><span aria-hidden="true">›</span></button>
    <button type="button" class="viewer_1__button viewer_1__button--close" aria-label="${text.close}" autofocus><span aria-hidden="true">×</span></button>
  `;
  document.body.appendChild(dialog);
  return dialog;
};

const initViewer = () => {
  const links = Array.from(document.querySelectorAll(".js_viewer"));
  if (!links.length) return;

  const lang = document.documentElement.lang === "en" ? "en" : "ja";
  const text = TEXT[lang];
  const dialog = buildDialog(text);
  const img = dialog.querySelector(".viewer_1__img");
  const titleEl = dialog.querySelector(".viewer_1__title");
  const noteEl = dialog.querySelector(".viewer_1__note");
  const prevButton = dialog.querySelector(".viewer_1__button--prev");
  const nextButton = dialog.querySelector(".viewer_1__button--next");
  const closeButton = dialog.querySelector(".viewer_1__button--close");

  let group = [];
  let index = 0;

  const thumbOf = (link) => link.querySelector("img");

  const fill = (link) => {
    const thumb = thumbOf(link);
    img.src = link.href;
    img.alt = thumb ? thumb.alt : "";
    titleEl.textContent = link.dataset.title || "";
    noteEl.textContent = link.dataset.note || `${index + 1} / ${group.length}`;
    prevButton.disabled = index === 0;
    nextButton.disabled = index === group.length - 1;
  };

  const open = async (link) => {
    group = links.filter((item) => item.dataset.gallery === link.dataset.gallery);
    index = group.indexOf(link);
    const thumb = thumbOf(link);
    if (thumb) thumb.style.viewTransitionName = VT_NAME;
    await transition(async () => {
      if (thumb) thumb.style.viewTransitionName = "";
      fill(link);
      img.style.viewTransitionName = VT_NAME;
      dialog.showModal();
      await waitForImage(img);
    });
    img.style.viewTransitionName = "";
  };

  const close = async () => {
    const link = group[index];
    const thumb = link && thumbOf(link);
    // 戻り先の写真が画面に見えるようにしてから閉じる
    if (link) link.scrollIntoView({ block: "nearest" });
    img.style.viewTransitionName = VT_NAME;
    await transition(() => {
      img.style.viewTransitionName = "";
      if (thumb) thumb.style.viewTransitionName = VT_NAME;
      dialog.close();
    });
    if (thumb) thumb.style.viewTransitionName = "";
    if (link) link.focus({ preventScroll: true });
  };

  const go = async (step) => {
    const next = index + step;
    if (next < 0 || next >= group.length) return;
    index = next;
    await transition(async () => {
      fill(group[index]);
      await waitForImage(img);
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      // 新しいタブで開く操作（Ctrl・中ボタンなど）はそのまま通す
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open(link);
    });
  });

  prevButton.addEventListener("click", () => go(-1));
  nextButton.addEventListener("click", () => go(1));
  closeButton.addEventListener("click", close);

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") go(-1);
    if (event.key === "ArrowRight") go(1);
  });
  // Esc はブラウザ標準の閉じ方を止め、戻るアニメーションつきで閉じる
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  // 写真の外（暗い所）を押したら閉じる
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  // 横スワイプで前後へ
  let startX = null;
  dialog.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
  });
  dialog.addEventListener("pointerup", (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (event.pointerType !== "mouse" && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  });
};

initViewer();
