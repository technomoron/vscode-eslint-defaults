#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Config files ship next to this script. The installers extract the release
// archive into a temporary directory and run it from there, so `__dirname` is
// where the defaults live and `process.cwd()` is the project being configured.
const assetDir = __dirname;
const projectDir = process.cwd();

const legacyEslintConfigs = [
	'.eslintignore',
	'.eslintrc',
	'.eslintrc.js',
	'.eslintrc.cjs',
	'.eslintrc.mjs',
	'.eslintrc.json',
	'.eslintrc.yml',
	'.eslintrc.yaml',
	'eslint.config.js',
	'eslint.config.cjs'
];

const prettierConfigNames = [
	'.prettierrc',
	'.prettierrc.json',
	'.prettierrc.json5',
	'.prettierrc.yml',
	'.prettierrc.yaml',
	'.prettierrc.js',
	'.prettierrc.cjs',
	'.prettierrc.mjs',
	'prettier.config.js',
	'prettier.config.cjs',
	'prettier.config.mjs'
];

const coreDependencies = [
	'eslint@^10.8.0',
	'@eslint/js@^10.0.1',
	'globals@^17.8.0',
	'prettier@^3.9.6',
	'npm-run-all@^4.1.5',
	'rimraf@^6.1.3',
	'eslint-config-prettier@^10.1.8',
	'jsonc-eslint-parser@^3.1.0',
	'@typescript-eslint/eslint-plugin@^8.65.0',
	'@typescript-eslint/parser@^8.65.0',
	'eslint-plugin-import-x@^4.17.1'
];

const markdownDependencies = ['@eslint/markdown@^8.0.3'];
const cssDependencies = ['stylelint@^17.14.1', 'stylelint-config-standard-scss@^17.0.0'];
const vueDependencies = [
	'eslint-plugin-vue@^10.10.0',
	'vue-eslint-parser@^10.4.1',
	'@vue/eslint-config-typescript@^14.9.0'
];

// Removed whenever present. TSLint has been deprecated since 2019 and conflicts
// with the ESLint setup this script installs.
const bannedDependencies = ['tslint'];

const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

// Only consulted with --purge-lint-deps. Matching on a substring catches real
// project plugins (eslint-plugin-react, prettier-plugin-tailwindcss, ...), so it
// is never the default.
const lintNameTokens = ['eslint', 'prettier', 'stylelint'];

const workspaceScriptSignals = [
	'build',
	'cleanbuild',
	'dev',
	'start',
	'test',
	'typecheck',
	'lint',
	'lintfix',
	'format',
	'pretty'
];

const ignoredScanDirs = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.output', '.nuxt']);

// Every dependency this installer knows how to add. A name in this set that is
// not part of the current plan is left over from a previous run with different
// flags, so it is safe to remove.
const managedLintDependencies = new Set(
	stripVersions([...coreDependencies, ...markdownDependencies, ...cssDependencies, ...vueDependencies])
);

const removedDependencyNames = new Set();
let dependenciesToInstall = [];
let plannedDependencyNames = new Set();
let vueStackEnabled = false;

function run(command, { allowFail = false } = {}) {
	console.log(`\n→ ${command}`);
	try {
		execSync(command, { stdio: 'inherit' });
	} catch (err) {
		if (allowFail) {
			console.warn(`Command failed (ignored): ${command}`);
			return false;
		}
		throw err;
	}
	return true;
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Keep whatever indentation the file already uses so updating package.json does
// not produce a whole-file diff. Falls back to tabs, matching the Prettier
// config this installer ships.
function detectIndent(raw) {
	const match = raw.match(/\n([ \t]+)\S/);
	return match ? match[1] : '\t';
}

function writeJson(filePath, value, indent) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(value, null, indent) + '\n');
}

function backupFile(filePath) {
	const backupPath = `${filePath}.bak`;
	fs.copyFileSync(filePath, backupPath);
	console.log(`Saved existing ${path.basename(filePath)} to ${path.basename(backupPath)}`);
}

