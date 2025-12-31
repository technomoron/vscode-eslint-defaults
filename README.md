# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -fsSL https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.sh | bash -s -- [--css] [--no-css] [--md] [--no-md] [--version 1.0.32]
```

Windows with Power Shell:

```powershell
iwr https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.ps1 -UseBasicParsing | iex; Install-VSCodeEslintDefaults -Version 1.0.32 [-Css] [-NoCss] [-Md] [-NoMd]
```

Flags:
- CSS/SCSS linting is off by default; enable with `--css` or `-Css` (disable with `--no-css` or `-NoCss`).
- Markdown formatting is on by default (no ESLint code-block linting); disable with `--no-md` or `-NoMd` (enable with `--md` or `-Md`).
- Override the release with `--version <v>` / `-Version <v>` (defaults to 1.0.32 or `$VSCODE_ESLINT_DEFAULTS_VERSION`).

The installer downloads the release tarball, lays down the config files, runs `configure-eslint.cjs`, and removes the configure script afterward. It also updates scripts in `package.json` and refreshes lint dependencies.

Markdown files are wrapped to 80 columns via the bundled `.prettierrc.json` (`proseWrap: "always"`).

## Update Later

After the first install, keep `lintconfig.cjs` in your project so updates can be pulled later:

```bash
npm run lintconfig -- --css
```

These flags also work with `node configure-eslint.cjs` and `npm run lintconfig --`. Unknown options are ignored with a warning.

Example:

```bash
node configure-eslint.cjs --css --no-md
```

### Command Usage

```bash
`npm run lint` - Shows errors but is non-destructive
`npm run lintfix` - Fixes errors and warnings that eslint can sort out itself
`npm run pretty` - Formats files using prettier and `.prettierrc` settings
`npm run format` - Runs lintfix and prettier
`npm run cleanbuild` - Cleans dist, formats, then builds
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
