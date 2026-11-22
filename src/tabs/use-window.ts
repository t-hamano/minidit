/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Internal dependencies
 */
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
				await appWindow.destroy();
			}
		} );
		return () => {
			unlisten.then( ( stop ) => stop() ).catch( () => {} );
		};
	}, [] );
}
