#!/usr/bin/env bash
set -euo pipefail

VERSION_DEFAULT="1.0.39"
VERSION="${VSCODE_ESLINT_DEFAULTS_VERSION:-$VERSION_DEFAULT}"
CSS_ENABLED=0
MARKDOWN_ENABLED=1
VUE_MODE="off"
AUTO_MODE=0
CSS_EXPLICIT=0
MARKDOWN_EXPLICIT=0
VUE_EXPLICIT=0
RELEASE_URL_BASE="https://github.com/technomoron/vscode-eslint-defaults/releases/download"

usage() {
	cat <<'EOF'
Usage: install.sh [options]

Options:
  --version <v>      Version tag without the leading "v" (default: 1.0.39 or $VSCODE_ESLINT_DEFAULTS_VERSION)
  --version=<v>      Same as above (inline assignment)
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

ARCHIVE_URL="${RELEASE_URL_BASE}/v${VERSION}/installer.tgz"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/installer.tgz"

echo "Downloading installer v${VERSION}..."
curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_PATH"

echo "Extracting installer files..."
tar -xzf "$ARCHIVE_PATH" -C "$PWD"

echo "Running configure-eslint.cjs..."
INSTALL_CSS="$CSS_ENABLED" INSTALL_MARKDOWN="$MARKDOWN_ENABLED" INSTALL_VUE="$VUE_MODE" INSTALL_AUTO="$AUTO_MODE" INSTALL_CSS_EXPLICIT="$CSS_EXPLICIT" INSTALL_MARKDOWN_EXPLICIT="$MARKDOWN_EXPLICIT" INSTALL_VUE_EXPLICIT="$VUE_EXPLICIT" node configure-eslint.cjs

if [[ "$CSS_ENABLED" -eq 0 ]] && [[ "$AUTO_MODE" -eq 0 ]] && [[ -f "stylelint.config.cjs" ]]; then
	echo "CSS disabled; removing stylelint.config.cjs..."
	rm -f stylelint.config.cjs
fi

echo "Cleaning up..."
rm -f configure-eslint.cjs
rm -rf "$TMP_DIR"

echo "Done."
