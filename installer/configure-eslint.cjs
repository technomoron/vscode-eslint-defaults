const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const hauntedArtifacts = ['.eslintignore', '.eslintrc.cjs', 'eslint.config.js'];

const featureToggles = resolveFeatureToggles(process.argv.slice(2));

const coreDependencies = [
	'eslint@^9.36.0',
	'prettier@^3.6.2',
	'eslint-config-prettier@^10.1.8',
	'jsonc-eslint-parser@^2.4.1',
	'@typescript-eslint/eslint-plugin@^8.44.1',
	'@typescript-eslint/parser@^8.44.1',
	'eslint-plugin-import@^2.32.0'
];

const cssDependencies = ['stylelint@^16.26.0', 'stylelint-config-standard-scss@^16.0.0'];
const vueDependencies = [
	'eslint-plugin-vue@^10.5.0',
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
	vueStackEnabled = detectVueStack(spellbook);
	dependenciesToInstall = [...coreDependencies];

	if (featureToggles.cssEnabled) {
		dependenciesToInstall.push(...cssDependencies);
	}
	if (vueStackEnabled) {
		dependenciesToInstall.push(...vueDependencies);
	}

	allowedLintDependencies = new Set(stripVersions(dependenciesToInstall));

	if (vueStackEnabled) {
		console.log('Vue/Nuxt dependencies detected; enabling Vue lint stack.');
	} else {
		console.log('No Vue/Nuxt dependencies detected; using TypeScript-only lint stack.');
	}

	if (!featureToggles.cssEnabled) {
		console.log('CSS/SCSS linting disabled by flag.');
	}

	console.log(
		featureToggles.markdownEnabled
			? 'Markdown formatting enabled (no ESLint code-block linting).'
			: 'Markdown formatting disabled by flag.'
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
	const stylelintFixCmd = cssEnabled ? ' && stylelint --allow-empty-input --fix "**/*.{css,scss}"' : '';

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
		cleanbuild: 'rm -rf ./dist/ && npm run lintfix && npm run format && npm run build'
	};
}

function resolveFeatureToggles(args) {
	let cssEnabled = readBooleanEnv(process.env.INSTALL_CSS, true);
	let markdownEnabled = readBooleanEnv(process.env.INSTALL_MARKDOWN, true);

	args.forEach((arg) => {
		if (arg === '--css') {
			cssEnabled = true;
		} else if (arg === '--no-css') {
			cssEnabled = false;
		} else if (arg === '--markdown') {
			markdownEnabled = true;
		} else if (arg === '--no-markdown') {
			markdownEnabled = false;
		}
	});

	return { cssEnabled, markdownEnabled };
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

function shouldPurgeDependency(name) {
	return lintTokens.some((token) => name.includes(token)) && !allowedLintDependencies.has(name);
}

console.log('Starting ESLint/Prettier setup...');
banishHauntedFiles();
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
