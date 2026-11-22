/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Internal dependencies
 */
import { flushSettings, saveWindowState } from '../settings/settings';
import { tabTitle, type Tab } from './store';

const isMac = navigator.userAgent.includes( 'Mac' );

/**
 * Shows the active tab's file name as the window title. On Windows, a tab
 * with unsaved changes is marked with `•`.
 *
 * @param tab The active tab.
 */
export function useWindowTitle( tab: Tab ) {
	const title = ( tab.isDirty && ! isMac ? '• ' : '' ) + tabTitle( tab );
	useEffect( () => {
		document.title = title;
		getCurrentWindow()
			.setTitle( title )
			.catch( () => {} );
	}, [ title ] );
}

/**
 * Closes the window, which quits the app, after saving the settings and
 * the window's position and size.
 */
export async function closeWindow() {
	await flushSettings();
	await saveWindowState().catch( () => {} );
	await getCurrentWindow().destroy();
}

/**
 * Asks about unsaved changes before the window closes, and before the app
 * quits from outside its menu, such as from the Dock on macOS.
 *
 * @param confirmQuit Resolves to whether the window may close.
 */
export function useConfirmBeforeClose( confirmQuit: () => Promise< boolean > ) {
	const confirmRef = useRef( confirmQuit );
	confirmRef.current = confirmQuit;

	useEffect( () => {
		const quit = async () => {
			if ( await confirmRef.current() ) {
				await closeWindow();
			}
		};
		const unlistenClose = getCurrentWindow().onCloseRequested(
			( event ) => {
				event.preventDefault();
				return quit();
			}
		);
		const unlistenQuit = listen( 'quit-requested', quit );
		return () => {
			for ( const unlisten of [ unlistenClose, unlistenQuit ] ) {
				unlisten.then( ( stop ) => stop() ).catch( () => {} );
			}
		};
	}, [] );
}