// Copies a shipped config file into the project. Anything already there is kept
// as a .bak first, because the file may contain project-specific changes.
function installAssetFile(name, { backup = true } = {}) {
	const source = path.join(assetDir, name);
	const destination = path.join(projectDir, name);

	if (!fs.existsSync(source) || path.resolve(source) === path.resolve(destination)) {
		return;
	}

	if (fs.existsSync(destination)) {
		const current = fs.readFileSync(destination);
		if (current.equals(fs.readFileSync(source))) {
			return;
		}
		if (backup) {
			backupFile(destination);
		}
	}

	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.copyFileSync(source, destination);
	console.log(`Installed ${name}`);
}

function removeProjectFile(name, reason) {
	const target = path.join(projectDir, name);
	if (!fs.existsSync(target)) {
		return;
	}

	backupFile(target);
	fs.unlinkSync(target);
	console.log(`Removed ${name}${reason ? ` (${reason})` : ''}`);
}

function removeLegacyEslintConfigs() {
	const found = legacyEslintConfigs.filter((name) => fs.existsSync(path.join(projectDir, name)));
	if (found.length === 0) {
		return;
	}

	console.log(`Replacing legacy ESLint config: ${found.join(', ')}`);
	found.forEach((name) => removeProjectFile(name));
}

function installPrettierConfig(manifest) {
	const existing = prettierConfigNames.find((name) => fs.existsSync(path.join(projectDir, name)));
	if (existing) {
		console.log(`Keeping existing Prettier config (${existing}).`);
		return;
	}

	if (manifest.prettier) {
		console.log('Keeping existing Prettier config ("prettier" key in package.json).');
		return;
	}

	installAssetFile('.prettierrc.json');
}

const stylelintVsCodeSettings = [
	['stylelint.enable', true],
	['stylelint.validate', ['css', 'scss']],
	['css.validate', false],
	['scss.validate', false]
];

const stylelintExtension = 'stylelint.vscode-stylelint';

function valuesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

// Applies the shipped defaults on top of whatever the project already has,
// rather than replacing the file, so unrelated editor settings survive.
function configureVsCodeSettings(cssEnabled) {
	const settingsPath = path.join(projectDir, '.vscode', 'settings.json');
	const defaultsPath = path.join(assetDir, '.vscode', 'settings.json');
	const defaults = fs.existsSync(defaultsPath) ? readJson(defaultsPath) : {};

	let settings = {};
	let indent = '\t';
	const exists = fs.existsSync(settingsPath);

	if (exists) {
		const raw = fs.readFileSync(settingsPath, 'utf8');
		indent = detectIndent(raw);
		try {
			settings = JSON.parse(raw);
		} catch {
			console.warn(`Could not parse ${settingsPath}; skipping VSCode settings update.`);
			return;
		}
	}

	const merged = { ...settings, ...defaults };

	stylelintVsCodeSettings.forEach(([key, value]) => {
		if (cssEnabled) {
			merged[key] = value;
		} else {
			delete merged[key];
		}
	});

	if (exists && valuesEqual(settings, merged)) {
		return;
	}

	writeJson(settingsPath, merged, indent);
	console.log(exists ? 'Updated .vscode/settings.json.' : 'Created .vscode/settings.json.');
}

function configureVsCodeExtensions(cssEnabled) {
	const extensionsPath = path.join(projectDir, '.vscode', 'extensions.json');
	const defaultsPath = path.join(assetDir, '.vscode', 'extensions.json');
	const defaults = fs.existsSync(defaultsPath) ? readJson(defaultsPath) : { recommendations: [] };

	let payload = { recommendations: [] };
	let indent = '\t';
	const exists = fs.existsSync(extensionsPath);

	if (exists) {
		const raw = fs.readFileSync(extensionsPath, 'utf8');
		indent = detectIndent(raw);
		try {
			payload = JSON.parse(raw);
		} catch {
			console.warn(`Could not parse ${extensionsPath}; skipping VSCode extensions update.`);
			return;
		}
	}

	const before = JSON.stringify(payload.recommendations || []);
	const recommendations = new Set([...(payload.recommendations || []), ...(defaults.recommendations || [])]);

	if (cssEnabled) {
		recommendations.add(stylelintExtension);
	} else {
		recommendations.delete(stylelintExtension);
	}

	payload.recommendations = Array.from(recommendations);

	if (exists && before === JSON.stringify(payload.recommendations)) {
		return;
	}

	writeJson(extensionsPath, payload, indent);
	console.log(exists ? 'Updated .vscode/extensions.json.' : 'Created .vscode/extensions.json.');
}

