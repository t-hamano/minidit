/**
 * External dependencies
 */
import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

const query = window.matchMedia( '(prefers-color-scheme: dark)' );

function subscribe( onChange: () => void ) {
	query.addEventListener( 'change', onChange );
	return () => query.removeEventListener( 'change', onChange );
}

/**
 * Resolves a theme preference to the color scheme to display. `system`
 * follows the OS and updates when the OS setting changes.
 *
 * @param preference The theme preference.
 */
export function useColorScheme( preference: ThemePreference ): ColorScheme {
	const systemDark = useSyncExternalStore( subscribe, () => query.matches );
	if ( preference === 'system' ) {
		return systemDark ? 'dark' : 'light';
	}
	return preference;
}
