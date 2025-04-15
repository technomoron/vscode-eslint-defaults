#!/usr/bin/env node

var fs = require('fs');
var path = require('path');

var dest_dir = process.argv[2];

if (!dest_dir) {
	console.error('Usage: node install.js <destination-directory>');
	process.exit(1);
}

if (!fs.existsSync(dest_dir)) {
	console.error(`Error: Destination directory "${dest_dir}" does not exist.`);
	process.exit(1);
}

const install_files = [
	'.prettierrc',
	'.eslintrc.cjs',
	'.eslintignore',
	'.editorconfig',
	['.vscode/extensions.json', '.vscode/extensions.json'],
	['.vscode/settings.json', '.vscode/settings.json'],
];

const script_targets = {
	lint: 'eslint --ext .js,.ts,.vue ./',
	lintfix: 'eslint --fix --ext .js,.ts,.vue ./',
	format: 'prettier --write "**/*.{js,jsx,ts,tsx,vue,json,css,scss,md}"',
};

install_files.forEach((file) => {
	let srcdir, destdir;

	if (Array.isArray(file)) {
		[srcdir, destdir] = file;
	} else {
		srcdir = file;
		destdir = file;
	}

	const full_source = path.join(__dirname, srcdir);
	const full_dest = path.join(dest_dir, destdir);

	const dest_dirname = path.dirname(full_dest);
	if (!fs.existsSync(dest_dirname)) {
		fs.mkdirSync(dest_dirname, { recursive: true });
	}

	try {
		const content = fs.readFileSync(full_source, 'utf8');
		fs.writeFileSync(full_dest, content);
		console.log(`Copied ${srcdir} to ${full_dest}`);
	} catch (error) {
		console.error(`Error copying ${srcdir} to ${full_dest}:`, error.message);
	}
});

const pkgpath = path.join(dest_dir, 'package.json');

try {
	let json;
	try {
		let json_content = fs.readFileSync(pkgpath, 'utf8');
		json = JSON.parse(json_content);
	} catch (error) {
		console.error('Error reading package.json:', error.message);
		process.exit(1);
	}

	if (!json.scripts) {
		json.scripts = {};
	}

	Object.entries(script_targets).forEach(([name, cmd]) => {
		if (name in json.scripts) {
			console.warn(`Warning: Script "${name}" already exists in package.json`);
		} else {
			console.log(`Adding script "${name}" to package.json`);
		}
		json.scripts[name] = cmd;
	});

	fs.writeFileSync(pkgpath, JSON.stringify(json, null, 2) + '\n');
} catch (error) {
	console.error('Error updating package.json:', error.message);
}
