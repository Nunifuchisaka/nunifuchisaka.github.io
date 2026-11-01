// トップページ用。
// cluster の写真は最初に一部だけ出し、ボタンで残りを出す。
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

initClusterMore();
