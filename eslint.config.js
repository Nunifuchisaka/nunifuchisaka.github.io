const globals = require('globals');
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        $: 'readonly',
        jQuery: 'readonly'
      }
    },
    rules: {
      'semi': ['error', 'always'],
      'no-unused-vars': 'warn',
    }
  }
];