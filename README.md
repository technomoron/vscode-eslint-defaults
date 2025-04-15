# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Manual Install

- Copy `.vscode/*` for editor and extension config
- Copy `.eslintrc.cjs`/`.eslintignore` for eslint config
- Copy `.prettierrc` for prettier config
- Copy `.editorconfig` for universal editor config (cross editor)

## Scripted Install

```bash
installer.js <dest_dir>
```
will copy the config files into <dest_dir> and install the lint/format targets in
scripts: {} in package.json.

Warning: Will overwrite current config files and may shuffle the order of entries in package.json.

## Required Packages

```bash
npm install --save-dev \
  eslint \
  prettier \
  eslint-config-standard \
  eslint-plugin-import \
  vue-eslint-parser \
  eslint-plugin-vue \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

## NPM Scripts

Add these to your `package.json`:

```json
"scripts": {
  "lint": "eslint --ext .js,.ts,.vue ./",
  "lintfix": "eslint --fix --ext .js,.ts,.vue ./",
  "format": "prettier --write \"**/*.{js,jsx,ts,tsx,vue,json,css,scss,md}\""
}
```

### Command Usage

```bash
`npm run lint` - Shows errors but is non-destructive
`npm run lintfix` - Fixes errors and warnings that eslint can sort out itself
`npm run format` - Formats code using prettier and `.prettierrc` settings
```

## Required VSCode Plugins

- Vue Official (Vue)
- Prettier - Code Formatter (Prettier)
- ESLint (Microsoft)

### Recommended

- Remote Explorer (Microsoft) - Make VSCode work over SSH

### Nice to Have

- TODO Highlights (Highlights TODO: xxx comments in source)
- remark (preview MD files inside VSCode)

## Install files using install script

