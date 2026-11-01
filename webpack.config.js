const SRC_DIR = './src',
      DIST_DIR = './docs',
      DIST_UNCOMPRESSED_DIR = './dist_uncompressed';

const SITE_DATA = {
  START_PATH: '',
  SITE_URL: 'https://nunifuchisaka.github.io/',
  SITE_NAME: 'ぬにふちさか',
};

const BROWSER_SYNC_CONFIG = {
  host: 'localhost',
};

const IMAGE_OPTIMIZATION_CONFIG = {
  IMG_TO_WEBP_SRC_DIR: 'img2webp',
  IMG_TO_WEBP2_SRC_DIR: 'img2webp2/src',
  IMG_TO_WEBP2_DIST_DIR: 'img2webp2/dist',
  WEBP_QUALITY: 50,
  RESIZE_WIDTH: 960,
};


// トップページの YouTube 欄。ビルドのたびに新しい順の動画を取りに行き、src/assets/data/youtube.json に保存する。
// 取れなかったとき（オフラインなど）は、保存済みの json をそのまま使う。
// チャンネルID（UC から始まる）が分かっていれば CHANNEL_ID に書くと、ハンドルからの検索を省ける。
const YOUTUBE_CONFIG = {
  HANDLE: 'nunifuchisaka',
  CHANNEL_ID: '',
  COUNT: 4,
  CACHE_FILE: 'src/assets/data/youtube.json',
};


// --- 以下、webpackの動作設定（通常は編集不要）---
const path = require('path'),
      glob = require('glob'),
      fs = require('fs'),
      RemoveEmptyScriptsPlugin = require('webpack-remove-empty-scripts'),
      BrowserSyncPlugin = require('browser-sync-webpack-plugin'),
      CopyPlugin = require('copy-webpack-plugin'),
      TerserPlugin = require('terser-webpack-plugin'),
      HtmlWebpackPlugin = require('html-webpack-plugin'),
      htmlMinifier = require('html-minifier-terser'),
      MiniCssExtractPlugin = require('mini-css-extract-plugin'),
      sharp = require('sharp'),
      postcss = require('postcss'),
      cssnano = require('cssnano'),
      StylelintPlugin = require('stylelint-webpack-plugin'),
      SRC_PATH = path.resolve(__dirname, SRC_DIR),
      DIST_PATH = path.resolve(__dirname, DIST_DIR),
      DIST_UNCOMPRESSED_PATH = path.resolve(__dirname, DIST_UNCOMPRESSED_DIR);

// img2webp2の日付リネーム処理で使う出力先キャッシュ（watchを跨いで永続化させる）
let img2webp2Cache = null;

let guides = [];
try {
  // フォルダが存在する場合のみ、ファイル名の一覧を配列で取得（.DS_Storeなどは除外）
  const targetFolder = path.resolve(DIST_PATH, 'assets/img/guide');
  if (fs.existsSync(targetFolder)) {
    guides = fs.readdirSync(targetFolder)
      .filter(file => !file.startsWith('.'))
      .reverse();
  }
} catch (e) {
  console.error('ファイル名の取得に失敗しました:', e);
}

