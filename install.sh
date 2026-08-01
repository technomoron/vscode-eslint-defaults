#!/usr/bin/env bash
set -euo pipefail

REPO="technomoron/vscode-eslint-defaults"
VERSION="${VSCODE_ESLINT_DEFAULTS_VERSION:-latest}"
CSS_ENABLED=0
MARKDOWN_ENABLED=1
VUE_MODE="off"
AUTO_MODE=0
RECURSIVE=0
PURGE_LINT_DEPS=0
CSS_EXPLICIT=0
MARKDOWN_EXPLICIT=0
VUE_EXPLICIT=0

usage() {
	cat <<'EOF'
Usage: install.sh [options]

Options:
  --version <v>        Version tag without the leading "v" (default: latest or $VSCODE_ESLINT_DEFAULTS_VERSION)
  --version=<v>        Same as above (inline assignment)
  --latest             Install the latest GitHub release, overriding $VSCODE_ESLINT_DEFAULTS_VERSION
  --css / --no-css     Enable or disable CSS/SCSS linting (default: disabled)
  --md / --no-md       Enable or disable Markdown formatting (default: enabled)
  --vue / --no-vue     Force Vue lint stack on/off (default: off)
  --auto               Auto-detect CSS/Markdown usage and Vue deps
  -r, --recursive      Update eligible pnpm workspace package scripts too
  --purge-lint-deps    Also remove lint packages this installer does not manage
  -h, --help           Show this help

Unknown options are rejected. configure-eslint.cjs and lintconfig.cjs warn about
unknown options and carry on instead.
EOF
}

die() {
	echo "$1" >&2
	exit 1
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--version|-v)
			[[ $# -ge 2 ]] || die "Missing value for $1"
			VERSION="$2"
			shift 2
			;;
		--version=*)
			VERSION="${1#--version=}"
			[[ -n "$VERSION" ]] || die "Missing value for --version"
			shift
			;;
		--latest)
			VERSION="latest"
			shift
			;;
		--css)
			CSS_ENABLED=1
			CSS_EXPLICIT=1
			shift
			;;
		--no-css)
			CSS_ENABLED=0
			CSS_EXPLICIT=1
			shift
			;;
		--md|--markdown)
			MARKDOWN_ENABLED=1
			MARKDOWN_EXPLICIT=1
			shift
			;;
		--no-md|--no-markdown)
			MARKDOWN_ENABLED=0
			MARKDOWN_EXPLICIT=1
			shift
			;;
		--vue)
			VUE_MODE="on"
			VUE_EXPLICIT=1
			shift
			;;
		--no-vue)
			VUE_MODE="off"
			VUE_EXPLICIT=1
			shift
			;;
		--auto)
			AUTO_MODE=1
			shift
			;;
		--recursive|-r)
			RECURSIVE=1
			shift
			;;
		--purge-lint-deps)
			PURGE_LINT_DEPS=1
			shift
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
done

VERSION="${VERSION#v}"

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
if [[ "$RECURSIVE" -eq 1 ]]; then
	LINTCONFIG_ARGS+=(--recursive)
fi
if [[ "$PURGE_LINT_DEPS" -eq 1 ]]; then
	LINTCONFIG_ARGS+=(--purge-lint-deps)
fi

