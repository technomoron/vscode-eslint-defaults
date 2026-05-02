# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -fsSL https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.sh | bash -s -- --auto
```

Windows with PowerShell:

```powershell
iwr https://raw.githubusercontent.com/technomoron/vscode-eslint-defaults/master/install.ps1 -UseBasicParsing | iex; Install-VSCodeEslintDefaults -Auto
```

On Windows, use the PowerShell command even if Git Bash is installed. The
PowerShell installer uses `Invoke-WebRequest` and Windows' built-in `tar.exe`
instead of PATH-resolved Unix tools.

Flags:
- Default install behavior is no CSS, Markdown on, Vue off; use `--auto` / `-Auto` to detect from project files/dependencies.
- Enable CSS/SCSS linting with `--css` or `-Css`.
- Enable Markdown linting/formatting with `--md` or `-Md`.
- Force the Vue lint stack on with `--vue` or `-Vue`.
- Auto-detect CSS/Markdown usage and Vue dependencies with `--auto` or `-Auto`.
- Installers default to the latest GitHub release. Pin a release with `--version=1.0.43` / `-Version 1.0.43`, or force latest with `--latest` / `-Latest`.

The installer downloads the release tarball, lays down the config files, runs `configure-eslint.cjs`, and removes the configure script afterward. It also updates scripts in `package.json` and refreshes lint dependencies.

Markdown files are wrapped to 80 columns via the bundled `.prettierrc.json` (`proseWrap: "always"`).

## Update Later

After the first install, keep `lintconfig.cjs` in your project so updates can be pulled later:

```bash
npm run lintconfig -- --css
```

These flags also work with `node configure-eslint.cjs` and `npm run lintconfig --`. Unknown options are ignored with a warning.
With `--auto`, CSS/Markdown are detected from files and Vue from dependencies (explicit flags still win).
When you run the installer/configure step, the generated `lintconfig` script is updated with the selected CSS/Markdown/Vue flags so future updates reuse them. The updater always downloads the latest installer archive.

In a monorepo, Vue detection only reads the root `package.json` and will not find Vue declared in sub-packages. Use `--vue` / `-Vue` explicitly in that case.

Example:

```bash
node configure-eslint.cjs --css --no-md --vue
```

### Command Usage

```bash
npm run lint        # Shows errors but is non-destructive
npm run lintfix     # Fixes errors and warnings that eslint can sort out itself
npm run pretty      # Formats files using prettier and .prettierrc settings
npm run format      # Runs lintfix and pretty via npm-run-all (run-s)
npm run cleanbuild  # Cleans dist via rimraf, then runs format and build via npm-run-all (run-s)
npm run lintconfig  # Downloads the latest installer and refreshes lint config
```

## Required VSCode Plugins

- Prettier - Code Formatter (Prettier)
- ESLint (Microsoft)

### Required for Vue projects

- Vue Official (Vue)

### Recommended

- Remote Explorer (Microsoft) - Make VSCode work over SSH

### Nice to Have

- TODO Highlights (Highlights TODO: xxx comments in source)
- remark (preview MD files inside VSCode)
