# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -fsSL https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.sh | bash -s -- --auto --version=1.0.40
```

Windows with Power Shell:

```powershell
iwr https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.ps1 -UseBasicParsing | iex; Install-VSCodeEslintDefaults -Version 1.0.40 -Auto
```

Flags:
- Default install behavior is no CSS, Markdown on, Vue off; use `--auto` / `-Auto` to detect from project files/dependencies.
- Enable CSS/SCSS linting with `--css` or `-Css`.
- Enable Markdown linting/formatting with `--md` or `-Md`.
- Force the Vue lint stack on with `--vue` or `-Vue`.
- Auto-detect CSS/Markdown usage and Vue dependencies with `--auto` or `-Auto`.
- Override the release with `--version=1.0.40` / `-Version 1.0.40` (defaults to 1.0.40 or `$VSCODE_ESLINT_DEFAULTS_VERSION`).

The installer downloads the release tarball, lays down the config files, runs `configure-eslint.cjs`, and removes the configure script afterward. It also updates scripts in `package.json` and refreshes lint dependencies.

Markdown files are wrapped to 80 columns via the bundled `.prettierrc.json` (`proseWrap: "always"`).

## Update Later

After the first install, keep `lintconfig.cjs` in your project so updates can be pulled later:

```bash
npm run lintconfig -- --css
```

These flags also work with `node configure-eslint.cjs` and `npm run lintconfig --`. Unknown options are ignored with a warning.
With `--auto`, CSS/Markdown are detected from files and Vue from dependencies (explicit flags still win).
When you run the installer/configure step, the generated `lintconfig` script is updated with the selected CSS/Markdown/Vue flags so future updates reuse them.

Example:

```bash
node configure-eslint.cjs --css --no-md --vue
```

### Command Usage

```bash
`npm run lint` - Shows errors but is non-destructive
`npm run lintfix` - Fixes errors and warnings that eslint can sort out itself
`npm run pretty` - Formats files using prettier and `.prettierrc` settings
`npm run format` - Runs lintfix and prettier via `npm-run-all` (`run-s`)
`npm run cleanbuild` - Cleans dist via `rimraf`, then runs format and build via `npm-run-all` (`run-s`)
`npm run lintconfig` - Downloads the latest installer and refreshes lint config
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