// 案内実績（累計人数・活動期間・マイルストーン）を guides のファイル名から集計する
// ファイル名に日付が含まれないものは（不正な形式のファイルも含め）件数にのみ加算し、日付集計からは除外する
const MILESTONE_STEP = 50;
let guideStats = { total: guides.length, firstDate: null, lastDate: null, milestones: [] };
try {
  const dated = guides
    .map(file => {
      const matched = file.match(/(\d{4}-\d{2}-\d{2})/);
      return matched ? { file, date: matched[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dated.length) {
    guideStats.firstDate = dated[0].date;
    guideStats.lastDate = dated[dated.length - 1].date;
    for (let n = MILESTONE_STEP; n <= dated.length; n += MILESTONE_STEP) {
      guideStats.milestones.push({ count: n, date: dated[n - 1].date });
    }
  }
} catch (e) {
  console.error('案内実績の集計に失敗しました:', e);
}

// WebP 画像の幅・高さをファイルの先頭から読む（写真をトリミングせずに並べるため、縦横比を HTML に書き出す）
const readWebpSize = (file) => {
  try {
    const buf = Buffer.alloc(30);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buf, 0, 30, 0);
    fs.closeSync(fd);
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  } catch (e) {
    // 読めないときは縦横比なし（既定の比率で並ぶ）
  }
  return null;
};
const imageSizes = {};
['guide', 'cluster'].forEach((dir) => {
  const folder = path.resolve(DIST_PATH, 'assets/img', dir);
  if (!fs.existsSync(folder)) return;
  fs.readdirSync(folder).filter((file) => file.endsWith('.webp')).forEach((file) => {
    const size = readWebpSize(path.join(folder, file));
    if (size) imageSizes[`${dir}/${file}`] = size;
  });
});

// YouTube の新しい動画（YOUTUBE_CONFIG 参照）。EJS には youtube.videos を渡し、ビルド開始時に中身を更新する
const youtube = { channelUrl: `https://www.youtube.com/@${YOUTUBE_CONFIG.HANDLE}`, channelId: YOUTUBE_CONFIG.CHANNEL_ID, videos: [] };
const youtubeCachePath = path.resolve(__dirname, YOUTUBE_CONFIG.CACHE_FILE);
try {
  if (fs.existsSync(youtubeCachePath)) {
    const cached = JSON.parse(fs.readFileSync(youtubeCachePath, 'utf8'));
    youtube.channelId = youtube.channelId || cached.channelId || '';
    youtube.videos.push(...(cached.videos || []));
  }
} catch (e) {
  console.error('YouTube の保存データを読めませんでした:', e.message);
}
const decodeXml = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const fetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'accept-language': 'ja' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
};
let youtubeFetched = false;
const updateYoutube = async () => {
  if (youtubeFetched) return;
  youtubeFetched = true;
  try {
    if (!youtube.channelId) {
      const page = await fetchText(youtube.channelUrl);
      const found = page.match(/"externalId":"(UC[\w-]{22})"/) || page.match(/channel\/(UC[\w-]{22})/);
      if (!found) throw new Error('チャンネルIDが見つかりません');
      youtube.channelId = found[1];
    }
    const feed = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${youtube.channelId}`);
    const videos = [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => ({
      id: (entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1],
      title: decodeXml((entry.match(/<title>([^<]*)<\/title>/) || [])[1] || ''),
      published: (entry.match(/<published>([^<]+)<\/published>/) || [])[1],
    }))
      .filter((video) => video.id)
      .sort((a, b) => (b.published || '').localeCompare(a.published || ''))
      .slice(0, YOUTUBE_CONFIG.COUNT);
    if (!videos.length) throw new Error('動画が見つかりません');
    youtube.videos.splice(0, youtube.videos.length, ...videos);
    const json = JSON.stringify({ channelId: youtube.channelId, videos }, null, 2) + '\n';
    const before = fs.existsSync(youtubeCachePath) ? fs.readFileSync(youtubeCachePath, 'utf8') : '';
    if (json !== before) {
      fs.mkdirSync(path.dirname(youtubeCachePath), { recursive: true });
      fs.writeFileSync(youtubeCachePath, json);
    }
  } catch (e) {
    console.warn(`YouTube の新しい動画を取れませんでした（保存済みの${youtube.videos.length}件を使います）:`, e.message);
  }
};

/**
 * Webpack設定を生成する関数
 */
const createConfig_development = ({ outputPath }) => {

  const config = {
    mode: 'development',
    devtool: false,
    entry: {},
    output: {
      path: outputPath,
      filename: '[name].js',
      assetModuleFilename: 'assets/[name][ext][query]',
    },
    module: {
      rules: [
        {
          test: /\.(jpg|jpeg|png|webp|svg|gif|eot|ttf|woff)$/i,
          type: 'asset/inline',
          exclude: [
            /node_modules/,
            path.resolve(__dirname, IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP_SRC_DIR),
            path.resolve(__dirname, IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP2_SRC_DIR),
          ],
        },
      ]
    },
    plugins: [
      new RemoveEmptyScriptsPlugin(),
      {
        apply: (compiler) => {
          compiler.hooks.beforeRun.tapPromise('YoutubePlugin', updateYoutube);
          compiler.hooks.watchRun.tapPromise('YoutubePlugin', updateYoutube);
        },
      },
    ],
    watch: false,
  };

  // CSS
  glob.sync('**/*.scss', { cwd: SRC_PATH, ignore: '**/_*.scss' }).forEach(key => {
    config.entry[key.replace('.scss', '.css')] = path.resolve(SRC_PATH, key);
  });
  config.module.rules.push({
    test: /\.scss$/,
    use: [
      MiniCssExtractPlugin.loader,
      {
        loader: 'css-loader',
        options: {
          importLoaders: 3,
          url: {
            filter: (url, resourcePath) => {
              if (/(--pc|--sp|--exc)\.(jpg|jpeg|png|webp|svg|gif)(\?\d+)?$/i.test(url)) {
                return false;
              }
              if (url.startsWith('/')) {
                return false;
              }
              return true;
            },
          },
        }
      },
      'postcss-loader',
      {
        loader: 'resolve-url-loader',
        options: {
          sourceMap: true
        }
      },
      {
        loader: 'sass-loader',
        options: {
          sourceMap: true,
          implementation: require('sass'),
          sassOptions: {
            outputStyle: 'expanded'
          }
        }
      }
    ],
  });
  config.plugins.push(
    new MiniCssExtractPlugin({
      filename: '[name]'
    }),
    new StylelintPlugin({
      files: [`${SRC_DIR}/**/*.scss`],
      fix: true
    }),
    {
      apply: (compiler) => {
        compiler.hooks.emit.tap('RemoveCssBannerPlugin', (compilation) => {
          for (const assetName in compilation.assets) {
            if (assetName.endsWith('.css')) {
              const originalSource = compilation.assets[assetName].source().toString();
              const cleanedSource = originalSource.replace(/\/\*![\s\S]*?\*\//g, '');
              compilation.assets[assetName] = {
                source: () => cleanedSource,
                size: () => cleanedSource.length
              };
            }
          }
        });
      }
    }
  );

  // 独立ページ。EJS/SCSSのビルドを通さず静的コピーで dist_uncompressed へ配置し、
  // 後段の docs コピーで他ページと同じく html/css をminifyして公開する。
  // 新しい独立ページを足すときは、このディレクトリ名の配列に追加するだけでよい。
  // deepfrostice はサブディレクトリ（例 animation/）ごと丸ごとコピーされる。
  // なお .js は docs コピー側で除外され、production の `**/*.js` エントリ側が
  // babel＋Terserを通して docs へ出力する（dist_uncompressed には素のまま残る）。
  const STANDALONE_PAGES = ['deepfrostice', 'heartbeat', 'imagegetter', 'glossyskin', 'deskcinema', 'publicwalker', 'keydisplay', 'nuniavatartoolkit', 'spiderweb', 'gashadokuro', 'regret'];
  config.plugins.push(
    new CopyPlugin({
      patterns: [
        ...STANDALONE_PAGES.map(dir => ({
          from: path.resolve(SRC_PATH, dir),
          to: path.resolve(outputPath, dir),
          globOptions: {
            ignore: ['**/.DS_Store', '**/Thumbs.db'],
          },
        })),
        {
          from: path.resolve(SRC_PATH, 'assets/img'),
          to: path.resolve(outputPath, 'assets/img'),
          globOptions: {
            ignore: ['**/.DS_Store', '**/Thumbs.db'],
          },
          noErrorOnMissing: true,
        },
      ],
    })
  );

  // HTML
  glob.sync('**/*.ejs', { cwd: SRC_PATH, ignore: '**/_*.ejs' }).forEach(key => {
    config.plugins.push(
      new HtmlWebpackPlugin({
        template: path.resolve(SRC_PATH, key),
        filename: key.replace('.ejs', '.html'),
        inject: false,
        minify: false,
      })
    );
  });
  config.module.rules.push({
    test: /\.ejs$/i,
    use: [
      {
        loader: 'html-loader',
        options: {
          sources: false,
          minimize: false
        }
      }, {
        loader: 'ejs-plain-loader',
        options: {
          data: {
            ...SITE_DATA,
            guides: guides,
            guideStats: guideStats,
            imageSizes: imageSizes,
            youtube: youtube
          }
        }
      }
    ]
  });

  return config;
}
const createConfig_production = ({ outputPath }) => {

  const config = {
    mode: 'production',
    entry: {},
    output: {
      path: outputPath,
      filename: '[name].js',
      assetModuleFilename: 'assets/[name][ext][query]',
    },
    module: {
      rules: []
    },
    plugins: [], 
    optimization: {
      minimize: true,
      minimizer: [ new TerserPlugin({ extractComments: false }) ],
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'assets/js/vendor',
            chunks: 'all',
            enforce: true
          }
        }
      }
    },
    watch: true,
    watchOptions: {
      ignored: [
        '**/node_modules/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        './img2webp/**/*.webp',
        '**/img2webp2/dist/**',
      ],
    },
  };

  // JS
  glob.sync('**/*.js', { cwd: SRC_PATH, ignore: '**/_*.js' }).forEach(key => {
    config.entry[key.replace('.js', '')] = path.resolve(SRC_PATH, key);
  });
  config.module.rules.push({
    test: /\.js$/,
    exclude: /node_modules/,
    use: 'babel-loader'
  });

  config.plugins.push(
    new CopyPlugin({
      patterns: [
        // ① img2webp（リサイズなし、WebP化のみ）
        {
          // ⭕ `path.resolve` を使わず、コンテキスト（基準位置）を指定して相対パスで記述することでバグを解消
          context: path.resolve(__dirname, IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP_SRC_DIR),
          from: '**/*.{jpg,jpeg,png}',
          to: path.join(__dirname, IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP_SRC_DIR, '[path][name].webp'),
          async transform(content) {
            return await sharp(content)
              .webp({ quality: IMAGE_OPTIMIZATION_CONFIG.WEBP_QUALITY })
              .toBuffer();
          },
          noErrorOnMissing: true,
        },
        // ② img2webp2（日付リネーム＋リサイズ＋WebP変換）
        {
          context: path.resolve(__dirname, IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP2_SRC_DIR),
          from: '**/*.{jpg,jpeg,png}',
          to(pathData) {
            if (!img2webp2Cache) {
              img2webp2Cache = {
                sourceMap: new Map(), // 元ファイル -> 出力先の紐付け
                usedPaths: new Set()  // すでに予約された出力先一覧
              };
            }
            const absoluteFilename = pathData.absoluteFilename;
            const sourceName = path.parse(absoluteFilename).name;
            const targetDir = path.resolve(
              __dirname,
              IMAGE_OPTIMIZATION_CONFIG.IMG_TO_WEBP2_DIST_DIR
            );
            const match = sourceName.match(
              /^VRChat_(\d{4}-\d{2}-\d{2})_(\d{2})-\d{2}-\d{2}/
            );
            let baseName = sourceName;
            if (match) {
              const dateStr = match[1];
              const hour = parseInt(match[2], 10);
              if (hour < 5) {
                const date = new Date(dateStr);
                date.setDate(date.getDate() - 1);
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                baseName = `VRChat_${yyyy}-${mm}-${dd}`;
              } else {
                baseName = `VRChat_${dateStr}`;
              }
            }

            // すでにこのファイル（絶対パス）を一度処理したことがあるなら、その時の名前をそのまま返す（2重処理対策）
            if (img2webp2Cache.sourceMap.has(absoluteFilename)) {
              return path.relative(outputPath, img2webp2Cache.sourceMap.get(absoluteFilename));
            }

            let finalName = baseName;
            let index = 0;
            while (true) {
              const absoluteOutputPath = path.join(targetDir, `${finalName}.webp`);
              
              // ディスクに存在せず、他のファイルにも予約されていなければ確定
              if (!fs.existsSync(absoluteOutputPath) && !img2webp2Cache.usedPaths.has(absoluteOutputPath)) {
                img2webp2Cache.sourceMap.set(absoluteFilename, absoluteOutputPath);
                img2webp2Cache.usedPaths.add(absoluteOutputPath);
                return path.relative(outputPath, absoluteOutputPath);
              }

              index++;
              if (index <= 26) {
                finalName = `${baseName}${String.fromCharCode(96 + index)}`;
              } else {
                finalName = `${baseName}_${index}`;
              }
            }
          },
          async transform(content) {
            return await sharp(content)
              .resize({
                width: IMAGE_OPTIMIZATION_CONFIG.RESIZE_WIDTH,
                withoutEnlargement: true,
              })
              .webp({
                quality: IMAGE_OPTIMIZATION_CONFIG.WEBP_QUALITY,
              })
              .toBuffer();
          },
          noErrorOnMissing: true,
        },
        {
          from: DIST_UNCOMPRESSED_PATH,
          to: DIST_PATH,
          globOptions: {
            ignore: ['**/*.js', '**/.DS_Store', '**/Thumbs.db'],
          },
          transform: async (content, absoluteFrom) => {
            if (absoluteFrom.endsWith('.html')) {
              return await htmlMinifier.minify(
                content.toString(), {
                collapseBooleanAttributes: true,
                collapseWhitespace: true,
                removeComments: true,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                useShortDoctype: true,
                minifyJS: true,
                minifyCSS: true,
                processScripts: ['application/ld+json'],
                includeAutoGeneratedTags: false,
              });
            }
            if (absoluteFrom.endsWith('.css')) {
              return (
                await postcss([cssnano({ preset: ['default', { discardComments: { removeAll: true } }] })]).process(content, { from: undefined })).css;
            }
            return content;
          },
        },
      ]
    }),
    new BrowserSyncPlugin({
      ...BROWSER_SYNC_CONFIG,
      server: {
        baseDir: [DIST_DIR]
      },
      files: [
        DIST_DIR + '/**/*.html',
        DIST_DIR + '/**/*.css',
        DIST_DIR + '/**/*.js'
      ],
      ghostMode: false,
    }, { reload: true })
  );

  return config;
};

// sharpのファイルロックによる書き込みエラーを防ぐ
sharp.cache(false);

module.exports = [
  createConfig_development({
    outputPath: DIST_UNCOMPRESSED_PATH,
  }),
  createConfig_production({
    outputPath: DIST_PATH,
  }),
];
