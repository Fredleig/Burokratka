module.exports = {
  "env": {
    "browser": true,
    "node": true,
    "commonjs": true,
    "es2021": true
  },
  "extends": ["eslint:recommended","eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": 15
  },
  "rules": {
    "no-empty": ["error", { "allowEmptyCatch": true }]
  },
  "overrides": [
    {
      "files": ["tests/**/*"],
      "env": {
        "jest": true
      }
    }
  ]
};