function installConfigFiles(cssEnabled, manifest) {
	installAssetFile('eslint.config.mjs');
	// The updater belongs to this package; replacing it outright is expected.
	installAssetFile('lintconfig.cjs', { backup: false });

	if (cssEnabled) {
		installAssetFile('stylelint.config.cjs');
	} else {
		removeProjectFile('stylelint.config.cjs', 'CSS linting is disabled');
	}

	installPrettierConfig(manifest);
	configureVsCodeSettings(cssEnabled);
	configureVsCodeExtensions(cssEnabled);
}

function stripVersions(specs) {
	return specs.map((spec) => {
		const atIndex = spec.lastIndexOf('@');
		return atIndex > 0 ? spec.slice(0, atIndex) : spec;
	});
}

function shouldRemoveDependency(name, { removeAllManaged = false, purgeLintDeps = false } = {}) {
	if (bannedDependencies.includes(name)) {
		return true;
	}

	if (managedLintDependencies.has(name)) {
		// In workspace packages the shared lint tooling belongs to the root, so
		// every managed dependency is removed regardless of the current plan.
		return removeAllManaged || !plannedDependencyNames.has(name);
	}

	if (purgeLintDeps) {
		return lintNameTokens.some((token) => name.includes(token)) && !plannedDependencyNames.has(name);
	}

	return false;
}

function removeStaleDependencies(manifest, { label, trackRemovals = true, removeAllManaged = false } = {}) {
	const removed = [];

	dependencySections.forEach((section) => {
		const entries = manifest[section];
		if (!entries) {
			return;
		}

		Object.keys(entries).forEach((name) => {
			if (shouldRemoveDependency(name, { removeAllManaged, purgeLintDeps: featureToggles.purgeLintDeps })) {
				removed.push(name);
				delete entries[name];
			}
		});

		if (Object.keys(entries).length === 0) {
			delete manifest[section];
		}
	});

	if (removed.length) {
		if (trackRemovals) {
			removed.forEach((name) => removedDependencyNames.add(name));
		}
		console.log(`Removing lint dependencies from ${label}: ${removed.join(', ')}`);
	}
}

function planDependencies(manifests) {
	const vueMode = featureToggles.vueMode;
	vueStackEnabled = vueMode === 'auto' ? detectVueStack(manifests) : vueMode === 'on';
	dependenciesToInstall = [...coreDependencies];

	if (featureToggles.cssEnabled) {
		dependenciesToInstall.push(...cssDependencies);
	}
	if (featureToggles.markdownEnabled) {
		dependenciesToInstall.push(...markdownDependencies);
	}
	if (vueStackEnabled) {
		dependenciesToInstall.push(...vueDependencies);
	}

	plannedDependencyNames = new Set(stripVersions(dependenciesToInstall));

	if (vueMode === 'on') {
		console.log('Vue lint stack forced on via --vue.');
	} else if (vueMode === 'off') {
		console.log('Vue lint stack disabled via --no-vue.');
	} else if (vueStackEnabled) {
		console.log('Vue/Nuxt dependencies detected; enabling Vue lint stack.');
	} else {
		console.log('No Vue/Nuxt dependencies detected; using TypeScript-only lint stack.');
	}

	console.log(featureToggles.cssEnabled ? 'CSS/SCSS linting enabled.' : 'CSS/SCSS linting disabled.');
	console.log(
		featureToggles.markdownEnabled ? 'Markdown linting and formatting enabled.' : 'Markdown formatting disabled.'
	);
	if (featureToggles.purgeLintDeps) {
		console.log('Purging every lint-related dependency not installed by this script (--purge-lint-deps).');
	}
}

