#!/usr/bin/env bash
set -euo pipefail

VERSION_DEFAULT="latest"
VERSION="${VSCODE_ESLINT_DEFAULTS_VERSION:-$VERSION_DEFAULT}"
CSS_ENABLED=0
MARKDOWN_ENABLED=1
VUE_MODE="off"
AUTO_MODE=0
CSS_EXPLICIT=0
MARKDOWN_EXPLICIT=0
VUE_EXPLICIT=0
RELEASE_URL_BASE="https://github.com/technomoron/vscode-eslint-defaults/releases/download"
LATEST_ARCHIVE_URL="https://github.com/technomoron/vscode-eslint-defaults/releases/latest/download/installer.tgz"

usage() {
	cat <<'EOF'
Usage: install.sh [options]

Options:
  --version <v>      Version tag without the leading "v" (default: latest or $VSCODE_ESLINT_DEFAULTS_VERSION)
  --version=<v>      Same as above (inline assignment)
  --latest           Install the latest GitHub release, overriding $VSCODE_ESLINT_DEFAULTS_VERSION
  --css / --no-css   Enable or disable CSS/SCSS linting (default: disabled)
  --md / --no-md     Enable or disable Markdown formatting (default: enabled)
  --vue / --no-vue   Force Vue lint stack on/off (default: off)
  --auto             Auto-detect CSS/Markdown usage and Vue deps
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--version|-v)
			shift
			VERSION="${1:-$VERSION}"
			;;
		--version=*)
			VERSION="${1#--version=}"
			;;
		--latest)
			VERSION="latest"
			;;
		--css)
			CSS_ENABLED=1
			CSS_EXPLICIT=1
			;;
		--no-css)
			CSS_ENABLED=0
			CSS_EXPLICIT=1
			;;
		--md|--markdown)
			MARKDOWN_ENABLED=1
			MARKDOWN_EXPLICIT=1
			;;
		--no-md|--no-markdown)
			MARKDOWN_ENABLED=0
			MARKDOWN_EXPLICIT=1
			;;
		--vue)
			VUE_MODE="on"
			VUE_EXPLICIT=1
			;;
		--no-vue)
			VUE_MODE="off"
			VUE_EXPLICIT=1
			;;
		--auto)
			AUTO_MODE=1
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			usage
			exit 1
			;;
	esac
	shift
done

LINTCONFIG_ARGS=()
if [[ "$AUTO_MODE" -eq 1 ]]; then
	LINTCONFIG_ARGS+=(--auto)
	if [[ "$CSS_EXPLICIT" -eq 1 ]]; then
		if [[ "$CSS_ENABLED" -eq 1 ]]; then
			LINTCONFIG_ARGS+=(--css)
		else
			LINTCONFIG_ARGS+=(--no-css)
		fi
	fi
	if [[ "$MARKDOWN_EXPLICIT" -eq 1 ]]; then
		if [[ "$MARKDOWN_ENABLED" -eq 1 ]]; then
			LINTCONFIG_ARGS+=(--md)
		else
			LINTCONFIG_ARGS+=(--no-md)
		fi
	fi
	if [[ "$VUE_EXPLICIT" -eq 1 ]]; then
		if [[ "$VUE_MODE" == "on" ]]; then
			LINTCONFIG_ARGS+=(--vue)
		else
			LINTCONFIG_ARGS+=(--no-vue)
		fi
	fi
else
	if [[ "$CSS_ENABLED" -eq 1 ]]; then
		LINTCONFIG_ARGS+=(--css)
	else
		LINTCONFIG_ARGS+=(--no-css)
	fi
	if [[ "$MARKDOWN_ENABLED" -eq 1 ]]; then
		LINTCONFIG_ARGS+=(--md)
	else
		LINTCONFIG_ARGS+=(--no-md)
	fi
	if [[ "$VUE_MODE" == "on" ]]; then
		LINTCONFIG_ARGS+=(--vue)
	else
		LINTCONFIG_ARGS+=(--no-vue)
	fi
fi

