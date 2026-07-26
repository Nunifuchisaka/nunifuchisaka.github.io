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

## ビルドパイプラインの構造

`webpack.config.js` は2つの設定（配列）をエクスポートする。**両方が毎回同時に走る**。

1. **development** → `dist_uncompressed/` に出力。EJS/SCSS/画像をそのまま（未圧縮）ビルドし、開発中の確認用に使う。ここで Stylelint も実行される。
2. **production** → `docs/`（GitHub Pagesの公開先）に出力。`dist_uncompressed/` の中身をコピーしつつ、HTML/CSSをminify、JSはBabel+Terserを通す。画像最適化（`img2webp` / `img2webp2`）もこの段で走る。

つまり **`src/` を直接編集し、`dist_uncompressed/` と `docs/` はどちらも生成物**。手で編集しない。

### ページの作り方は2系統ある

- **通常ページ**（`src/index.ejs`, `src/dice/`, `src/equipment/`, `src/timeline/`, `src/videos/` 等）: EJS + SCSS + ES6 JSをwebpack経由でビルド。共通パーツは `src/assets/html/_*.ejs`（`_head`, `_header`, `_footer` 等）をincludeして使う。
- **独立ページ（BOOTH商品説明書サイト）**（`deepfrostice`, `heartbeat`, `imagegetter`, `glossyskin`）: webpack.config.js内の `STANDALONE_PAGES` 配列に列挙されたディレクトリで、EJS/SCSSビルドを通さず生の `index.html` / `style.css` / `script.js` をそのままコピーする。新しい商品ページを追加する場合はディレクトリを作り、この配列に追記する。日英2言語対応する場合はサブディレクトリ `en/` に英語版一式を置く（`src/deepfrostice/en/`, `src/heartbeat/en/`, `src/glossyskin/en/` を参照）。

### 画像最適化パイプライン（production側のみ）

- `img2webp/` → リサイズなしでWebP変換するだけ（品質50固定、`IMAGE_OPTIMIZATION_CONFIG`で調整）。
- `img2webp2/src/` → `img2webp2/dist/` へ、リサイズ（幅960px）＋WebP変換＋VRChatスクリーンショットの日付ベースリネームを行う。ファイル名重複時は `a, b, c...` サフィックスを自動付与。
- どちらも `STANDALONE_PAGES` のコピー対象には含まれない別経路。

## CSS設計

`src/assets/css/` はカテゴリ別（`base` / `layout` / `module` / `state` / `animation` / `extra` / `tool`）に分割されたSCSSパーシャル構成。クラス命名はBEM風で、ブロックに連番を振る独自規則（例: `.header_3`, `.header_3__h1`, `.dice_1`, `.dice_1__button`）。状態を表すクラスやJS用フックの命名規則も既存コードのパターンに揃えること（例: `id="js-dice-button"` のように操作対象要素には `js-` プレフィックスのIDを振る）。

Stylelintは `selector-class-pattern` を無効化しているため、上記の連番BEM命名は明示ルールではなく既存コードからの踏襲で守る。
