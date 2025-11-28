#!/usr/bin/env bash
set -euo pipefail

VERSION_DEFAULT="1.0.26"
VERSION="${VSCODE_ESLINT_DEFAULTS_VERSION:-$VERSION_DEFAULT}"
CSS_ENABLED=1
MARKDOWN_ENABLED=1
RELEASE_URL_BASE="https://github.com/technomoron/vscode-eslint-defaults/releases/download"

usage() {
	cat <<'EOF'
Usage: install.sh [options]

Options:
  --version <v>      Version tag without the leading "v" (default: 1.0.23 or $VSCODE_ESLINT_DEFAULTS_VERSION)
  --css / --no-css   Enable or disable CSS/SCSS linting (default: enabled)
  --markdown / --no-markdown  Enable or disable Markdown linting (default: enabled)
  -h, --help         Show this help
EOF
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--version|-v)
			shift
			VERSION="${1:-$VERSION}"
			;;
		--css)
			CSS_ENABLED=1
			;;
		--no-css)
			CSS_ENABLED=0
			;;
		--markdown)
			MARKDOWN_ENABLED=1
			;;
		--no-markdown)
			MARKDOWN_ENABLED=0
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

ARCHIVE_URL="${RELEASE_URL_BASE}/v${VERSION}/installer.tgz"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/installer.tgz"

echo "Downloading installer v${VERSION}..."
curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_PATH"

echo "Extracting installer files..."
tar -xzf "$ARCHIVE_PATH" -C "$PWD"

echo "Running configure-eslint.cjs..."
INSTALL_CSS="$CSS_ENABLED" INSTALL_MARKDOWN="$MARKDOWN_ENABLED" node configure-eslint.cjs

if [[ "$CSS_ENABLED" -eq 0 ]] && [[ -f "stylelint.config.cjs" ]]; then
	echo "CSS disabled; removing stylelint.config.cjs..."
	rm -f stylelint.config.cjs
fi

echo "Cleaning up..."
rm -f configure-eslint.cjs
rm -rf "$TMP_DIR"

echo "Done."
