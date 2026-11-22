/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { UnlistenFn } from '@tauri-apps/api/event';

/**
 * Internal dependencies
 */
import type { TabCommands } from '../tabs/use-tab-commands';
import { useTabs } from '../tabs/store';
import {
	onFileChanged,
	onOpenFiles,
	takePendingFiles,
	watchFiles,
} from './file-api';

/**
 * Stops a listener once it is registered.
 *
 * @param unlisten The pending listener.
 */
function stop( unlisten: Promise< UnlistenFn > ) {
	unlisten.then( ( fn ) => fn() ).catch( () => {} );
}

/**
 * Opens files dropped onto the window or opened from the OS, and handles
 * changes to open files by other apps.
 *
 * @param commands The tab commands.
 */
export function useOsFiles( commands: TabCommands ) {
	const commandsRef = useRef( commands );
	commandsRef.current = commands;

	useEffect( () => {
		const dropped = getCurrentWebview().onDragDropEvent( ( event ) => {
			if ( event.payload.type === 'drop' ) {
				commandsRef.current.openPaths( event.payload.paths );
			}
		} );
		const opened = onOpenFiles( ( paths ) =>
			commandsRef.current.openPaths( paths )
		);
		// Files that the OS asked to open before the window was ready.
		opened
			.then( takePendingFiles )
			.then( ( paths ) => commandsRef.current.openPaths( paths ) )
			.catch( () => {} );
		const changed = onFileChanged( ( change ) =>
			commandsRef.current.handleFileChange( change )
		);
		return () => {
			stop( dropped );
			stop( opened );
			stop( changed );
		};
	}, [] );

	const { tabs } = useTabs();
	const paths = [
		...new Set(
			tabs.flatMap( ( tab ) => ( tab.path ? [ tab.path ] : [] ) )
		),
	]
		.sort()
		.join( '\n' );
	useEffect( () => {
		watchFiles( paths ? paths.split( '\n' ) : [] ).catch( () => {} );
	}, [ paths ] );
}