function detectVueStack(manifests) {
	const projectDeps = new Set();

	manifests.forEach((manifest) => {
		dependencySections.forEach((section) => {
			const entries = manifest[section];
			if (!entries) {
				return;
			}
			Object.keys(entries).forEach((dep) => {
				if (!managedLintDependencies.has(dep)) {
					projectDeps.add(dep);
				}
			});
		});
	});

	const vueMarkers = ['vue', 'nuxt', 'nuxt3'];
	const vuePrefixes = ['@vue/', '@nuxt/'];
	const vueContains = ['vue-router', '@vitejs/plugin-vue', 'eslint-plugin-vue'];

	return Array.from(projectDeps).some((dep) => {
		if (vueMarkers.includes(dep)) {
			return true;
		}
		if (vuePrefixes.some((prefix) => dep.startsWith(prefix))) {
			return true;
		}
		return vueContains.some((token) => dep.includes(token));
	});
}

function buildScripts({ cssEnabled, markdownEnabled, vueMode, autoMode, cssExplicit, markdownExplicit, vueExplicit, recursive, purgeLintDeps }) {
	// ESLint 10 selects files through the `files` entries in eslint.config.mjs;
	// the old --ext flag is accepted but ignored, so it is not generated.
	const eslintCmd = 'eslint --no-error-on-unmatched-pattern .';
	const eslintFixCmd = 'eslint --fix --no-error-on-unmatched-pattern .';
	const stylelintCmd = cssEnabled ? ' && stylelint --allow-empty-input "**/*.{css,scss}"' : '';
	const stylelintFixCmd = cssEnabled ? ' && stylelint --allow-empty-input --fix "**/*.{css,scss}"' : '';

	const prettierExtensions = ['js', 'jsx', 'cjs', 'mjs', 'ts', 'tsx', 'mts', 'vue', 'json'];
	if (cssEnabled) {
		prettierExtensions.push('css', 'scss');
	}
	if (markdownEnabled) {
		prettierExtensions.push('md');
	}

	const lintconfigArgs = buildLintconfigArgs({
		cssEnabled,
		markdownEnabled,
		vueMode,
		autoMode,
		cssExplicit,
		markdownExplicit,
		vueExplicit,
		recursive,
		purgeLintDeps
	});

	return {
		lint: `${eslintCmd}${stylelintCmd}`,
		lintfix: `${eslintFixCmd}${stylelintFixCmd}`,
		pretty: `prettier --write "**/*.{${prettierExtensions.join(',')}}"`,
		format: 'run-s lintfix pretty',
		cleanbuild: 'rimraf dist && run-s format build',
		lintconfig: `node lintconfig.cjs ${lintconfigArgs.join(' ')}`.trim()
	};
}

// The generated lintconfig script re-runs the install with the same flags, so
// later updates keep the choices made at install time.
function buildLintconfigArgs({
	cssEnabled,
	markdownEnabled,
	vueMode,
	autoMode,
	cssExplicit,
	markdownExplicit,
	vueExplicit,
	recursive,
	purgeLintDeps
}) {
	const fromInstaller = process.env.INSTALL_LINTCONFIG_ARGS?.trim();
	if (fromInstaller) {
		// Already assembled by install.sh / install.ps1, including --recursive.
		return Array.from(new Set(fromInstaller.split(/\s+/)));
	}

	const args = [];
	if (autoMode) {
		args.push('--auto');
		if (cssExplicit) {
			args.push(cssEnabled ? '--css' : '--no-css');
		}
		if (markdownExplicit) {
			args.push(markdownEnabled ? '--md' : '--no-md');
		}
		if (vueExplicit) {
			args.push(vueMode === 'on' ? '--vue' : '--no-vue');
		}
	} else {
		args.push(cssEnabled ? '--css' : '--no-css');
		args.push(markdownEnabled ? '--md' : '--no-md');
		args.push(vueMode === 'on' ? '--vue' : '--no-vue');
	}

	if (recursive) {
		args.push('--recursive');
	}
	if (purgeLintDeps) {
		args.push('--purge-lint-deps');
	}

	return args;
}

