# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -fsSL https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.sh | bash -s -- [--no-css] [--no-markdown] [--version 1.0.25]
```

Windows with Power Shell:

```powershell
iwr https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.ps1 -UseBasicParsing | iex; Install-VSCodeEslintDefaults -Version 1.0.25 [-NoCss] [-NoMarkdown]
```

Flags:
- CSS/SCSS linting is on by default; disable with `--no-css` or `-NoCss`.
- Markdown formatting is on by default (no ESLint code-block linting); disable with `--no-markdown` or `-NoMarkdown`.
- Override the release with `--version <v>` / `-Version <v>` (defaults to 1.0.25 or `$VSCODE_ESLINT_DEFAULTS_VERSION`).

The installer downloads the release tarball, lays down the config files, runs `configure-eslint.cjs`, and removes the configure script afterward. It also updates scripts in `package.json` and refreshes lint dependencies.

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
