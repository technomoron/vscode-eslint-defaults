const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, describe, it } = require('node:test');

const { cleanup, createProject, exists, readJson, runConfigure } = require('./helpers.cjs');

const createdProjects = [];

function project(files) {
	const dir = createProject(files);
	createdProjects.push(dir);
	return dir;
}

after(() => createdProjects.forEach(cleanup));

const tabPackageJson = ['{', '\t"name": "app",', '\t"version": "1.0.0"', '}', ''].join('\n');

describe('configure-eslint', () => {
	it('installs config files and scripts into a fresh project', () => {
		const dir = project({ 'package.json': tabPackageJson });
		const result = runConfigure(dir, ['--no-css', '--no-vue']);

		assert.equal(result.status, 0, result.stdout);
		assert.ok(exists(dir, 'eslint.config.mjs'));
		assert.ok(exists(dir, 'lintconfig.cjs'));
		assert.ok(exists(dir, '.prettierrc.json'));
		assert.ok(exists(dir, '.vscode/settings.json'));
		assert.ok(exists(dir, '.vscode/extensions.json'));

		const { scripts } = readJson(dir, 'package.json');
		assert.equal(scripts.lint, 'eslint --no-error-on-unmatched-pattern .');
		assert.equal(scripts.format, 'run-s lintfix pretty');
		assert.equal(scripts.lintconfig, 'node lintconfig.cjs --no-css --md --no-vue');
	});

	// --ext is accepted but ignored by ESLint 10 flat config; file selection
	// comes from eslint.config.mjs instead.
	it('does not generate the obsolete --ext flag', () => {
		const dir = project({ 'package.json': tabPackageJson });
		runConfigure(dir, ['--no-css', '--no-vue']);

		const { scripts } = readJson(dir, 'package.json');
		assert.ok(!scripts.lint.includes('--ext'), scripts.lint);
		assert.ok(!scripts.lintfix.includes('--ext'), scripts.lintfix);
	});

	it('never generates a duplicated flag from installer arguments', () => {
		const dir = project({ 'package.json': tabPackageJson });
		runConfigure(dir, ['--recursive'], { lintconfigArgs: '--auto --css --recursive' });

		const { scripts } = readJson(dir, 'package.json');
		assert.equal(scripts.lintconfig, 'node lintconfig.cjs --auto --css --recursive');
	});

	it('leaves the directory untouched when package.json is missing', () => {
		const dir = project({ '.eslintrc.cjs': 'module.exports = {};\n', 'README.md': 'notes\n' });
		const result = runConfigure(dir, ['--no-css']);

		assert.equal(result.status, 1);
		assert.match(result.stdout, /package\.json not found/);
		assert.ok(exists(dir, '.eslintrc.cjs'), 'existing ESLint config must survive');
		assert.ok(!exists(dir, 'eslint.config.mjs'));
		assert.ok(!exists(dir, '.prettierrc.json'));
		assert.ok(!exists(dir, '.vscode'));
	});

	it('keeps an existing Prettier config', () => {
		const custom = '{ "semi": false, "singleQuote": true, "printWidth": 120 }\n';
		const dir = project({ 'package.json': tabPackageJson, '.prettierrc.json': custom });
		runConfigure(dir, ['--no-css', '--no-vue']);

		assert.equal(fs.readFileSync(path.join(dir, '.prettierrc.json'), 'utf8'), custom);
	});

	it('merges VSCode settings instead of replacing them', () => {
		const dir = project({
			'package.json': tabPackageJson,
			'.vscode/settings.json': '{\n\t"editor.rulers": [120],\n\t"my.setting": "keep"\n}\n',
			'.vscode/extensions.json': '{\n\t"recommendations": ["golang.go"]\n}\n'
		});
		runConfigure(dir, ['--no-css', '--no-vue']);

		const settings = readJson(dir, '.vscode/settings.json');
		assert.deepEqual(settings['editor.rulers'], [120]);
		assert.equal(settings['my.setting'], 'keep');
		assert.equal(settings['editor.formatOnSave'], true);
		assert.ok(!('stylelint.enable' in settings), 'CSS is off, so stylelint keys must not be set');

		const { recommendations } = readJson(dir, '.vscode/extensions.json');
		assert.ok(recommendations.includes('golang.go'));
		assert.ok(recommendations.includes('dbaeumer.vscode-eslint'));
		assert.ok(!recommendations.includes('stylelint.vscode-stylelint'));
	});

	it('backs up a legacy ESLint config before removing it', () => {
		const legacy = 'module.exports = { rules: { "no-console": "error" } };\n';
		const dir = project({ 'package.json': tabPackageJson, '.eslintrc.cjs': legacy });
		runConfigure(dir, ['--no-css', '--no-vue']);

		assert.ok(!exists(dir, '.eslintrc.cjs'));
		assert.equal(fs.readFileSync(path.join(dir, '.eslintrc.cjs.bak'), 'utf8'), legacy);
	});

	it('keeps lint packages it does not manage', () => {
		const dir = project({
			'package.json': JSON.stringify(
				{
					name: 'app',
					version: '1.0.0',
					devDependencies: {
						'typescript-eslint': '^8.0.0',
						'eslint-plugin-react': '^7.0.0',
						'prettier-plugin-tailwindcss': '^0.6.0',
						'stylelint-order': '^6.0.0',
						stylelint: '^17.0.0',
						tslint: '^6.0.0',
						vite: '^5.0.0'
					}
				},
				null,
				'\t'
			)
		});
		runConfigure(dir, ['--no-css', '--no-vue']);

		const { devDependencies } = readJson(dir, 'package.json');
		for (const kept of ['typescript-eslint', 'eslint-plugin-react', 'prettier-plugin-tailwindcss', 'stylelint-order', 'vite']) {
			assert.ok(kept in devDependencies, `${kept} must be kept`);
		}
		// stylelint is installed by this script and CSS is off; tslint is banned.
		assert.ok(!('stylelint' in devDependencies));
		assert.ok(!('tslint' in devDependencies));
	});

	it('removes unmanaged lint packages only with --purge-lint-deps', () => {
		const manifest = JSON.stringify(
			{
				name: 'app',
				version: '1.0.0',
				devDependencies: { 'eslint-plugin-react': '^7.0.0', vite: '^5.0.0' }
			},
			null,
			'\t'
		);
		const dir = project({ 'package.json': manifest });
		runConfigure(dir, ['--no-css', '--no-vue', '--purge-lint-deps']);

		const { devDependencies } = readJson(dir, 'package.json');
		assert.ok(!('eslint-plugin-react' in devDependencies));
		assert.ok('vite' in devDependencies);
	});

	it('preserves the existing package.json indentation', () => {
		const tabs = project({ 'package.json': tabPackageJson });
		runConfigure(tabs, ['--no-css', '--no-vue']);
		assert.match(fs.readFileSync(path.join(tabs, 'package.json'), 'utf8'), /\n\t"name": "app"/);

		const spaces = project({ 'package.json': '{\n  "name": "app",\n  "version": "1.0.0"\n}\n' });
		runConfigure(spaces, ['--no-css', '--no-vue']);
		assert.match(fs.readFileSync(path.join(spaces, 'package.json'), 'utf8'), /\n {2}"name": "app"/);
	});

	it('fails when the dependency install fails', () => {
		const dir = project({ 'package.json': tabPackageJson });
		const result = runConfigure(dir, ['--no-css', '--no-vue'], { npmExitCode: 1 });

		assert.equal(result.status, 1);
		assert.match(result.stdout, /Setup failed/);
		assert.ok(!/Lint dependencies installed/.test(result.stdout));
	});

	it('installs the stylelint config and editor settings when CSS is enabled', () => {
		const dir = project({ 'package.json': tabPackageJson });
		const result = runConfigure(dir, ['--css', '--no-vue']);

		assert.equal(result.status, 0, result.stdout);
		assert.ok(exists(dir, 'stylelint.config.cjs'));
		assert.equal(readJson(dir, '.vscode/settings.json')['stylelint.enable'], true);
		assert.ok(readJson(dir, '.vscode/extensions.json').recommendations.includes('stylelint.vscode-stylelint'));
		assert.match(result.calls, /npm install -D .*stylelint-config-standard-scss/);
	});

	it('removes the stylelint config again when CSS is turned off', () => {
		const dir = project({ 'package.json': tabPackageJson });
		runConfigure(dir, ['--css', '--no-vue']);
		assert.ok(exists(dir, 'stylelint.config.cjs'));

		runConfigure(dir, ['--no-css', '--no-vue']);
		assert.ok(!exists(dir, 'stylelint.config.cjs'));
		assert.ok(!('stylelint.enable' in readJson(dir, '.vscode/settings.json')));
	});

	it('enables the Vue stack when Vue is a project dependency in auto mode', () => {
		const dir = project({
			'package.json': JSON.stringify(
				{ name: 'app', version: '1.0.0', dependencies: { vue: '^3.5.0' } },
				null,
				'\t'
			)
		});
		const result = runConfigure(dir, ['--auto']);

		assert.equal(result.status, 0, result.stdout);
		assert.match(result.calls, /npm install -D .*eslint-plugin-vue/);
	});
});
