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
instead of PATH-resolved Unix tools. Running `install.sh` from Git Bash hands
over to `install.ps1` for the same reason.

Flags:

- Default install behavior is no CSS, Markdown on, Vue off; use `--auto` /
  `-Auto` to detect from project files/dependencies.
- Enable CSS/SCSS linting with `--css` or `-Css`.
- Enable Markdown linting/formatting with `--md` or `-Md`.
- Force the Vue lint stack on with `--vue` or `-Vue`.
- Auto-detect CSS/Markdown usage and Vue dependencies with `--auto` or `-Auto`.
- Update eligible pnpm workspace package scripts with `--recursive` / `-r` or
  `-Recursive`.
- Remove lint packages this installer does not manage with `--purge-lint-deps`
  or `-PurgeLintDeps`. Off by default; see [Dependencies](#dependencies).
- Installers default to the latest GitHub release. Pin a release with
  `--version=1.0.45` / `-Version 1.0.45`, or force latest with `--latest` /
  `-Latest`. An explicit version wins over
  `$VSCODE_ESLINT_DEFAULTS_VERSION`.

`install.sh` and `install.ps1` reject unknown options. `configure-eslint.cjs`
and `lintconfig.cjs` warn about unknown options and carry on.

Node.js 24 or newer is required.

## What the installer changes

The installer downloads the release tarball, verifies it against the published
`installer.tgz.sha256`, and unpacks it into a temporary directory. Nothing is
extracted over your project. `configure-eslint.cjs` then copies in only the
files it needs:

- `eslint.config.mjs`, `lintconfig.cjs` and (with `--css`) `stylelint.config.cjs`
  are written. An existing file with different contents is first saved as
  `<name>.bak`.
- `.prettierrc.json` is only written when the project has no Prettier config at
  all. An existing `.prettierrc`, `.prettierrc.json`, `prettier.config.cjs` or
  `prettier` key in `package.json` is left alone.
- `.vscode/settings.json` and `.vscode/extensions.json` are merged, not
  replaced. Unrelated settings and extension recommendations are kept; the keys
  this package sets are updated to the defaults.
- Legacy ESLint configs (`.eslintrc*`, `eslint.config.js`, `.eslintignore`) are
  saved as `<name>.bak` and removed.
- `package.json` gets the lint scripts below, keeping its existing indentation.

If `package.json` is missing, the installer stops before changing anything.

Markdown files are wrapped to 80 columns via the bundled `.prettierrc.json`
(`proseWrap: "always"`).

## Dependencies

The installer manages a fixed set of lint packages: ESLint, Prettier,
Stylelint, the TypeScript and Vue plugins, and their shared config packages. It
removes one of those only when your flags no longer call for it, for example
dropping `stylelint` after a `--no-css` run. `tslint` is always removed.

Everything else is left alone. Project plugins such as `eslint-plugin-react`,
`prettier-plugin-tailwindcss` or `stylelint-order` survive an install.

Pass `--purge-lint-deps` to also strip every dependency whose name contains
`eslint`, `prettier` or `stylelint` and that this installer does not manage.
That removes real project plugins, so it is off by default.

### pnpm and install scripts

pnpm 10 and newer will not run a dependency's install script until you approve
it, and exits non-zero when it skips one. `eslint-plugin-import-x` pulls in
`unrs-resolver`, which has such a script, so a first install on pnpm can stop
with `ERR_PNPM_IGNORED_BUILDS`. Approve it and run the installer again:

```bash
pnpm approve-builds
```

Or allow it in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  unrs-resolver: true
```

## Update Later

After the first install, keep `lintconfig.cjs` in your project so updates can be
pulled later:

```bash
npm run lintconfig -- --css
```

These flags also work with `node configure-eslint.cjs`. With `--auto`,
CSS/Markdown are detected from files and Vue from dependencies; explicit flags
still win. When you run the installer or the configure step, the generated
`lintconfig` script is updated with the selected CSS/Markdown/Vue flags so
future updates reuse them.

`lintconfig.cjs` follows the latest release by default. Pin it with
`--version=1.0.45`, or set `GITHUB_TOKEN` if you hit the anonymous GitHub API
rate limit on shared CI addresses.

Use `--recursive` in pnpm workspaces to update scripts for workspace packages
that look like real npm package targets. The installer uses pnpm's workspace
package list, skips arbitrary nested `package.json` files, and keeps shared
ESLint/Prettier/Stylelint configs in the workspace root.

In a monorepo, Vue detection reads workspace package dependencies only when
`--recursive` is used. Without it, use `--vue` / `-Vue` explicitly when Vue is
declared only in a child package.

Example:

```bash
node configure-eslint.cjs --css --no-md --vue
```

### Scripts added to your project

```bash
npm run lint        # Shows errors but is non-destructive
npm run lintfix     # Fixes errors and warnings that eslint can sort out itself
npm run pretty      # Formats files using prettier and .prettierrc settings
npm run format      # Runs lintfix and pretty via npm-run-all (run-s)
npm run cleanbuild  # Cleans dist via rimraf, then runs format and build via npm-run-all (run-s)
npm run lintconfig  # Downloads the latest installer and refreshes lint config
```

`cleanbuild` expects your project to have its own `build` script.

ESLint 10 selects files through the `files` entries in `eslint.config.mjs`, so
the generated scripts pass no `--ext` flag. Markdown and Vue rules switch on
when `@eslint/markdown` and `eslint-plugin-vue` are installed, which the
installer handles from your flags.

### Rules

The shipped config enables ESLint's own recommended rules, `import-x/order`,
double quotes in JSON, and the TypeScript, Vue and Markdown recommended sets
that apply to the installed plugins. `no-undef` is off for TypeScript and Vue
files, where the compiler already reports unknown identifiers.

## Working on this repo

`installer/` holds the files that ship in the release archive. The copies at the
repo root are generated from it:

```bash
npm run sync-configs        # Copy installer/ config files to the repo root
npm test                    # Sync check, unit tests, then lint
```

Edit the file under `installer/` and run `npm run sync-configs`; `npm test`
fails if the two ever differ.

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
