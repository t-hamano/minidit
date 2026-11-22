/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';

/**
 * Internal dependencies
 */
import type { MenuHandlers } from './menu/app-menu';
import { tabsStore } from './tabs/store';

const isMac = navigator.userAgent.includes( 'Mac' );

type BrowserKeyHandlers = Pick<
	MenuHandlers,
	'find' | 'zoomIn' | 'zoomOut' | 'resetZoom'
>;

/**
 * Finds the command for a key that WebView2 on Windows keeps to itself as a
 * browser shortcut. Such keys reach the page but never the menu bar, so
 * their menu shortcuts do nothing. Matching `event.key` rather than the
 * physical key also lets Ctrl+= work on keyboards where `=` needs Shift,
 * such as Japanese ones.
 *
 * @param event The key event.
 */
function getBrowserKeyCommand(
	event: KeyboardEvent
): keyof BrowserKeyHandlers | null {
	if ( ! event.ctrlKey || event.altKey || event.metaKey ) {
		return null;
	}
	switch ( event.key ) {
		case 'f':
		case 'F':
			return event.shiftKey ? null : 'find';
		case '=':
		case '+':
			return 'zoomIn';
		case '-':
			return event.shiftKey ? null : 'zoomOut';
		case '0':
			return event.shiftKey ? null : 'resetZoom';
		default:
			return null;
	}
}

/**
 * Runs the menu commands for Ctrl+F and the zoom keys on Windows, where
 * WebView2 does not pass these keys on to the menu bar.
 *
 * @param handlers Commands the keys run.
 */
export function useBrowserKeyShortcuts( handlers: BrowserKeyHandlers ) {
	const handlersRef = useRef( handlers );
	handlersRef.current = handlers;

	useEffect( () => {
		if ( isMac ) {
			return;
		}
		const onKeyDown = ( event: KeyboardEvent ) => {
			const command = getBrowserKeyCommand( event );
			if ( command ) {
				// Also keeps the key from reaching the menu bar, in case
				// WebView2 passes it on, so the command runs once.
				event.preventDefault();
				handlersRef.current[ command ]();
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );
}

/**
 * Keyboard shortcuts that have no menu item: Ctrl+Tab and Ctrl+Shift+Tab
 * switch tabs, on macOS too. The menu bar handles every other shortcut,
 * except for those in `useBrowserKeyShortcuts`.
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
