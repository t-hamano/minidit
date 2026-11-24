/**
 * External dependencies
 */
import { useEffect, type ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

/**
 * WordPress dependencies
 */
import { ThemeProvider } from '@wordpress/theme';

/**
 * Internal dependencies
 */
import { useColorScheme, type ThemePreference } from './use-color-scheme';

// Background seeds for the generated color ramps. Every other color,
// including the editor's, derives from the resulting design tokens. The
// app opens the window in the same colors (see `settings.rs`).
const BACKGROUND = {
	light: '#fcfcfc',
	dark: '#1e1e1e',
} as const;

type Props = {
	theme: ThemePreference;
	children: ReactNode;
};

/**
 * Applies the design tokens for the chosen theme to the whole document,
 * including dialogs rendered outside the React root.
 *
 * @param props          Provider properties.
 * @param props.theme    Theme preference; `system` follows the OS.
 * @param props.children The app.
 */
export function AppThemeProvider( { theme, children }: Props ) {
	const scheme = useColorScheme( theme );

	// Match the native title bar and menu bar to the theme. `null` lets
	// them follow the OS.
	useEffect( () => {
		getCurrentWindow()
			.setTheme( theme === 'system' ? null : theme )
			.catch( () => {} );
	}, [ theme ] );

	// The window shows this color where the page hasn't drawn, such as while
	// it resizes. It opens in the color of the theme at launch.
	useEffect( () => {
		getCurrentWebviewWindow()
			.setBackgroundColor( BACKGROUND[ scheme ] )
			.catch( () => {} );
	}, [ scheme ] );

	return (
		<ThemeProvider isRoot color={ { background: BACKGROUND[ scheme ] } }>
			<style>{ `:root { color-scheme: ${ scheme }; }` }</style>
			{ children }
		</ThemeProvider>
	);
}
