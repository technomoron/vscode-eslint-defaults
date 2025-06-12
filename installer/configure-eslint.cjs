const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const haunted_artifacts = [
        '.eslintignore',
        '.eslintrc.cjs',
        'eslint.config.js'
];

const cursed_dependencies = [
    'eslint@^9.25.1',
    'prettier@^3.5.3',
    'eslint-config-prettier@^10.1.5',
    'eslint-plugin-prettier@^5.4.1',
    'eslint-plugin-vue@^10.0.0',
    'vue-eslint-parser@^10.1.3',
    '@typescript-eslint/eslint-plugin@^8.30.1',
    '@typescript-eslint/parser@^8.30.1',
    '@vue/eslint-config-typescript@^14.5.0',
    '@vue/eslint-config-prettier@^10.2.0',
    'eslint-plugin-import@^2.31.0',
    'eslint-plugin-nuxt@^4.0.0',
    'eslint-import-resolver-alias@^1.1.2'
];

const banished_dependencies = ['eslint', 'tslint'];

const incantation_scripts = {
        lint: 'eslint --ext .js,.ts,.vue ./',
        lintfix: 'eslint --fix --ext .js,.ts,.vue ./',
        pretty: 'prettier --write "**/*.{js,jsx,ts,tsx,vue,json,css,scss,md}"',
        format: 'npm run lintfix && npm run pretty',
        cleanbuild: 'rm -rf ./dist/ && npm run lintfix && npm run format && npm run build',
};

function summon(command, allowFail = false) {
        console.log(`\n🔮 ${command}`);
        try {
                execSync(command, { stdio: 'inherit' });
        } catch (err) {
                if (allowFail) {
                        console.warn(`⚠️  Command failed (ignored): ${command}`);
                } else {
                        throw err;
                }
        }
}

function banish_haunted_files() {
        console.log('🧹 Sweeping away haunted artifacts...');
        haunted_artifacts.forEach((artifact) => {
                const fullPath = path.join(process.cwd(), artifact);
                if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                        console.log(`💀 Banished ${artifact}`);
                } else {
                        console.log(`🫥 ${artifact} not found — skipping.`);
                }
        });
}

function inscribe_package_scroll() {
        const scroll_path = path.join(process.cwd(), 'package.json');
        if (!fs.existsSync(scroll_path)) {
                console.error('💀 package.json scroll not found.');
                process.exit(1);
        }

        const spellbook = JSON.parse(fs.readFileSync(scroll_path, 'utf8'));

        spellbook.scripts ||= {};

        for (const [rune, incantation] of Object.entries(incantation_scripts)) {
                if (spellbook.scripts[rune]) {
                        console.warn(`👻 Rune "${rune}" already etched — replacing.`);
                }
                spellbook.scripts[rune] = incantation;
                console.log(`✨ Etched rune "${rune}" into the scroll.`);
        }

        fs.writeFileSync(scroll_path, JSON.stringify(spellbook, null, 2) + '\n');
        console.log('📜 package scroll updated.');
}

function brew_dependencies() {
        const has_pnpm_charm = (() => {
                try {
                        execSync('pnpm --version', { stdio: 'ignore' });
                        return true;
                } catch {
                        return false;
                }
        })();

        if (has_pnpm_charm) {
                console.log('🟣 Casting spells with pnpm...');
                summon(`pnpm remove ${banished_dependencies.join(' ')}`, true);
                summon(`pnpm add -D ${cursed_dependencies.join(' ')}`);
        } else {
                console.log('🔵 Brewing with npm...');
                summon(`npm uninstall ${banished_dependencies.join(' ')}`);
                summon(`npm install -D ${cursed_dependencies.join(' ')}`, true);
        }

        console.log('🧪 Ritual complete. Dev dependencies enchanted.');
}

console.log('🔥 Let the ritual begin...');
banish_haunted_files();
inscribe_package_scroll();
brew_dependencies();