case "$(uname -s 2>/dev/null || true)" in
	MINGW*|MSYS*|CYGWIN*)
		PS_CMD="$(command -v powershell.exe || command -v pwsh.exe || true)"
		if [[ -z "$PS_CMD" ]]; then
			echo "Windows detected, but PowerShell was not found. Run install.ps1 from PowerShell instead." >&2
			exit 1
		fi

		echo "Windows detected; using PowerShell installer path..."
		VSCODE_ESLINT_DEFAULTS_INSTALL_VERSION="$VERSION" \
			INSTALL_CSS="$CSS_ENABLED" \
			INSTALL_MARKDOWN="$MARKDOWN_ENABLED" \
			INSTALL_VUE="$VUE_MODE" \
			INSTALL_AUTO="$AUTO_MODE" \
			INSTALL_CSS_EXPLICIT="$CSS_EXPLICIT" \
			INSTALL_MARKDOWN_EXPLICIT="$MARKDOWN_EXPLICIT" \
			INSTALL_VUE_EXPLICIT="$VUE_EXPLICIT" \
			INSTALL_LINTCONFIG_ARGS="${LINTCONFIG_ARGS[*]}" \
			"$PS_CMD" -NoProfile -ExecutionPolicy Bypass -Command '
$ErrorActionPreference = "Stop"
$resolvedVersion = $env:VSCODE_ESLINT_DEFAULTS_INSTALL_VERSION
if ($resolvedVersion -eq "latest") {
	$archiveUrl = "https://github.com/technomoron/vscode-eslint-defaults/releases/latest/download/installer.tgz"
} else {
	$archiveUrl = "https://github.com/technomoron/vscode-eslint-defaults/releases/download/v$resolvedVersion/installer.tgz"
}
$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmpDir | Out-Null
$archivePath = Join-Path $tmpDir "installer.tgz"

Write-Host "Downloading installer $resolvedVersion..."
Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing

$tarCandidates = @(
	(Join-Path $env:SystemRoot "System32\tar.exe"),
	(Join-Path $env:SystemRoot "Sysnative\tar.exe")
)
$tarPath = $tarCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $tarPath) {
	throw "Windows tar.exe not found under $env:SystemRoot."
}

Write-Host "Extracting installer files..."
& $tarPath -xzf $archivePath -C (Get-Location)
if ($LASTEXITCODE -ne 0) {
	throw "Failed to extract installer archive."
}

Write-Host "Running configure-eslint.cjs..."
node .\configure-eslint.cjs
if ($LASTEXITCODE -ne 0) {
	throw "configure-eslint.cjs failed."
}

if ($env:INSTALL_CSS -eq "0" -and $env:INSTALL_AUTO -eq "0") {
	$stylelintPath = Join-Path (Get-Location) "stylelint.config.cjs"
	if (Test-Path $stylelintPath) {
		Write-Host "CSS disabled; removing stylelint.config.cjs..."
		Remove-Item -Force $stylelintPath
	}
}

Write-Host "Cleaning up..."
Remove-Item -Force .\configure-eslint.cjs -ErrorAction SilentlyContinue
Remove-Item -Force -Recurse $tmpDir -ErrorAction SilentlyContinue
'
		exit $?
		;;
esac

if [[ "$VERSION" == "latest" ]]; then
	ARCHIVE_URL="$LATEST_ARCHIVE_URL"
else
	ARCHIVE_URL="${RELEASE_URL_BASE}/v${VERSION}/installer.tgz"
fi

TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/installer.tgz"

echo "Downloading installer ${VERSION}..."
curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_PATH"

echo "Extracting installer files..."
tar -xzf "$ARCHIVE_PATH" -C "$PWD"

echo "Running configure-eslint.cjs..."
INSTALL_CSS="$CSS_ENABLED" INSTALL_MARKDOWN="$MARKDOWN_ENABLED" INSTALL_VUE="$VUE_MODE" INSTALL_AUTO="$AUTO_MODE" INSTALL_CSS_EXPLICIT="$CSS_EXPLICIT" INSTALL_MARKDOWN_EXPLICIT="$MARKDOWN_EXPLICIT" INSTALL_VUE_EXPLICIT="$VUE_EXPLICIT" INSTALL_LINTCONFIG_ARGS="${LINTCONFIG_ARGS[*]}" node configure-eslint.cjs

if [[ "$CSS_ENABLED" -eq 0 ]] && [[ "$AUTO_MODE" -eq 0 ]] && [[ -f "stylelint.config.cjs" ]]; then
	echo "CSS disabled; removing stylelint.config.cjs..."
	rm -f stylelint.config.cjs
fi

echo "Cleaning up..."
rm -f configure-eslint.cjs
rm -rf "$TMP_DIR"

echo "Done."
