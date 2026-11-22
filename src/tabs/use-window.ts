/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
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
 * Asks about unsaved changes before the window closes.
 *
 * @param confirmQuit Resolves to whether the window may close.
 */
export function useConfirmBeforeClose( confirmQuit: () => Promise< boolean > ) {
	const confirmRef = useRef( confirmQuit );
	confirmRef.current = confirmQuit;

	useEffect( () => {
		const appWindow = getCurrentWindow();
		const unlisten = appWindow.onCloseRequested( async ( event ) => {
			event.preventDefault();
			if ( await confirmRef.current() ) {
				await closeWindow();
			}
		} );
		return () => {
			unlisten.then( ( stop ) => stop() ).catch( () => {} );
		};
	}, [] );
}
