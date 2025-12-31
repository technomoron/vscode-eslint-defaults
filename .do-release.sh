#!/bin/sh

VERSION=$(node -p "require('./package.json').version")

echo "Creating release for ${VERSION}"

if [ -n "$(git status --porcelain)" ]; then
	echo "Working tree is not clean. Commit or stash changes before release." >&2
	exit 1
fi

if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
	echo "Tag v${VERSION} already exists. Aborting." >&2
	exit 1
fi

git tag -a "v${VERSION}" -m "Release version ${VERSION}"
git push origin "v${VERSION}"
