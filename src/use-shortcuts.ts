/**
 * External dependencies
 */
import { useEffect } from 'react';

/**
 * Internal dependencies
 */
import type { TabCommands } from './tabs/use-tab-commands';

const isMac = navigator.userAgent.includes( 'Mac' );

/**
 * Keyboard shortcuts for file and tab operations.
 *
 * These are temporary until the native menu bar, which will own the
 * accelerators, is added.
 *
 * @param commands Commands to run.
 */
export function useShortcuts( commands: TabCommands ) {
	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ) => {
			const mod = isMac ? event.metaKey : event.ctrlKey;
			if ( ! mod || event.altKey ) {
				return;
			}
			const key = event.key.toLowerCase();
			let command: ( () => unknown ) | undefined;
			if ( ! event.shiftKey && key === 'n' ) {
				command = commands.newTab;
			} else if ( ! event.shiftKey && key === 'o' ) {
				command = commands.openFiles;
			} else if ( ! event.shiftKey && key === 'w' ) {
				command = () => commands.closeTab();
			} else if ( key === 's' ) {
				command = event.shiftKey ? commands.saveAs : commands.save;
			}
			if ( command ) {
				event.preventDefault();
				command();
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [ commands ] );
}
