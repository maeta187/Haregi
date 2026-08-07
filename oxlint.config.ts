import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'oxlint';

const BUILTIN_RULES = new Set(['rules-of-hooks', 'exhaustive-deps']);

/**
 * React Hooks用のカスタムJSプラグインルール設定
 * builtin ルール（rules-of-hooks, exhaustive-deps）を除外し、
 * React Hooks推奨ルールをreact-hooks-js/プレフィックスに変換
 */
const reactHooksJsRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules)
    // builtin ルールを除外して、カスタムJS用ルールのみを抽出
    .filter(([key]) => !BUILTIN_RULES.has(key.replace('react-hooks/', '')))
    // ルールキーのプレフィックスを react-hooks/ → react-hooks-js/ に変換
    .map(([key, severity]) => [
      key.replace('react-hooks/', 'react-hooks-js/'),
      severity,
    ]),
);

export default defineConfig({
  // 明確な誤りは警告ではなくエラーにして、pnpm lint を品質ゲートとして機能させる
  // (rules の個別指定が優先されるため、下の exhaustive-deps は warn のまま)
  categories: { correctness: 'error' },
  plugins: ['typescript', 'react', 'import', 'jsx-a11y'],
  jsPlugins: [
    { name: 'react-hooks-js', specifier: 'eslint-plugin-react-hooks' },
  ],
  rules: {
    'no-unused-vars': 'off',
    'typescript/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    ...reactHooksJsRules,
  },
  ignorePatterns: ['dist/'],
});
