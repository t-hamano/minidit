/**
 * External dependencies
 */
import { useEffect } from 'react';

/**
 * Internal dependencies
 */
import { tabsStore } from './tabs/store';

/**
 * Keyboard shortcuts that have no menu item: Ctrl+Tab and Ctrl+Shift+Tab
 * switch tabs, on macOS too. The menu bar handles every other shortcut.
 */
export function useTabSwitchShortcuts() {
	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ) => {
			if (
				event.key === 'Tab' &&
				event.ctrlKey &&
				! event.altKey &&
				! event.metaKey
			) {
				event.preventDefault();
				tabsStore.activateRelative( event.shiftKey ? -1 : 1 );
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );
}
