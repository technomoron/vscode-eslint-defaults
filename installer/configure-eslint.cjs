const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const hauntedArtifacts = ['.eslintignore', '.eslintrc.cjs', 'eslint.config.js'];

const featureToggles = resolveFeatureToggles(process.argv.slice(2));

const coreDependencies = [
	'eslint@^9.39.2',
	'prettier@^3.8.1',
	'eslint-config-prettier@^10.1.8',
	'jsonc-eslint-parser@^2.4.2',
	'@typescript-eslint/eslint-plugin@^8.54.0',
	'@typescript-eslint/parser@^8.54.0',
	'eslint-plugin-import@^2.32.0'
];

const cssDependencies = ['stylelint@^17.1.1', 'stylelint-config-standard-scss@^17.0.0'];
const vueDependencies = [
	'eslint-plugin-vue@^10.7.0',
	'vue-eslint-parser@^10.2.0',
	'@vue/eslint-config-typescript@^14.6.0'
];

const banishedDependencies = ['eslint', 'tslint'];
const lintSections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const lintTokens = ['eslint', 'prettier', 'stylelint'];
const purgedDependencyNames = new Set();
const cataloguedLintDependencies = new Set(
	stripVersions([...coreDependencies, ...cssDependencies, ...vueDependencies])
);
let dependenciesToInstall = [];
let allowedLintDependencies = new Set();
let vueStackEnabled = false;

const incantationScripts = buildIncantationScripts(featureToggles);

function summon(command, allowFail = false) {
	console.log(`\n→ ${command}`);
	try {
		execSync(command, { stdio: 'inherit' });
	} catch (err) {
		if (allowFail) {
			console.warn(`Command failed (ignored): ${command}`);
		} else {
			throw err;
		}
	}
}

function banishHauntedFiles() {
	console.log('Sweeping away old ESLint artifacts...');
	hauntedArtifacts.forEach((artifact) => {
		const fullPath = path.join(process.cwd(), artifact);
		if (fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
			console.log(`Removed ${artifact}`);
		} else {
			console.log(`${artifact} not found; skipping.`);
		}
	});
}

function inscribePackageScroll() {
	const scrollPath = path.join(process.cwd(), 'package.json');
	if (!fs.existsSync(scrollPath)) {
		console.error('package.json not found.');
		process.exit(1);
	}

	const spellbook = JSON.parse(fs.readFileSync(scrollPath, 'utf8'));

	spellbook.scripts ||= {};
	configureDependencyPlan(spellbook);
	purgeUnlistedDependencies(spellbook);

	for (const [rune, incantation] of Object.entries(incantationScripts)) {
		if (spellbook.scripts[rune]) {
			console.warn(`Script "${rune}" already exists; replacing.`);
		}
		spellbook.scripts[rune] = incantation;
	}

	fs.writeFileSync(scrollPath, JSON.stringify(spellbook, null, 2) + '\n');
	console.log('package.json updated.');
}

