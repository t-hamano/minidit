import wpPlugin from '@wordpress/eslint-plugin';

export default [
	{
		ignores: [ 'src-tauri/**', 'dist/**', 'node_modules/**' ],
	},
	...wpPlugin.configs.recommended,
	{
		files: [ 'src/**/*.{ts,tsx}' ],
		rules: {
			'@wordpress/dependency-group': 'error',
		},
	},
];
