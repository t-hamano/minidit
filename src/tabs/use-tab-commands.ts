/**
 * External dependencies
 */
import { useCallback, useMemo, useRef } from 'react';

/**
 * Internal dependencies
 */
import { showError, useDialogs } from '../dialogs/dialog-provider';
import {
	pickFilesToOpen,
	pickFileToSave,
	readTextFile,
	writeTextFile,
} from '../files/file-api';
import { isBlank, tabsStore, tabTitle } from './store';

export type TabCommands = {
	newTab: () => Promise< void >;
	openFiles: () => Promise< void >;
	save: () => Promise< void >;
	saveAs: () => Promise< void >;
	closeTab: ( id?: number ) => Promise< void >;
	/**
	 * Asks about each tab with unsaved changes in turn.
	 *
	 * @return Whether every tab may be discarded; `false` when canceled.
	 */
	confirmQuit: () => Promise< boolean >;
};

/**
 * File and tab operations.
 *
 * @param onDone Called after each command, e.g. to refocus the editor.
 */
export function useTabCommands( onDone: () => void ): TabCommands {
	const dialogs = useDialogs();
	const busy = useRef( false );

	const writeTab = useCallback(
		async ( id: number, path: string ) => {
			const tab = tabsStore.getTab( id );
			if ( ! tab ) {
				return;
			}
			try {
				await writeTextFile( path, tab.editorState.doc.toString() );
			} catch ( error ) {
				await showError( dialogs, "Couldn't save the file", error );
				return;
			}
			tabsStore.update( id, { path, isDirty: false } );
		},
		[ dialogs ]
	);

	const saveAs = useCallback( async () => {
		const tab = tabsStore.getActiveTab();
		const path = await pickFileToSave( tab.path ?? 'untitled.txt' );
		if ( path ) {
			await writeTab( tab.id, path );
		}
	}, [ writeTab ] );

	const save = useCallback( async () => {
		const tab = tabsStore.getActiveTab();
		if ( tab.path ) {
			await writeTab( tab.id, tab.path );
		} else {
			await saveAs();
		}
	}, [ saveAs, writeTab ] );

	const openFiles = useCallback( async () => {
		for ( const path of await pickFilesToOpen() ) {
			const existing = tabsStore.findByPath( path );
			if ( existing ) {
				tabsStore.activate( existing.id );
				continue;
			}
			let text: string;
			try {
				text = await readTextFile( path );
			} catch ( error ) {
				await showError( dialogs, "Couldn't open the file", error );
				continue;
			}
			const active = tabsStore.getActiveTab();
			if ( isBlank( active ) ) {
				tabsStore.replace( active.id, text, path );
			} else {
				tabsStore.open( text, path );
			}
		}
	}, [ dialogs ] );

	const confirmDiscard = useCallback(
		( id: number ) => {
			const tab = tabsStore.getTab( id );
			if ( ! tab?.isDirty ) {
				return Promise.resolve( true );
			}
			tabsStore.activate( id );
			return dialogs.confirm( {
				title: 'Unsaved changes',
				message: `"${ tabTitle(
					tab
				) }" has unsaved changes. Do you want to discard them?`,
				confirmLabel: tab.path ? 'Discard changes' : 'Discard',
				irreversible: true,
			} );
		},
		[ dialogs ]
	);

	const closeTab = useCallback(
		async ( id = tabsStore.getActiveTab().id ) => {
			if ( await confirmDiscard( id ) ) {
				tabsStore.close( id );
			}
		},
		[ confirmDiscard ]
	);

	const confirmQuit = useCallback( async () => {
		for ( const tab of tabsStore.getSnapshot().tabs ) {
			if ( ! ( await confirmDiscard( tab.id ) ) ) {
				return false;
			}
		}
		return true;
	}, [ confirmDiscard ] );

	return useMemo( () => {
		/**
		 * Wraps a command so it is ignored while another one is running.
		 *
		 * @param command  The command to run.
		 * @param fallback Returned when the command is ignored.
		 */
		function exclusive< Args extends unknown[], Result >(
			command: ( ...args: Args ) => Promise< Result >,
			fallback: Result
		) {
			return async ( ...args: Args ) => {
				if ( busy.current ) {
					return fallback;
				}
				busy.current = true;
				try {
					return await command( ...args );
				} finally {
					busy.current = false;
					onDone();
				}
			};
		}
		return {
			newTab: exclusive( async () => {
				tabsStore.open( '', null );
			}, undefined ),
			openFiles: exclusive( openFiles, undefined ),
			save: exclusive( save, undefined ),
			saveAs: exclusive( saveAs, undefined ),
			closeTab: exclusive( closeTab, undefined ),
			confirmQuit: exclusive( confirmQuit, false ),
		};
	}, [ closeTab, confirmQuit, onDone, openFiles, save, saveAs ] );
}
