import pluginVue from 'eslint-plugin-vue';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginImport from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import vueEslintParser from 'vue-eslint-parser';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default [
	{
		ignores: [
			'node_modules',
			'dist',
			'.output',
			'.nuxt',
			'coverage',
			'**/*.d.ts',
			'configure-eslint.js',
			'*.config.js',
			'*.config.ts',
			'public'
		]
	},
	...defineConfigWithVueTs(vueTsConfigs.recommended),
	{
		files: ['**/*.vue'],
		languageOptions: {
			parser: vueEslintParser,
			parserOptions: {
				parser: '@typescript-eslint/parser', // Use TypeScript parser for <script> sections
				ecmaVersion: 2023,
				sourceType: 'module',
				extraFileExtensions: ['.vue']
			}
		}
	},
	{
		files: ['*.json'],
		rules: {
			quotes: ['error', 'double']
		}
	},
	{
		files: ['**/*.{ts,mts,tsx}'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2023,
				sourceType: 'module',
				extraFileExtensions: ['.vue']
			},
			globals: {
				RequestInit: 'readonly',
				process: 'readonly',
				Capacitor: 'readonly',
				chrome: 'readonly'
			}
		},
		plugins: {
			vue: pluginVue,
			prettier: pluginPrettier,
			import: pluginImport
		},
		rules: {
			indent: ['error', 'tab', { SwitchCase: 1 }],
			quotes: ['warn', 'single', { avoidEscape: true }],
			semi: ['error', 'always'],
			'comma-dangle': 'off',
			'prettier/prettier': 'error',
			'import/order': [
				'error',
				{
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: true }
				}
			],
			'vue/multi-word-component-names': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off'
		}
	},
	{
		rules: {
			'vue/html-indent': ['error', 'tab'],
			'vue/max-attributes-per-line': ['error', { singleline: 1, multiline: 3 }],
			'vue/singleline-html-element-content-newline': 'off',
			// 'vue/no-v-html': 'error',
			'vue/require-default-prop': 'error',
			'vue/require-prop-types': 'error',
			'vue/html-self-closing': [
				'error',
				{
					html: {
						void: 'always',
						normal: 'never',
						component: 'always'
					}
				}
			]
		}
	},
	{
		rules: {
			'vue/component-name-in-template-casing': [
				'error',
				'kebab-case',
				{
					registeredComponentsOnly: false,
					ignores: []
				}
			]
		}
	}
];
