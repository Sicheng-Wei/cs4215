module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'standard-with-typescript',
    // Prettier should always come last so that it overrides other configs.
    'prettier'
  ],
  ignorePatterns: ['src/lang/'],
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: 'tsconfig.json'
  },
  rules: {}
};
