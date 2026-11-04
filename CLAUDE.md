# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

常に日本語で応答する。

## 概要

「ぬにふちさか」（VRChat/VRクリエイター）の個人プロフィールサイト兼、BOOTH商品（Unityシェーダー/ギミック等）の説明書サイトを配信する静的サイト。GitHub Pages（`docs/`）で公開している。

## ビルド・開発コマンド

```
npm start            # webpack watch起動。dist_uncompressed/ を経由してdocs/へ本番ビルドを生成し続ける
npm run validate:html # dist_uncompressed/htdocs/**/*.html をhtml-validateで検証（.htmlvalidate.json）
```

- lint／test専用のnpmスクリプトは無い。ESLint・Stylelintはビルド経由でのみ動く：
  - Stylelint（`.stylelintrc.js`）は開発ビルド中に `StylelintPlugin`（`fix: true`）が自動実行する。
  - `eslint-webpack-plugin` は依存関係にあるが webpack.config.js には登録されていない。手動チェックする場合は `npx eslint src` を使う。
- テストフレームワークは存在しない。

## デプロイ

- サイトを更新したら、確認を待たずに毎回デプロイ（`main` へ反映して push）まで行う。GitHub Pages は `main` の `docs/` を公開しているので、push すると1分ほどで公開される。
- push の前に `src/` からビルドし直し、生成物（`dist_uncompressed/`, `docs/`）も一緒にコミットする。
- force push はしない。
- push のあと、公開ページに変更が出ているかを確かめて報告する。

## 日英の作り方

- 新しいページや記事は、まず日本語版だけを作って公開する。英語版は、管理人が日本語版の内容を固めたと言ってから作る（それまでは修正指示が入るため）。
- 英語版がまだ無いページは、`_topbar` に `enReady:false` を渡して言語切替の English を選べないようにし、`meta.altUrl` も書かない。英語のメニューに出さない項目は `_topbar.ejs` の `EN_PENDING` に入れる。

## AIO（AI検索向けの作り方）

ページを作るとき・直すときは、毎回 AI 検索（ChatGPT・Perplexity・Google の AI 概要など）に正しく読まれ、引用されるように作る。仕組みは下の「検索エンジン・AI向けのファイル（AIO）」を参照。

- **title と description を必ず書く**。description は「何のページで、誰向けで、何が分かる・できるか」を1〜2文で言い切る。AI はここを要約・引用し、`llms.txt` の一覧にもそのまま載る。「〜まとめ」「〜を振り返る」のような中身の分からない文にしない。
- **本文は結論から書く**。ページや見出しのはじめの1〜2文で答えを言い、詳しい説明はそのあとに続ける。
- **事実ははっきり書く**：対応環境（PC / Quest、Windows / macOS）、必要なもの（Unity・VRChat SDK・Modular Avatar・lilToon のバージョンなど）、価格、版の番号、更新日。あいまいな言い方より数字と固有名詞を使う。
- **呼び名をそろえる**：「ぬにふちさか / Nunifuchisaka」、商品名の表記は、サイト・BOOTH・説明書で同じにする。
- **見出しの順番を正しくする**：h1 はページに1つ。h2・h3 を飛ばさない。質問と答えの形で書ける内容は、見出しを質問にする。
- **新しい商品の説明書**を足したら、`STANDALONE_PAGES` への追記に加えて `products.json` にも1件足す（構造化データ・制作物一覧・よくある質問・`llms.txt` がここから作られる）。説明書の `<head>` には title・description と、英語版があれば hreflang を書く。
- **よくある質問**に足す内容は `_faq.ejs` の `faq` に入れる（`FAQPage` の構造化データにも自動で入る）。
- **検索に出したくないページ**（作りかけ・身内向けなど）には `meta.noindex` を付ける。サイトマップと `llms.txt` から自動で外れる。
- **サイトの紹介が変わったとき**（活動内容・外部のアカウントが増えたなど）は `src/assets/data/llms-intro.md` と、`_head.ejs` の Person の `sameAs` も直す。
- ビルドのあと、新しいページが `docs/sitemap.xml` と `docs/llms.txt` に載っているか（noindex なら載っていないか）を確かめる。ページの中身を変えたときは `src/assets/data/sitemap-lastmod.json` の変更もコミットする。

