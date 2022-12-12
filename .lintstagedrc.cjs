module.exports = {
  "*.{tsx,ts}": ["eslint --cache --fix --max-warnings=0", "prettier --write"],
  "*.{pcss,css,js,json,html}": ["prettier --write"],
};
