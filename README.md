# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -L https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.11/installer.tgz | tar -vxz && node configure-eslint.cjs && rm installer.tgz configure-eslint.cjs
```
<<<<<<< Updated upstream
=======

will copy the config files into <dest_dir> and install the lint/format targets in
scripts: {} in package.json.
>>>>>>> Stashed changes

Windows with Power Shell

```bash
Invoke-WebRequest -Uri https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.11/installer.tgz -OutFile installer.tgz; tar -xvzf installer.tgz; node configure-eslint.cjs; Remove-Item -Force installer.tgz, configure-eslint.cjs

```

<<<<<<< Updated upstream
The configure script will remove old eslint packages and add new ones,
update eslint to v9.x and add some script targets to package.json
=======
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
>>>>>>> Stashed changes
