#!/usr/bin/env node

// The repo uses the same config it ships. `installer/` holds the originals and
// the root copies are generated from them, so the two cannot drift apart.
// `eslint.config.mjs` is not listed here because the root file re-exports the
// installer one directly.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'installer');

const syncedFiles = [
	'.prettierrc.json',
	'stylelint.config.cjs',
	path.join('.vscode', 'settings.json'),
	path.join('.vscode', 'extensions.json')
];

const checkOnly = process.argv.slice(2).includes('--check');
const outOfDate = [];

for (const relativePath of syncedFiles) {
	const source = path.join(sourceDir, relativePath);
	const destination = path.join(repoRoot, relativePath);

	if (!fs.existsSync(source)) {
		console.error(`Missing source file: installer/${relativePath}`);
		process.exit(1);
	}

	const expected = fs.readFileSync(source);
	const current = fs.existsSync(destination) ? fs.readFileSync(destination) : null;

	if (current && current.equals(expected)) {
		continue;
	}

	if (checkOnly) {
		outOfDate.push(relativePath);
		continue;
	}

	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.writeFileSync(destination, expected);
	console.log(`Synced ${relativePath} from installer/`);
}

if (outOfDate.length) {
	console.error(`Root config files differ from installer/: ${outOfDate.join(', ')}`);
	console.error('Edit the file under installer/ and run: npm run sync-configs');
	process.exit(1);
}

if (!checkOnly) {
	console.log('Root config files are in sync with installer/.');
}
