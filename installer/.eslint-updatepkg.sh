#!/bin/bash

INSTALL_PACKAGES=(
	"eslint": "^9.25.1",
	"@vue/eslint-config-prettier": "^10.2.0",
	"@vue/eslint-config-typescript": "^14.5.0",
	"@typescript-eslint/eslint-plugin@^8.30.1"
	"@typescript-eslint/parser@^8.30.1"
	"eslint-plugin-import": "^2.31.0",
	"eslint-plugin-vue": "^10.0.0",
	"prettier@^3.5.3"
);

REMOVE_PACKAGES=(
	"eslint"
	"tslint"
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

