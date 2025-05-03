# vscode-eslint-defaults

Default config for VSCode, ESLint and prettier, both for editor and command line.

## Install

Unix/Linux/FreeBSD/MacOS:

```bash
curl -L https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.5/installer.tgz | tar -vxz && node configure-eslint.js && rm installer-tgz configure-eslint.js
```

Windows with Power Shell

```bash
Invoke-WebRequest -Uri https://github.com/technomoron/vscode-eslint-defaults/releases/download/v1.0.9/installer.tgz -OutFile installer.tgz; tar -xvzf installer.tgz; node configure-eslint.js; Remove-Item -Force installer.tgz, configure-eslint.js

```


The configure script will remove old eslint packages and add new ones,
update eslint to v9.x and add some script targets to package.json