function brewDependencies() {
	const hasPnpm = (() => {
		try {
			execSync('pnpm --version', { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	})();

	const removalTargets = Array.from(new Set([...banishedDependencies, ...purgedDependencyNames]));

	if (hasPnpm) {
		console.log('Using pnpm to install lint dependencies...');
		if (removalTargets.length) {
			summon(`pnpm remove ${removalTargets.join(' ')}`, true);
		}
		summon(`pnpm add -D ${dependenciesToInstall.join(' ')}`);
	} else {
		console.log('Using npm to install lint dependencies...');
		if (removalTargets.length) {
			summon(`npm uninstall ${removalTargets.join(' ')}`);
		}
		summon(`npm install -D ${dependenciesToInstall.join(' ')}`, true);
	}

	console.log('Lint dependencies installed.');
}

function purgeUnlistedDependencies(spellbook) {
	const removed = [];

	lintSections.forEach((section) => {
		const shelf = spellbook[section];
		if (!shelf) {
			return;
		}

		Object.keys(shelf).forEach((depName) => {
			if (shouldPurgeDependency(depName)) {
				removed.push(depName);
				delete shelf[depName];
			}
		});

		if (shelf && Object.keys(shelf).length === 0) {
			delete spellbook[section];
		}
	});

	if (removed.length) {
		removed.forEach((name) => purgedDependencyNames.add(name));
		console.log(`Purged stray lint deps: ${removed.join(', ')}`);
	}
}

function configureDependencyPlan(spellbook) {
	const vueMode = featureToggles.vueMode ?? 'auto';
	vueStackEnabled = vueMode === 'auto' ? detectVueStack(spellbook) : vueMode === 'on';
	dependenciesToInstall = [...coreDependencies];

	if (featureToggles.cssEnabled) {
		dependenciesToInstall.push(...cssDependencies);
	}
	if (vueStackEnabled) {
		dependenciesToInstall.push(...vueDependencies);
	}

	allowedLintDependencies = new Set(stripVersions(dependenciesToInstall));

	if (vueMode === 'on') {
		console.log('Vue lint stack forced on via --vue.');
	} else if (vueMode === 'off') {
		console.log('Vue lint stack disabled via --no-vue.');
	} else if (vueStackEnabled) {
		console.log('Vue/Nuxt dependencies detected; enabling Vue lint stack.');
	} else {
		console.log('No Vue/Nuxt dependencies detected; using TypeScript-only lint stack.');
	}

	if (!featureToggles.cssEnabled) {
		console.log('CSS/SCSS linting disabled.');
	}

	console.log(
		featureToggles.markdownEnabled
			? 'Markdown formatting enabled (no ESLint code-block linting).'
			: 'Markdown formatting disabled.'
	);
}

function detectVueStack(spellbook) {
	const projectDeps = new Set();

	lintSections.forEach((section) => {
		const shelf = spellbook[section];
		if (!shelf) {
			return;
		}
		Object.keys(shelf).forEach((dep) => {
			if (cataloguedLintDependencies.has(dep)) {
				return;
			}
			projectDeps.add(dep);
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

function stripVersions(specs) {
	return specs.map((spec) => {
		const atIndex = spec.lastIndexOf('@');
		return atIndex > 0 ? spec.slice(0, atIndex) : spec;
	});
}

function buildIncantationScripts({ cssEnabled, markdownEnabled }) {
	const eslintExtensions = ['.js', '.cjs', '.mjs', '.ts', '.mts', '.tsx', '.vue', '.json'];

	const eslintCmd = `eslint --no-error-on-unmatched-pattern --ext ${eslintExtensions.join(',')} ./`;
	const eslintFixCmd = `eslint --fix --no-error-on-unmatched-pattern --ext ${eslintExtensions.join(',')} ./`;
	const stylelintCmd = cssEnabled ? ' && stylelint --allow-empty-input "**/*.{css,scss}"' : '';
	const stylelintFixCmd = cssEnabled
		? ' && stylelint --allow-empty-input --fix "**/*.{css,scss}"'
		: '';

	const prettierExtensions = ['js', 'jsx', 'cjs', 'mjs', 'ts', 'tsx', 'mts', 'vue', 'json'];
	if (cssEnabled) {
		prettierExtensions.push('css', 'scss');
	}
	if (markdownEnabled) {
		prettierExtensions.push('md');
	}

	return {
		lint: `${eslintCmd}${stylelintCmd}`,
		lintfix: `${eslintFixCmd}${stylelintFixCmd}`,
		pretty: `prettier --write "**/*.{${prettierExtensions.join(',')}}"`,
		format: 'npm run lintfix && npm run pretty',
		cleanbuild: 'rm -rf ./dist/ && npm run format && npm run build',
		lintconfig: 'node lintconfig.cjs'
	};
}

function resolveFeatureToggles(args) {
	let cssEnabled = readBooleanEnv(process.env.INSTALL_CSS, false);
	let markdownEnabled = readBooleanEnv(process.env.INSTALL_MARKDOWN, true);
	let vueMode = readVueModeEnv(process.env.INSTALL_VUE);
	const unknownArgs = [];

	args.forEach((arg) => {
		if (arg === '--css') {
			cssEnabled = true;
		} else if (arg === '--no-css') {
			cssEnabled = false;
		} else if (arg === '--md' || arg === '--markdown') {
			markdownEnabled = true;
		} else if (arg === '--no-md' || arg === '--no-markdown') {
			markdownEnabled = false;
		} else if (arg === '--vue') {
			vueMode = 'on';
		} else if (arg === '--no-vue') {
			vueMode = 'off';
		} else {
			unknownArgs.push(arg);
		}
	});

	if (unknownArgs.length) {
		console.warn(`Unknown options ignored: ${unknownArgs.join(', ')}`);
	}

	return { cssEnabled, markdownEnabled, vueMode };
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
		return 'auto';
	}

	const normalized = String(value).toLowerCase();
	if (['auto', 'detect'].includes(normalized)) {
		return 'auto';
	}
	if (['1', 'true', 'yes', 'on', 'vue'].includes(normalized)) {
		return 'on';
	}
	if (['0', 'false', 'no', 'off', 'none'].includes(normalized)) {
		return 'off';
	}
	return 'auto';
}

function shouldPurgeDependency(name) {
	return lintTokens.some((token) => name.includes(token)) && !allowedLintDependencies.has(name);
}

console.log('Starting ESLint/Prettier setup...');
banishHauntedFiles();
ensurePrettierConfig();
configureVsCodeSettings(featureToggles.cssEnabled);
configureVsCodeExtensions(featureToggles.cssEnabled);
removeStylelintConfigIfDisabled();
inscribePackageScroll();
brewDependencies();

function removeStylelintConfigIfDisabled() {
	if (featureToggles.cssEnabled) {
		return;
	}

	const stylelintPath = path.join(process.cwd(), 'stylelint.config.cjs');
	if (fs.existsSync(stylelintPath)) {
		fs.unlinkSync(stylelintPath);
		console.log('Removed stylelint.config.cjs because CSS linting is disabled.');
	}
}

function ensurePrettierConfig() {
	const prettierRc = path.join(process.cwd(), '.prettierrc');
	const prettierJson = path.join(process.cwd(), '.prettierrc.json');
	const defaults = {
		useTabs: true,
		tabWidth: 4,
		printWidth: 80,
		proseWrap: 'always',
		overrides: [
			{
				files: '*.md',
				options: {
					useTabs: true,
					tabWidth: 4,
					printWidth: 80,
					proseWrap: 'always'
				}
			}
		]
	};

	const hasRc = fs.existsSync(prettierRc);
	const hasJson = fs.existsSync(prettierJson);

	if (hasRc && hasJson) {
		fs.unlinkSync(prettierJson);
		console.log('Found .prettierrc and .prettierrc.json; keeping .prettierrc, removed .prettierrc.json.');
		return;
	}

	if (!hasRc && hasJson) {
		fs.copyFileSync(prettierJson, prettierRc);
		fs.unlinkSync(prettierJson);
		console.log('Migrated .prettierrc.json to .prettierrc.');
		return;
	}

	if (!hasRc && !hasJson) {
		fs.writeFileSync(prettierRc, JSON.stringify(defaults, null, 2) + '\n');
		console.log('Added default .prettierrc (no existing Prettier config found).');
	}
}

function configureVsCodeSettings(cssEnabled) {
	const settingsPath = path.join(process.cwd(), '.vscode', 'settings.json');

	if (!fs.existsSync(settingsPath)) {
		console.log('.vscode/settings.json not found; skipping VSCode settings update.');
		return;
	}

	let settings;
	try {
		settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
	} catch (error) {
		console.warn(`Could not parse ${settingsPath}; skipping VSCode settings update.`);
		return;
	}

	const cssSettings = [
		['stylelint.enable', true],
		['stylelint.validate', ['css', 'scss']],
		['css.validate', false],
		['scss.validate', false]
	];

	let mutated = false;

	cssSettings.forEach(([key, value]) => {
		if (cssEnabled) {
			if (!valuesEqual(settings[key], value)) {
				settings[key] = value;
				mutated = true;
			}
		} else if (key in settings) {
			delete settings[key];
			mutated = true;
		}
	});

	if (mutated) {
		const serialized = JSON.stringify(settings, null, '\t') + '\n';
		fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
		fs.writeFileSync(settingsPath, serialized);
		console.log(
			cssEnabled
				? 'Enabled Stylelint VSCode settings for CSS/SCSS.'
				: 'Removed Stylelint VSCode settings because CSS linting is disabled.'
		);
	}
}

function valuesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function configureVsCodeExtensions(cssEnabled) {
	const extensionsPath = path.join(process.cwd(), '.vscode', 'extensions.json');
	const stylelintExtension = 'stylelint.vscode-stylelint';

	if (!fs.existsSync(extensionsPath)) {
		console.log('.vscode/extensions.json not found; skipping VSCode extensions update.');
		return;
	}

	let payload;
	try {
		payload = JSON.parse(fs.readFileSync(extensionsPath, 'utf8'));
	} catch (error) {
		console.warn(`Could not parse ${extensionsPath}; skipping VSCode extensions update.`);
		return;
	}

	const current = new Set(payload.recommendations || []);
	const hadStylelint = current.has(stylelintExtension);
	const mutated = (() => {
		if (cssEnabled) {
			if (!hadStylelint) {
				current.add(stylelintExtension);
				return true;
			}
			return false;
		}
		if (hadStylelint) {
			current.delete(stylelintExtension);
			return true;
		}
		return false;
	})();

	if (mutated) {
		payload.recommendations = Array.from(current);
		const serialized = JSON.stringify(payload, null, '\t') + '\n';
		fs.mkdirSync(path.dirname(extensionsPath), { recursive: true });
		fs.writeFileSync(extensionsPath, serialized);
		console.log(
			cssEnabled
				? 'Added Stylelint extension recommendation (CSS/SCSS enabled).'
				: 'Removed Stylelint extension recommendation (CSS/SCSS disabled).'
		);
	}
}
