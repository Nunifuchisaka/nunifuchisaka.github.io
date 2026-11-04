// ひらがなで探すための読みの辞書（/assets/data/avatar-tips-yomi.json）を使う部品。
// 辞書は、ビルドのときに webpack.config.js の TipsSearchPlugin が、改変解説の本文・困りごと・用語集から作る（読み → 本文での書き方）。
// 使い方：loadYomi() で読み込み、yomiAlts("ひょうじょう") → ["表情"] のように、読みから本文での書き方を引く
const YOMI_URL = "/assets/data/avatar-tips-yomi.json";
// 読みの比べ方：全角と半角・大文字と小文字をそろえ、ひらがなをカタカナにし、「ー」「・」と空白を除く
export const foldKana = (text) => text.normalize("NFKC").toLowerCase()
  .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
  .replace(/[ー・\s]/g, "");
const KANA_ONLY = /^[ァ-ヶ]+$/;
// 打っている途中でも当たるよう、読みの頭が同じものも、この数まで足す
const PREFIX_LIMIT = 40;
let yomi = null;
let loading = null;

export const loadYomi = () => {
  if (yomi) return Promise.resolve(yomi);
  if (!loading) {
    loading = fetch(YOMI_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        yomi = Object.entries(data);
        return yomi;
      })
      .catch(() => {
        // 読めなくても、ひらがな・カタカナのままでは探せる。次に探すときに読み直す
        loading = null;
        return [];
      });
  }
  return loading;
};

// ことば（ひらがなかカタカナだけのもの）の読みに当たる、本文での書き方を返す。辞書がまだ無いときは空
export const yomiAlts = (word) => {
  const key = foldKana(word);
  if (!yomi || !KANA_ONLY.test(key)) return [];
  const out = new Set();
  let prefixed = 0;
  yomi.forEach(([reading, surfaces]) => {
    if (reading === key) {
      surfaces.forEach((s) => out.add(s));
    } else if (key.length >= 2 && prefixed < PREFIX_LIMIT && reading.startsWith(key)) {
      prefixed += 1;
      surfaces.forEach((s) => out.add(s));
    }
  });
  return [...out];
};
