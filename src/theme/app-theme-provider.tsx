/**
 * External dependencies
 */
import type { ReactNode } from 'react';

/**
 * WordPress dependencies
 */
import { ThemeProvider } from '@wordpress/theme';

/**
 * Internal dependencies
 */
import { useColorScheme, type ThemePreference } from './use-color-scheme';

// Background seeds for the generated color ramps. Every other color,
// including the editor's, derives from the resulting design tokens.
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
	return (
		<ThemeProvider isRoot color={ { background: BACKGROUND[ scheme ] } }>
			<style>{ `:root { color-scheme: ${ scheme }; }` }</style>
			{ children }
		</ThemeProvider>
	);
}
