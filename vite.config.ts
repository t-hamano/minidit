import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig( {
	plugins: [ react() ],
	clearScreen: false,
	build: {
		// Tauri uses WebView2 (Chromium) on Windows and WKWebView on macOS 13+.
		target: [ 'chrome110', 'safari16' ],
	},
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: [ '**/src-tauri/**' ],
		},
	},
} );
