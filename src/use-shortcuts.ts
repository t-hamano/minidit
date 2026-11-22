/**
 * External dependencies
 */
import { useEffect } from 'react';

const isMac = navigator.userAgent.includes( 'Mac' );

type Shortcuts = {
	newFile: () => void;
	openFile: () => void;
	save: () => void;
	saveAs: () => void;
};

/**
 * Keyboard shortcuts for file operations (spec §8.4).
 *
 * These are temporary until the native menu bar, which will own the
 * accelerators, is added.
 *
 * @param shortcuts Commands to run.
 */
export function useShortcuts( shortcuts: Shortcuts ) {
	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ) => {
			const mod = isMac ? event.metaKey : event.ctrlKey;
			if ( ! mod || event.altKey ) {
				return;
			}
			const key = event.key.toLowerCase();
			let command: ( () => void ) | undefined;
			if ( key === 'n' && ! event.shiftKey ) {
				command = shortcuts.newFile;
			} else if ( key === 'o' && ! event.shiftKey ) {
				command = shortcuts.openFile;
			} else if ( key === 's' ) {
				command = event.shiftKey ? shortcuts.saveAs : shortcuts.save;
			}
			if ( command ) {
				event.preventDefault();
				command();
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [ shortcuts ] );
}
