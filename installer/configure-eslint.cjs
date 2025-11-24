const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const haunted_artifacts = ['.eslintignore', '.eslintrc.cjs', 'eslint.config.js'];

const base_dependencies = [
	'eslint@^9.36.0',
	'prettier@^3.6.2',
	'eslint-config-prettier@^10.1.8',
	'eslint-plugin-markdown@^5.1.0',
	'jsonc-eslint-parser@^2.4.1',
	'@typescript-eslint/eslint-plugin@^8.44.1',
	'@typescript-eslint/parser@^8.44.1',
	'eslint-plugin-import@^2.32.0',
	'stylelint@^16.26.0',
	'stylelint-config-standard-scss@^16.0.0'
];

const vue_dependencies = [
	'eslint-plugin-vue@^10.5.0',
	'vue-eslint-parser@^10.2.0',
	'@vue/eslint-config-typescript@^14.6.0'
];

const banished_dependencies = ['eslint', 'tslint'];
const lint_sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const lint_tokens = ['eslint', 'prettier', 'stylelint'];
const purged_dependency_names = new Set();
const catalogued_lint_dependencies = new Set(strip_versions([...base_dependencies, ...vue_dependencies]));
let dependencies_to_install = [...base_dependencies];
let allowed_lint_dependencies = new Set(strip_versions(dependencies_to_install));
let vue_stack_enabled = false;

function should_purge_dependency(name) {
	return lint_tokens.some((token) => name.includes(token)) && !allowed_lint_dependencies.has(name);
}

const incantation_scripts = {
	lint: 'eslint --ext .js,.cjs,.mjs,.ts,.mts,.tsx,.vue,.md,.json ./ && stylelint "**/*.{css,scss}"',
	lintfix: 'eslint --fix --ext .js,.cjs,.mjs,.ts,.mts,.tsx,.vue,.md,.json ./ && stylelint --fix "**/*.{css,scss}"',
	pretty: 'prettier --write "**/*.{js,jsx,cjs,mjs,ts,tsx,mts,vue,json,css,scss,md}"',
	format: 'npm run lintfix && npm run pretty',
	cleanbuild: 'rm -rf ./dist/ && npm run lintfix && npm run format && npm run build'
};

function summon(command, allowFail = false) {
	console.log(`\n🔮 ${command}`);
	try {
		execSync(command, { stdio: 'inherit' });
	} catch (err) {
		if (allowFail) {
			console.warn(`⚠️  Command failed (ignored): ${command}`);
		} else {
			throw err;
		}
	}
}

function banish_haunted_files() {
	console.log('🧹 Sweeping away haunted artifacts...');
	haunted_artifacts.forEach((artifact) => {
		const fullPath = path.join(process.cwd(), artifact);
		if (fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
			console.log(`💀 Banished ${artifact}`);
		} else {
			console.log(`🫥 ${artifact} not found — skipping.`);
		}
	});
}

function inscribe_package_scroll() {
	const scroll_path = path.join(process.cwd(), 'package.json');
	if (!fs.existsSync(scroll_path)) {
		console.error('💀 package.json scroll not found.');
		process.exit(1);
	}

	const spellbook = JSON.parse(fs.readFileSync(scroll_path, 'utf8'));

	spellbook.scripts ||= {};
	configure_dependency_plan(spellbook);
	purge_unlisted_dependencies(spellbook);

	for (const [rune, incantation] of Object.entries(incantation_scripts)) {
		if (spellbook.scripts[rune]) {
			console.warn(`👻 Rune "${rune}" already etched — replacing.`);
		}
		spellbook.scripts[rune] = incantation;
		console.log(`✨ Etched rune "${rune}" into the scroll.`);
	}

	fs.writeFileSync(scroll_path, JSON.stringify(spellbook, null, 2) + '\n');
	console.log('📜 package scroll updated.');
}

function brew_dependencies() {
	const has_pnpm_charm = (() => {
		try {
			execSync('pnpm --version', { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	})();

	if (has_pnpm_charm) {
		console.log('🟣 Casting spells with pnpm...');
		const removalTargets = Array.from(new Set([...banished_dependencies, ...purged_dependency_names]));
		if (removalTargets.length) {
			summon(`pnpm remove ${removalTargets.join(' ')}`, true);
		}
		summon(`pnpm add -D ${dependencies_to_install.join(' ')}`);
	} else {
		console.log('🔵 Brewing with npm...');
		const removalTargets = Array.from(new Set([...banished_dependencies, ...purged_dependency_names]));
		if (removalTargets.length) {
			summon(`npm uninstall ${removalTargets.join(' ')}`);
		}
		summon(`npm install -D ${dependencies_to_install.join(' ')}`, true);
	}

	console.log('🧪 Ritual complete. Dev dependencies enchanted.');
}

function purge_unlisted_dependencies(spellbook) {
	const removed = [];

	lint_sections.forEach((section) => {
		const shelf = spellbook[section];
		if (!shelf) {
			return;
		}

		Object.keys(shelf).forEach((depName) => {
			if (should_purge_dependency(depName)) {
				removed.push(depName);
				delete shelf[depName];
			}
		});

		if (shelf && Object.keys(shelf).length === 0) {
			delete spellbook[section];
		}
	});

	if (removed.length) {
		removed.forEach((name) => purged_dependency_names.add(name));
		console.log(`🧯 Purged stray lint deps: ${removed.join(', ')}`);
	}
}

function configure_dependency_plan(spellbook) {
	vue_stack_enabled = detect_vue_stack(spellbook);
	dependencies_to_install = vue_stack_enabled ? [...base_dependencies, ...vue_dependencies] : [...base_dependencies];
	allowed_lint_dependencies = new Set(strip_versions(dependencies_to_install));

	if (vue_stack_enabled) {
		console.log('🌿 Vue/Nuxt dependencies detected — enabling Vue lint stack.');
	} else {
		console.log('🛡️  No Vue/Nuxt dependencies detected — using TypeScript-only lint stack.');
	}
}

function detect_vue_stack(spellbook) {
	const projectDeps = new Set();

	lint_sections.forEach((section) => {
		const shelf = spellbook[section];
		if (!shelf) {
			return;
		}
		Object.keys(shelf).forEach((dep) => {
			if (catalogued_lint_dependencies.has(dep)) {
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

function strip_versions(specs) {
	return specs.map((spec) => {
		const atIndex = spec.lastIndexOf('@');
		return atIndex > 0 ? spec.slice(0, atIndex) : spec;
	});
}

console.log('🔥 Let the ritual begin...');
banish_haunted_files();
inscribe_package_scroll();
brew_dependencies();
