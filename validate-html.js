const { HtmlValidate } = require('html-validate');
const path = require('path');

// .htmlvalidate.json ファイルを読み込む
const config = require('./.htmlvalidate.json');
const htmlvalidate = new HtmlValidate(config);

async function validateAllHtml() {
  try {
    // 設定ファイルで指定された全てのファイルを一括で検証
    const report = await htmlvalidate.validate();

    if (report.valid) {
      console.log('\x1b[32m%s\x1b[0m', 'All HTML files are valid!');
    } else {
      console.error('\x1b[31m%s\x1b[0m', `HTML validation failed with ${report.errorCount} error(s).`);

      // ファイルごとに結果を整形して出力
      report.results.forEach(result => {
        // process.cwd() は現在の作業ディレクトリの絶対パスを返す
        const relativePath = path.relative(process.cwd(), result.filePath);
        console.log(`\n--- Validation results for: \x1b[36m${relativePath}\x1b[0m ---`);
        result.messages.forEach(msg => {
          console.log(`  - [L${msg.line}:${msg.column}] ${msg.message} (${msg.ruleId})`);
        });
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('An unexpected error occurred during validation:', error);
    process.exit(1);
  }
}

validateAllHtml();