import vue from 'eslint-plugin-vue';
import vueTsConfigs from '@vue/eslint-config-typescript';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'packages/palette-engine/src/families.ts'],
  },
  ...vue.configs['flat/essential'],
  ...vueTsConfigs(),
  {
    // vendored shadcn-vue components use single-word names by convention
    files: ['apps/stripper-studio/src/components/ui/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // formatting is intentionally not linted (add a formatter later if wanted)
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
    },
  },
];