function readBooleanEnv(value, defaultValue) {
	if (value === undefined) {
		return defaultValue;
	}

	const normalized = String(value).toLowerCase();
	if (['0', 'false', 'no', 'off'].includes(normalized)) {
		return false;
	}
	if (['1', 'true', 'yes', 'on'].includes(normalized)) {
		return true;
	}
	return defaultValue;
}

function readVueModeEnv(value) {
	if (value === undefined) {
		return 'off';
	}

	const normalized = String(value).toLowerCase();
	if (['auto', 'detect'].includes(normalized)) {
		return 'auto';
	}
	if (['1', 'true', 'yes', 'on', 'vue'].includes(normalized)) {
		return 'on';
	}
	return 'off';
}

function resolveFeatureToggles(args) {
	let cssEnabled = readBooleanEnv(process.env.INSTALL_CSS, false);
	let markdownEnabled = readBooleanEnv(process.env.INSTALL_MARKDOWN, true);
	let vueMode = readVueModeEnv(process.env.INSTALL_VUE);
	let autoMode = readBooleanEnv(process.env.INSTALL_AUTO, false);
	let cssExplicit = readBooleanEnv(process.env.INSTALL_CSS_EXPLICIT, false);
	let markdownExplicit = readBooleanEnv(process.env.INSTALL_MARKDOWN_EXPLICIT, false);
	let vueExplicit = readBooleanEnv(process.env.INSTALL_VUE_EXPLICIT, false);
	let recursive = readBooleanEnv(process.env.INSTALL_RECURSIVE, false);
	let purgeLintDeps = readBooleanEnv(process.env.INSTALL_PURGE_LINT_DEPS, false);
	const unknownArgs = [];

	args.forEach((arg) => {
		if (arg === '--auto') {
			autoMode = true;
		} else if (arg === '--no-auto') {
			autoMode = false;
		} else if (arg === '--css') {
			cssEnabled = true;
			cssExplicit = true;
		} else if (arg === '--no-css') {
			cssEnabled = false;
			cssExplicit = true;
		} else if (arg === '--md' || arg === '--markdown') {
			markdownEnabled = true;
			markdownExplicit = true;
		} else if (arg === '--no-md' || arg === '--no-markdown') {
			markdownEnabled = false;
			markdownExplicit = true;
		} else if (arg === '--vue') {
			vueMode = 'on';
			vueExplicit = true;
		} else if (arg === '--no-vue') {
			vueMode = 'off';
			vueExplicit = true;
		} else if (arg === '--recursive' || arg === '-r') {
			recursive = true;
		} else if (arg === '--no-recursive') {
			recursive = false;
		} else if (arg === '--purge-lint-deps') {
			purgeLintDeps = true;
		} else if (arg === '--no-purge-lint-deps') {
			purgeLintDeps = false;
		} else {
			unknownArgs.push(arg);
		}
	});

	if (autoMode) {
		const detected = detectProjectFileFeatures(projectDir);
		if (!cssExplicit) {
			cssEnabled = detected.cssEnabled;
		}
		if (!markdownExplicit) {
			markdownEnabled = detected.markdownEnabled;
		}
		if (!vueExplicit) {
			vueMode = 'auto';
		}
		console.log(
			`Auto mode: css=${cssEnabled ? 'on' : 'off'}, markdown=${markdownEnabled ? 'on' : 'off'}, vue=${vueMode}`
		);
	}

	if (unknownArgs.length) {
		console.warn(`Unknown options ignored: ${unknownArgs.join(', ')}`);
	}

	return {
		cssEnabled,
		markdownEnabled,
		vueMode,
		autoMode,
		cssExplicit,
		markdownExplicit,
		vueExplicit,
		recursive,
		purgeLintDeps
	};
}

