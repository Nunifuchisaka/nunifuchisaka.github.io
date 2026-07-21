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

  // 独立ページ（自己完結HTML）。EJS/SCSSのビルドやlintを通さず静的コピーで
  // dist_uncompressed へ配置し、後段の docs コピーで他ページと同じくminifyして公開する。
  // 新しい独立ページを足すときは、このディレクトリ名の配列に追加するだけでよい。
  const STANDALONE_PAGES = ['deepfrostice', 'param-animation'];
  config.plugins.push(
    new CopyPlugin({
      patterns: STANDALONE_PAGES.map(dir => ({
        from: path.resolve(SRC_PATH, dir),
        to: path.resolve(outputPath, dir),
        globOptions: {
          ignore: ['**/.DS_Store', '**/Thumbs.db'],
        },
      })),
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
            guideStats: guideStats
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