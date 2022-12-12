module.exports = {
  "*.{tsx,ts}": [
    "eslint --cache --fix --max-warnings=0",
    "prettier --ignore-path .gitignore --write",
  ],
  "*.{pcss,css,js,json,html}": ["prettier --ignore-path .gitignore --write"],
};