# Git Bash/MSYS/Cygwin have unreliable curl and tar builds. Hand over to the
# PowerShell installer, which uses Invoke-WebRequest and Windows' own tar.exe.
case "$(uname -s 2>/dev/null || true)" in
	MINGW*|MSYS*|CYGWIN*)
		PS_CMD="$(command -v powershell.exe || command -v pwsh.exe || true)"
		if [[ -z "$PS_CMD" ]]; then
			die "Windows detected, but PowerShell was not found. Run install.ps1 from PowerShell instead."
		fi

		echo "Windows detected; using the PowerShell installer..."
		if [[ "$VERSION" == "latest" ]]; then
			PS_REF="master"
		else
			PS_REF="v${VERSION}"
		fi

		PS_TMP_DIR="$(mktemp -d)"
		trap 'rm -rf "$PS_TMP_DIR"' EXIT
		PS_SCRIPT="${PS_TMP_DIR}/install.ps1"
		curl -fsSL "https://raw.githubusercontent.com/${REPO}/${PS_REF}/install.ps1" -o "$PS_SCRIPT"

		if command -v cygpath >/dev/null 2>&1; then
			PS_SCRIPT_WIN="$(cygpath -w "$PS_SCRIPT")"
		else
			PS_SCRIPT_WIN="$PS_SCRIPT"
		fi

		PS_ARGS=(-Version "$VERSION")
		[[ "$CSS_EXPLICIT" -eq 1 && "$CSS_ENABLED" -eq 1 ]] && PS_ARGS+=(-Css)
		[[ "$CSS_EXPLICIT" -eq 1 && "$CSS_ENABLED" -eq 0 ]] && PS_ARGS+=(-NoCss)
		[[ "$MARKDOWN_EXPLICIT" -eq 1 && "$MARKDOWN_ENABLED" -eq 1 ]] && PS_ARGS+=(-Md)
		[[ "$MARKDOWN_EXPLICIT" -eq 1 && "$MARKDOWN_ENABLED" -eq 0 ]] && PS_ARGS+=(-NoMd)
		[[ "$VUE_EXPLICIT" -eq 1 && "$VUE_MODE" == "on" ]] && PS_ARGS+=(-Vue)
		[[ "$VUE_EXPLICIT" -eq 1 && "$VUE_MODE" == "off" ]] && PS_ARGS+=(-NoVue)
		[[ "$AUTO_MODE" -eq 1 ]] && PS_ARGS+=(-Auto)
		[[ "$RECURSIVE" -eq 1 ]] && PS_ARGS+=(-Recursive)
		[[ "$PURGE_LINT_DEPS" -eq 1 ]] && PS_ARGS+=(-PurgeLintDeps)

		"$PS_CMD" -NoProfile -ExecutionPolicy Bypass -File "$PS_SCRIPT_WIN" "${PS_ARGS[@]}"
		exit $?
		;;
esac

command -v node >/dev/null 2>&1 || die "node was not found on PATH. Node.js 24 or newer is required."

if [[ "$VERSION" == "latest" ]]; then
	ASSET_BASE="https://github.com/${REPO}/releases/latest/download"
else
	ASSET_BASE="https://github.com/${REPO}/releases/download/v${VERSION}"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ARCHIVE_PATH="${TMP_DIR}/installer.tgz"

echo "Downloading installer ${VERSION}..."
curl -fsSL "${ASSET_BASE}/installer.tgz" -o "$ARCHIVE_PATH"

if curl -fsSL "${ASSET_BASE}/installer.tgz.sha256" -o "${ARCHIVE_PATH}.sha256" 2>/dev/null; then
	EXPECTED_SUM="$(tr -s ' ' <"${ARCHIVE_PATH}.sha256" | cut -d' ' -f1)"
	if command -v sha256sum >/dev/null 2>&1; then
		ACTUAL_SUM="$(sha256sum "$ARCHIVE_PATH" | cut -d' ' -f1)"
	elif command -v shasum >/dev/null 2>&1; then
		ACTUAL_SUM="$(shasum -a 256 "$ARCHIVE_PATH" | cut -d' ' -f1)"
	else
		ACTUAL_SUM=""
		echo "No sha256sum/shasum available; skipping checksum verification." >&2
	fi

	if [[ -n "$ACTUAL_SUM" ]]; then
		[[ "$ACTUAL_SUM" == "$EXPECTED_SUM" ]] || die "Checksum mismatch for installer.tgz: expected ${EXPECTED_SUM}, got ${ACTUAL_SUM}."
		echo "Installer checksum verified."
	fi
else
	echo "No installer.tgz.sha256 published for ${VERSION}; skipping checksum verification." >&2
fi

# Unpack outside the project. configure-eslint.cjs copies the config files it
# needs from here, keeping a .bak of anything it replaces.
echo "Extracting installer files..."
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

echo "Running configure-eslint.cjs..."
INSTALL_CSS="$CSS_ENABLED" \
	INSTALL_MARKDOWN="$MARKDOWN_ENABLED" \
	INSTALL_VUE="$VUE_MODE" \
	INSTALL_AUTO="$AUTO_MODE" \
	INSTALL_RECURSIVE="$RECURSIVE" \
	INSTALL_PURGE_LINT_DEPS="$PURGE_LINT_DEPS" \
	INSTALL_CSS_EXPLICIT="$CSS_EXPLICIT" \
	INSTALL_MARKDOWN_EXPLICIT="$MARKDOWN_EXPLICIT" \
	INSTALL_VUE_EXPLICIT="$VUE_EXPLICIT" \
	INSTALL_LINTCONFIG_ARGS="${LINTCONFIG_ARGS[*]}" \
	node "${TMP_DIR}/configure-eslint.cjs"

echo "Done."
