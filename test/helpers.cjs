const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const installerDir = path.join(repoRoot, 'installer');

// Stands in for npm and pnpm so tests never touch the network or a real
// node_modules. Every invocation is appended to a log the test can read back.
function writePackageManagerStubs(binDir, { npmExitCode = 0, pnpmAvailable = false } = {}) {
	fs.mkdirSync(binDir, { recursive: true });

	const logPath = path.join(binDir, 'calls.log');
	const npmScript = [
		'#!/bin/sh',
		`echo "npm $@" >> "${logPath}"`,
		`if [ "$1" = "install" ]; then exit ${npmExitCode}; fi`,
		'exit 0',
		''
	].join('\n');

	const pnpmScript = pnpmAvailable
		? ['#!/bin/sh', `echo "pnpm $@" >> "${logPath}"`, 'exit 0', ''].join('\n')
		: ['#!/bin/sh', 'exit 1', ''].join('\n');

	fs.writeFileSync(path.join(binDir, 'npm'), npmScript, { mode: 0o755 });
	fs.writeFileSync(path.join(binDir, 'pnpm'), pnpmScript, { mode: 0o755 });

	return logPath;
}

function createProject(files) {
	const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-eslint-defaults-test-'));

	for (const [relativePath, contents] of Object.entries(files)) {
		const target = path.join(projectDir, relativePath);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, contents);
	}

	return projectDir;
}

// Runs configure-eslint.cjs the way the installers do: from the directory the
// release archive was unpacked into, with the project as the working directory.
function runConfigure(projectDir, args = [], options = {}) {
	const binDir = path.join(projectDir, '.test-bin');
	const logPath = writePackageManagerStubs(binDir, options);

	let stdout;
	let status = 0;

	try {
		stdout = execFileSync(process.execPath, [path.join(installerDir, 'configure-eslint.cjs'), ...args], {
			cwd: projectDir,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
				INSTALL_LINTCONFIG_ARGS: options.lintconfigArgs || ''
			}
		});
	} catch (error) {
		status = error.status ?? 1;
		stdout = `${error.stdout || ''}${error.stderr || ''}`;
	}

	return {
		status,
		stdout,
		calls: fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
	};
}

function readJson(projectDir, relativePath) {
	return JSON.parse(fs.readFileSync(path.join(projectDir, relativePath), 'utf8'));
}

function exists(projectDir, relativePath) {
	return fs.existsSync(path.join(projectDir, relativePath));
}

function cleanup(projectDir) {
	fs.rmSync(projectDir, { recursive: true, force: true });
}

module.exports = { cleanup, createProject, exists, installerDir, readJson, repoRoot, runConfigure };