## ビルドパイプラインの構造

`webpack.config.js` は2つの設定（配列）をエクスポートする。**両方が毎回同時に走る**。

1. **development** → `dist_uncompressed/` に出力。EJS/SCSS/画像をそのまま（未圧縮）ビルドし、開発中の確認用に使う。ここで Stylelint も実行される。
2. **production** → `docs/`（GitHub Pagesの公開先）に出力。`dist_uncompressed/` の中身をコピーしつつ、HTML/CSSをminify、JSはBabel+Terserを通す。画像最適化（`img2webp` / `img2webp2`）もこの段で走る。

つまり **`src/` を直接編集し、`dist_uncompressed/` と `docs/` はどちらも生成物**。手で編集しない。

### ページの作り方は2系統ある

- **通常ページ**（`src/index.ejs`, `src/dice/`, `src/equipment/`, `src/timeline/`, `src/videos/` 等）: EJS + SCSS + ES6 JSをwebpack経由でビルド。共通パーツは `src/assets/html/_*.ejs`（`_head`, `_header`, `_footer` 等）をincludeして使う。
- **独立ページ（BOOTH商品説明書サイト）**（`deepfrostice`, `heartbeat`, `imagegetter`, `glossyskin`）: webpack.config.js内の `STANDALONE_PAGES` 配列に列挙されたディレクトリで、EJS/SCSSビルドを通さず生の `index.html` / `style.css` / `script.js` をそのままコピーする。新しい商品ページを追加する場合はディレクトリを作り、この配列に追記する。日英2言語対応する場合はサブディレクトリ `en/` に英語版一式を置く（`src/deepfrostice/en/`, `src/heartbeat/en/`, `src/glossyskin/en/` を参照）。

### 検索エンジン・AI向けのファイル（AIO）

- `sitemap.xml` と `llms.txt` は手で書かない。development 側の `AioFilesPlugin`（webpack.config.js の `AIO_CONFIG`）が、出力した全 HTML から毎回作る。`<meta name="robots" content="noindex">` のページは載らない。
  - `lastmod` は、ページの HTML が前回と変わった日。ハッシュと日付は `src/assets/data/sitemap-lastmod.json` に保存されるので、これも一緒にコミットする。
  - `llms.txt` の前半（サイトの紹介・外部リンク）は `src/assets/data/llms-intro.md` に書く。後半のページ一覧は、各ページの `<title>` と description から作られる。
- `robots.txt` は `src/robots.txt` を編集する。
- 独立ページ（商品の説明書）の `<dir>/index.html` と `<dir>/en/index.html` には、コピー時に `products.json` から作った構造化データ（`SoftwareApplication`）が自動で入る。商品の情報を変えるときは `products.json` を直す。
- よくある質問（`_faq.ejs`）は、質問と答えから `FAQPage` の構造化データも出す。

### 画像最適化パイプライン（production側のみ）

- `img2webp/` → リサイズなしでWebP変換するだけ（品質50固定、`IMAGE_OPTIMIZATION_CONFIG`で調整）。
- `img2webp2/src/` → `img2webp2/dist/` へ、リサイズ（幅960px）＋WebP変換＋VRChatスクリーンショットの日付ベースリネームを行う。ファイル名重複時は `a, b, c...` サフィックスを自動付与。
- どちらも `STANDALONE_PAGES` のコピー対象には含まれない別経路。

## CSS設計

`src/assets/css/` はカテゴリ別（`base` / `layout` / `module` / `state` / `animation` / `extra` / `tool`）に分割されたSCSSパーシャル構成。クラス命名はBEM風で、ブロックに連番を振る独自規則（例: `.header_3`, `.header_3__h1`, `.dice_1`, `.dice_1__button`）。状態を表すクラスやJS用フックの命名規則も既存コードのパターンに揃えること（例: `id="js-dice-button"` のように操作対象要素には `js-` プレフィックスのIDを振る）。

Stylelintは `selector-class-pattern` を無効化しているため、上記の連番BEM命名は明示ルールではなく既存コードからの踏襲で守る。
