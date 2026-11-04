// アバター改変の解説の検索（/avatar-tips/search/?q=…）
// 索引（.js_search の data-src）は、ビルドのときに webpack.config.js の TipsSearchPlugin が作る。
// 1件は { k: 種類（a 記事の節 / p 困りごと / g 用語集）, u: 飛び先, h: 見出し, w: どこの話か, x: 本文, m: 用語の別の書き方 }
// - 空白で区切ったことばを、すべて含むものだけを出す
// - ひらがなとカタカナ、全角と半角、大文字と小文字、「ー」・「・」のあるなしは区別しない
// - 3文字までの英数字（MA・FX・SDK など）は、ほかの英単語の一部には当てない（Animator の ma など）
// - 用語集の別の呼び名（synonyms。例：MA と Modular Avatar）は、どれで探しても同じに当たる
// - 打つたびに検索し、URL の ?q= も書きかえる（そのまま共有・ブックマークできる）
(() => {
  const root = document.querySelector(".js_search");
  const form = document.querySelector(".js_search_form");
  const input = document.querySelector(".js_search_input");
  if (!root || !form || !input) return;
  const list = root.querySelector(".js_search_list");
  const status = root.querySelector(".js_search_status");
  const more = root.querySelector(".js_search_more");
  const kinds = root.querySelectorAll(".js_search_kind");
  const kindCounts = root.querySelectorAll(".js_search_kind_count");
  const KIND_LABEL = { a: "記事", p: "困りごと", g: "用語集" };
  const PAGE = 30;
  const BEFORE = 40;
  const AFTER = 90;

  // 1文字ずつ比べやすい形に直し、直したあとの位置 → 元の文字の位置 も覚えておく（抜き出しと色付けに使う）
  const SKIP = /[\u30fc\u30fb]/;
  const foldChar = (c) => {
    let n = c.normalize("NFKC").toLowerCase();
    n = n.replace(/[ぁ-ゖ]/g, (h) => String.fromCharCode(h.charCodeAt(0) + 0x60));
    return n;
  };
  const fold = (text) => {
    let s = "";
    const map = [];
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      const code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) c += text[++i];
      const n = foldChar(c);
      for (const ch of n) {
        if (SKIP.test(ch)) continue;
        if (/\s/.test(ch)) {
          // 空白は、続いていても1つにまとめる
          if (!s || s[s.length - 1] === " ") continue;
          s += " ";
          map.push(i - c.length + 1);
          continue;
        }
        s += ch;
        map.push(i - c.length + 1);
      }
    }
    map.push(text.length);
    return { s, map };
  };
  const foldWord = (w) => fold(w).s.trim();

  let index = null;
  let loading = null;
  let results = [];
  let shown = PAGE;
  let words = [];

  const load = () => {
    if (loading) return loading;
    status.textContent = "索引を読み込んでいます…";
    loading = fetch(root.dataset.src)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        const synonyms = new Map();
        data.synonyms.forEach((names) => {
          const folded = [...new Set(names.map(foldWord).filter(Boolean))];
          folded.forEach((f) => synonyms.set(f, [...new Set((synonyms.get(f) || []).concat(folded))]));
        });
        index = {
          synonyms,
          items: data.items.map((item) => ({
            ...item,
            fh: fold(item.h),
            fw: foldWord(item.w),
            fx: fold(item.x),
            fm: item.m ? foldWord(item.m) : "",
          })),
        };
        return index;
      });
    loading.catch(() => {
      status.textContent = "索引を読み込めませんでした。時間をおいて、ページを読み込み直してください。";
      loading = null;
    });
    return loading;
  };

  // ことば1つ → 当てる書き方の一覧（別の呼び名を含む）。短い英数字は、前後が英数字でないところにだけ当てる
  const SHORT_ASCII = /^[a-z0-9]{1,3}$/;
  const altsOf = (w) => (index.synonyms.get(w) || [w]).map((t) => ({ t, strict: SHORT_ASCII.test(t) }));
  const WORD_CHAR = /[a-z0-9]/;
  // s の中で a が当たる位置を、cap 個まで返す
  const find = (s, a, cap) => {
    const found = [];
    let at = s.indexOf(a.t);
    while (at !== -1 && found.length < cap) {
      const end = at + a.t.length;
      if (!a.strict || (!WORD_CHAR.test(s[at - 1] || "") && !WORD_CHAR.test(s[end] || ""))) found.push(at);
      at = s.indexOf(a.t, at + 1);
    }
    return found;
  };
  const has = (s, a) => find(s, a, 1).length > 0;

  const score = (item, groups) => {
    let total = 0;
    for (const alts of groups) {
      let best = 0;
      for (const a of alts) {
        let p = 0;
        if (has(item.fh.s, a)) p += item.fh.s === a.t ? 60 : 30;
        if (item.fm && has(item.fm, a)) p += 20;
        if (has(item.fw, a)) p += 6;
        p += find(item.fx.s, a, 8).length * 3;
        best = Math.max(best, p);
      }
      if (!best) return 0;
      total += best;
    }
    if (item.k === "p") total += 6;
    return total;
  };

  // 文の中の当たったところ（元の文字の位置）を、[はじめ, おわり] の並びで返す。
  // 空白1つだけをはさんで並ぶところ（Write と Defaults など）は、1つにまとめる
  const hitsIn = (text, folded, groups) => {
    const ranges = [];
    groups.forEach((alts) => alts.forEach((a) => {
      find(folded.s, a, Infinity).forEach((at) => {
        ranges.push([folded.map[at], folded.map[at + a.t.length - 1] + 1]);
      });
    }));
    ranges.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
    const merged = [];
    ranges.forEach((r) => {
      const last = merged[merged.length - 1];
      if (last && (r[0] <= last[1] || (r[0] === last[1] + 1 && /\s/.test(text[last[1]])))) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    });
    return merged;
  };

  // text の from〜to を、当たったところを <mark> にして el に入れる
  const fillMarked = (el, text, ranges, from, to) => {
    let at = from;
    ranges.forEach(([s, e]) => {
      if (e <= from || s >= to) return;
      const s2 = Math.max(s, from);
      const e2 = Math.min(e, to);
      if (s2 > at) el.append(text.slice(at, s2));
      const mark = document.createElement("mark");
      mark.textContent = text.slice(s2, e2);
      el.append(mark);
      at = e2;
    });
    if (at < to) el.append(text.slice(at, to));
  };

  const render = () => {
    const kind = [...kinds].find((r) => r.checked).value;
    const counts = { all: results.length, a: 0, p: 0, g: 0 };
    results.forEach((r) => { counts[r.item.k] += 1; });
    kindCounts.forEach((el) => { el.textContent = String(counts[el.dataset.kind]); });
    const filtered = kind === "all" ? results : results.filter((r) => r.item.k === kind);
    list.textContent = "";
    filtered.slice(0, shown).forEach(({ item }) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.u;
      const head = document.createElement("span");
      head.className = "search_1__head";
      const label = document.createElement("span");
      label.className = `search_1__kind search_1__kind--${item.k}`;
      label.textContent = KIND_LABEL[item.k];
      const title = document.createElement("span");
      title.className = "search_1__title";
      fillMarked(title, item.h, hitsIn(item.h, item.fh, words), 0, item.h.length);
      head.append(label, title);
      const where = document.createElement("span");
      where.className = "search_1__where";
      where.textContent = item.k === "p" ? `${item.w}（${item.x}）` : item.w;
      a.append(head, where);
      if (item.k !== "p" && item.x) {
        const ranges = hitsIn(item.x, item.fx, words);
        const first = ranges.length ? ranges[0][0] : 0;
        const from = Math.max(0, first - BEFORE);
        const to = Math.min(item.x.length, first + AFTER);
        const snippet = document.createElement("span");
        snippet.className = "search_1__snippet";
        if (from > 0) snippet.append("…");
        fillMarked(snippet, item.x, ranges, from, to);
        if (to < item.x.length) snippet.append("…");
        a.append(snippet);
      }
      li.append(a);
      list.append(li);
    });
    const rest = filtered.length - shown;
    more.hidden = rest <= 0;
    if (rest > 0) more.textContent = `さらに表示する（のこり ${rest} 件）`;
    const q = input.value.trim();
    if (!filtered.length) {
      status.textContent = results.length
        ? `「${q}」は、この種類には見つかりませんでした。種類を「すべて」にしてください。`
        : `「${q}」に当てはまるところは見つかりませんでした。ことばを短くするか、別の呼び名で試してください。`;
    } else {
      status.textContent = `「${q}」の検索結果：${filtered.length} 件`;
    }
  };

  const search = () => {
    const q = input.value.trim();
    const url = new URL(location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(null, "", url);
    document.title = q ? `「${q}」の検索結果 | 改変解説を検索 | ぬにふちさか` : initialTitle;
    if (!q) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    load().then(() => {
      if (input.value.trim() !== q) return;
      words = q.split(/\s+/).map(foldWord).filter(Boolean).map(altsOf);
      results = index.items
        .map((item, i) => ({ item, i, s: score(item, words) }))
        .filter((r) => r.s > 0)
        .sort((x, y) => y.s - x.s || x.i - y.i);
      shown = PAGE;
      render();
    }).catch(() => {});
  };

  const initialTitle = document.title;
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  });
  input.addEventListener("focus", () => { load().catch(() => {}); }, { once: true });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(timer);
    search();
  });
  kinds.forEach((r) => r.addEventListener("change", () => {
    shown = PAGE;
    render();
  }));
  more.addEventListener("click", () => {
    shown += PAGE;
    render();
  });

  const q = new URLSearchParams(location.search).get("q") || "";
  input.value = q;
  if (q) search();
})();