function detectProjectFileFeatures(rootDir) {
	const state = { cssEnabled: false, markdownEnabled: false };
	const queue = [rootDir];

	while (queue.length && !(state.cssEnabled && state.markdownEnabled)) {
		const currentDir = queue.pop();
		let entries;
		try {
			entries = fs.readdirSync(currentDir, { withFileTypes: true });
		} catch {
			continue;
		}

		for (const entry of entries) {
			// Dot directories hold tooling config (.github, .vscode, ...), not the
			// project's own CSS or documentation.
			if (entry.name.startsWith('.')) {
				continue;
			}

			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				if (!ignoredScanDirs.has(entry.name)) {
					queue.push(fullPath);
				}
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			if (!state.cssEnabled && /\.(css|scss)$/.test(entry.name)) {
				state.cssEnabled = true;
			}
			if (!state.markdownEnabled && /\.(md|markdown)$/.test(entry.name)) {
				state.markdownEnabled = true;
			}

			if (state.cssEnabled && state.markdownEnabled) {
				break;
			}
		}
	}

	return state;
}

function discoverWorkspacePackages(rootDir) {
	let output;
	try {
		output = execSync('pnpm list -r --depth -1 --json', {
			cwd: rootDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		});
	} catch {
		console.warn('Recursive mode requires a pnpm workspace; skipping workspace package updates.');
		return [];
	}

	let entries;
	try {
		entries = JSON.parse(output);
	} catch {
		console.warn('Could not parse pnpm workspace package list; skipping workspace package updates.');
		return [];
	}

	if (!Array.isArray(entries)) {
		return [];
	}

	const rootPath = path.resolve(rootDir);
	return entries
		.map((entry) => path.resolve(entry.path || ''))
		.filter((workspacePath) => workspacePath && workspacePath !== rootPath)
		.map((workspacePath) => {
			const packagePath = path.join(workspacePath, 'package.json');
			if (!fs.existsSync(packagePath)) {
				return null;
			}

			try {
				const raw = fs.readFileSync(packagePath, 'utf8');
				return { packagePath, manifest: JSON.parse(raw), indent: detectIndent(raw) };
			} catch {
				console.warn(`Could not parse ${packagePath}; skipping workspace package.`);
				return null;
			}
		})
		.filter(Boolean)
		.filter(({ packagePath, manifest }) => {
			if (isWorkspaceScriptTarget(manifest)) {
				return true;
			}

			console.log(
				`Skipping ${path.relative(rootDir, path.dirname(packagePath))}; no package build/lint/test script signals.`
			);
			return false;
		});
}

function isWorkspaceScriptTarget(manifest) {
	if (!manifest.name || typeof manifest.name !== 'string') {
		return false;
	}

	const scripts = manifest.scripts || {};
	return workspaceScriptSignals.some((scriptName) => typeof scripts[scriptName] === 'string');
}

function updatePackageJson(packagePath, manifest, indent, scripts) {
	manifest.scripts ||= {};
	removeStaleDependencies(manifest, { label: 'package.json' });

	for (const [name, command] of Object.entries(scripts)) {
		if (manifest.scripts[name] && manifest.scripts[name] !== command) {
			console.warn(`Script "${name}" already exists; replacing.`);
		}
		manifest.scripts[name] = command;
	}

	writeJson(packagePath, manifest, indent);
	console.log('package.json updated.');
}

function updateWorkspacePackageJson(scripts) {
	if (workspacePackages.length === 0) {
		console.log('No eligible pnpm workspace packages found for recursive script updates.');
		return;
	}

	workspacePackages.forEach(({ packagePath, manifest, indent }) => {
		const label = path.relative(projectDir, path.dirname(packagePath));
		manifest.scripts ||= {};
		removeStaleDependencies(manifest, { label, trackRemovals: false, removeAllManaged: true });

		for (const [name, command] of Object.entries(scripts)) {
			// The updater is kept in the workspace root only.
			if (name === 'lintconfig') {
				continue;
			}
			if (manifest.scripts[name] && manifest.scripts[name] !== command) {
				console.warn(`Script "${name}" already exists in ${label}; replacing.`);
			}
			manifest.scripts[name] = command;
		}

		writeJson(packagePath, manifest, indent);
		console.log(`Updated workspace package ${label}.`);
	});
}

