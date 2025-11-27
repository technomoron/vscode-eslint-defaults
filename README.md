# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -L https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.23/installer.tgz | tar -vxz --no-same-owner && node configure-eslint.cjs && rm configure-eslint.cjs
```

Windows with Power Shell

```bash
Invoke-WebRequest -Uri https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.23/installer.tgz -OutFile installer.tgz; tar -xvzf installer.tgz; node configure-eslint.cjs; Remove-Item -Force installer.tgz, configure-eslint.cjs

```

The configure script will remove old eslint packages and add new ones,
update eslint to v9.x and add some script targets to package.json

Markdown files are wrapped to 80 columns via the bundled `.prettierrc.json` (`proseWrap: "always"`).

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
