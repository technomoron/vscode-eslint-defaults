#!/bin/bash

INSTALL_PACKAGES=(
	"@typescript-eslint/eslint-plugin@^8.30.1"
	"@typescript-eslint/parser@^8.30.1"
	"eslint@^8.57.1"
	"eslint-config-standard@^17.1.0"
	"eslint-plugin-import@^2.31.0"
	"eslint-plugin-vue@^10.0.0"
	"prettier@^3.5.3"
);

REMOVE_PACKAGES=(
	"tslint"
	"standard"
	"xo"
);

if command -v pnpm &> /dev/null; then
	echo "Adding and removing packages using pnpm ..."
	pnpm remove "${REMOVE_PACKAGES[@]}"
	pnpm add -D "${INSTALL_PACKAGES[@]}"
else
	echo "Adding and removing packages using npm ..."
	npm uninstall "${REMOVE_PACKAGES[@]}"
	npm install -D "${INSTALL_PACKAGES[@]}"
fi

echo "Dev dependencies configured."