function hasCommand(command) {
	try {
		execSync(command, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

// pnpm 10 and newer refuse to run a dependency's install script until it has
// been approved, and exit non-zero when they skip one. eslint-plugin-import-x
// pulls in unrs-resolver, which has such a script. Approving it is the user's
// call, so this only points at the fix.
function printPnpmInstallHint() {
	console.error('');
	console.error('pnpm did not finish the install.');
	console.error('If it reported ERR_PNPM_IGNORED_BUILDS, it skipped a dependency install');
	console.error('script (usually unrs-resolver, pulled in by eslint-plugin-import-x).');
	console.error('Review and approve it, then run this again:');
	console.error('');
	console.error('  pnpm approve-builds');
	console.error('');
	console.error('Or add it to pnpm-workspace.yaml:');
	console.error('');
	console.error('  allowBuilds:');
	console.error('    unrs-resolver: true');
	console.error('');
}

function installDependencies() {
	const usePnpm = hasCommand('pnpm --version');
	const removalTargets = Array.from(removedDependencyNames);

	if (usePnpm) {
		console.log('Using pnpm to install lint dependencies...');
		const isWorkspaceRoot = fs.existsSync(path.join(projectDir, 'pnpm-workspace.yaml'));
		const workspaceFlag = isWorkspaceRoot ? '-w ' : '';

		if (removalTargets.length) {
			run(`pnpm remove ${workspaceFlag}${removalTargets.join(' ')}`, { allowFail: true });
		}

		try {
			run(`pnpm add -D ${workspaceFlag}${dependenciesToInstall.join(' ')}`);
		} catch (error) {
			printPnpmInstallHint();
			throw error;
		}

		// Workspace manifests were edited directly, so refresh the lockfile.
		if (featureToggles.recursive && workspacePackages.length) {
			run('pnpm install');
		}
	} else {
		console.log('Using npm to install lint dependencies...');
		if (removalTargets.length) {
			run(`npm uninstall ${removalTargets.join(' ')}`, { allowFail: true });
		}
		run(`npm install -D ${dependenciesToInstall.join(' ')}`);
	}

	console.log('Lint dependencies installed.');
}

const featureToggles = resolveFeatureToggles(process.argv.slice(2));

console.log('Starting ESLint/Prettier setup...');

const packageJsonPath = path.join(projectDir, 'package.json');
// Checked before anything is written or deleted, so running this in the wrong
// directory leaves that directory alone.
if (!fs.existsSync(packageJsonPath)) {
	console.error(`package.json not found in ${projectDir}. Run this from the root of a Node project.`);
	process.exit(1);
}

const workspacePackages = featureToggles.recursive ? discoverWorkspacePackages(projectDir) : [];

function main() {
	const generatedScripts = buildScripts(featureToggles);
	const packageJsonRaw = fs.readFileSync(packageJsonPath, 'utf8');
	const packageJsonIndent = detectIndent(packageJsonRaw);
	const packageJson = JSON.parse(packageJsonRaw);

	planDependencies([packageJson, ...workspacePackages.map((target) => target.manifest)]);

	removeLegacyEslintConfigs();
	installConfigFiles(featureToggles.cssEnabled, packageJson);
	updatePackageJson(packageJsonPath, packageJson, packageJsonIndent, generatedScripts);
	if (featureToggles.recursive) {
		updateWorkspacePackageJson(generatedScripts);
	}
	installDependencies();

	console.log('Done.');
}

try {
	main();
} catch (error) {
	console.error(`\nSetup failed: ${error.message || error}`);
	process.exit(1);
}
