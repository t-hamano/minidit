/**
 * External dependencies
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * WordPress dependencies
 */
import '@wordpress/theme/design-tokens.css';

/**
 * Internal dependencies
 */
import { App } from './app';
import './style.css';

createRoot( document.getElementById( 'root' ) as HTMLElement ).render(
	<StrictMode>
		<App />
	</StrictMode>
);
