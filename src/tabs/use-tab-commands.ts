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
	type FileChange,
	type OpenedFile,
	type SaveError,
} from '../files/file-api';
import {
	ENCODING_LABELS,
	NEW_FILE_FORMAT,
	type Encoding,
	type LineEnding,
} from '../files/text-format';
import { fileNameOf, isBlank, tabsStore, tabTitle } from './store';

export type TabCommands = {
	newTab: () => Promise< void >;
	openFiles: () => Promise< void >;
	/**
	 * Opens files, such as dropped ones. Waits for a running command
	 * instead of being ignored.
	 */
	openPaths: ( paths: string[] ) => Promise< void >;
	/**
	 * Reloads or marks a tab whose file another app changed or deleted.
	 * Waits for a running command instead of being ignored.
	 */
	handleFileChange: ( change: FileChange ) => Promise< void >;
	save: () => Promise< void >;
	saveAs: () => Promise< void >;
	closeTab: ( id?: number ) => Promise< void >;
	/** Reloads the active tab's file with another encoding. */
	reopenWithEncoding: ( encoding: Encoding ) => Promise< void >;
	/** Saves the active tab with another encoding, which it then keeps. */
	saveWithEncoding: ( encoding: Encoding ) => Promise< void >;
	setLineEnding: ( lineEnding: LineEnding ) => Promise< void >;
	/**
	 * Asks about each tab with unsaved changes in turn.
	 *
	 * @return Whether every tab may be discarded; `false` when canceled.
	 */
	confirmQuit: () => Promise< boolean >;
};

function isSaveError( error: unknown ): error is SaveError {
	return typeof error === 'object' && error !== null && 'kind' in error;
}

/**
 * File and tab operations.
 *
 * @param onDone Called after each command, e.g. to refocus the editor.
 */
export function useTabCommands( onDone: () => void ): TabCommands {
	const dialogs = useDialogs();
	const busy = useRef( false );
	/** Commands waiting for the running one to finish. */
	const waiting = useRef< ( () => void )[] >( [] );

	/**
	 * Reads a file, reporting failures and replaced characters.
	 *
	 * @param path     The file.
	 * @param encoding The encoding to use; detected when omitted.
	 * @return The file, or `null` when it could not be opened.
	 */
	const readFile = useCallback(
		async ( path: string, encoding?: Encoding ) => {
			let file: OpenedFile;
			try {
				file = await readTextFile( path, encoding );
			} catch ( error ) {
				await showError( dialogs, "Couldn't open the file", error );
				return null;
			}
			if ( file.hadErrors ) {
				await dialogs.showMessage( {
					title: 'Some characters were replaced',
					message: `Some characters in "${ fileNameOf(
						path
					) }" couldn't be read as ${
						ENCODING_LABELS[ file.encoding ]
					} and were replaced with "�".`,
				} );
			}
			return file;
		},
		[ dialogs ]
	);

	/**
	 * Saves a tab to a path with an encoding. When the encoding cannot
	 * represent the text, offers to save as UTF-8 instead.
	 *
	 * @param id       The tab.
	 * @param path     Where to save.
	 * @param encoding The encoding to save with.
	 * @return Whether the tab was saved.
	 */
	const writeTab = useCallback(
		async (
			id: number,
			path: string,
			encoding: Encoding
		): Promise< boolean > => {
			const tab = tabsStore.getTab( id );
			if ( ! tab ) {
				return false;
			}
			const { doc } = tab.editorState;
			const contents = doc.toString();
			try {
				await writeTextFile( path, contents, {
					encoding,
					lineEnding: tab.lineEnding,
				} );
			} catch ( error ) {
				if (
					isSaveError( error ) &&
					error.kind === 'unrepresentable'
				) {
					const saveAsUtf8 = await dialogs.confirm( {
						title: `Some characters can't be saved in ${ ENCODING_LABELS[ encoding ] }`,
						message: `"${ fileNameOf(
							path
						) }" contains characters, such as emoji, that ${
							ENCODING_LABELS[ encoding ]
						} can't represent.`,
						confirmLabel: 'Save as UTF-8',
					} );
					return saveAsUtf8 ? writeTab( id, path, 'utf-8' ) : false;
				}
				await showError(
					dialogs,
					"Couldn't save the file",
					isSaveError( error ) && error.kind === 'io'
						? error.message
						: error
				);
				return false;
			}
			// Text typed while saving was not saved, so the tab stays dirty.
			const isDirty = tabsStore.getTab( id )?.editorState.doc !== doc;
			tabsStore.update( id, { path, encoding, isDirty } );
			return true;
		},
		[ dialogs ]
	);

	const saveAsWithEncoding = useCallback(
		async ( encoding: Encoding ) => {
			const tab = tabsStore.getActiveTab();
			const path = await pickFileToSave( tab.path ?? 'untitled.txt' );
			if ( path ) {
				await writeTab( tab.id, path, encoding );
			}
		},
		[ writeTab ]
	);

	const saveWithEncoding = useCallback(
		async ( encoding: Encoding ) => {
			const tab = tabsStore.getActiveTab();
			if ( tab.path ) {
				await writeTab( tab.id, tab.path, encoding );
			} else {
				await saveAsWithEncoding( encoding );
			}
		},
		[ saveAsWithEncoding, writeTab ]
	);

	const save = useCallback(
		() => saveWithEncoding( tabsStore.getActiveTab().encoding ),
		[ saveWithEncoding ]
	);

	const saveAs = useCallback(
		() => saveAsWithEncoding( tabsStore.getActiveTab().encoding ),
		[ saveAsWithEncoding ]
	);

	const openPaths = useCallback(
		async ( paths: string[] ) => {
			for ( const path of paths ) {
				const existing = tabsStore.findByPath( path );
				if ( existing ) {
					tabsStore.activate( existing.id );
					continue;
				}
				const file = await readFile( path );
				if ( ! file ) {
					continue;
				}
				const active = tabsStore.getActiveTab();
				if ( isBlank( active ) ) {
					tabsStore.replace( active.id, file.text, path, file );
				} else {
					tabsStore.open( file.text, path, file );
				}
			}
		},
		[ readFile ]
	);

	const openFiles = useCallback(
		async () => openPaths( await pickFilesToOpen() ),
		[ openPaths ]
	);

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

	const reopenWithEncoding = useCallback(
		async ( encoding: Encoding ) => {
			const tab = tabsStore.getActiveTab();
			if ( ! tab.path || ! ( await confirmDiscard( tab.id ) ) ) {
				return;
			}
			const file = await readFile( tab.path, encoding );
			if ( file ) {
				tabsStore.replace( tab.id, file.text, tab.path, file );
			}
		},
		[ confirmDiscard, readFile ]
	);

	const setLineEnding = useCallback( async ( lineEnding: LineEnding ) => {
		const tab = tabsStore.getActiveTab();
		if ( tab.lineEnding !== lineEnding ) {
			tabsStore.update( tab.id, { lineEnding, isDirty: true } );
		}
	}, [] );

	const closeTab = useCallback(
		async ( id = tabsStore.getActiveTab().id ) => {
			if ( await confirmDiscard( id ) ) {
				tabsStore.close( id );
			}
		},
		[ confirmDiscard ]
	);

	const handleFileChange = useCallback(
		async ( { path, deleted }: FileChange ) => {
			const tab = tabsStore.findByPath( path );
			if ( ! tab ) {
				return;
			}
			const name = fileNameOf( path );
			if ( deleted ) {
				tabsStore.update( tab.id, { isDirty: true } );
				tabsStore.activate( tab.id );
				await dialogs.showMessage( {
					title: 'The file was deleted',
					message: `"${ name }" was deleted or moved by another app. Save to create it again.`,
				} );
				return;
			}
			if ( tab.isDirty ) {
				tabsStore.activate( tab.id );
				const reload = await dialogs.confirm( {
					title: 'The file was changed',
					message: `"${ name }" was changed by another app. Do you want to reload it and discard your unsaved changes?`,
					confirmLabel: 'Reload',
					cancelLabel: 'Keep My Changes',
					irreversible: true,
				} );
				if ( ! reload ) {
					return;
				}
			}
			const file = await readFile( path );
			if ( file && tabsStore.getTab( tab.id ) ) {
				tabsStore.replace( tab.id, file.text, path, file );
			}
		},
		[ dialogs, readFile ]
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
		 * Wraps a command so that only one runs at a time.
		 *
		 * @param command  The command to run.
		 * @param fallback Returned when the command is ignored.
		 * @param wait     Whether to wait for a running command instead of
		 *                 being ignored.
		 */
		function exclusive< Args extends unknown[], Result >(
			command: ( ...args: Args ) => Promise< Result >,
			fallback: Result,
			wait = false
		) {
			return async ( ...args: Args ) => {
				if ( busy.current && ! wait ) {
					return fallback;
				}
				while ( busy.current ) {
					await new Promise< void >( ( resolve ) =>
						waiting.current.push( resolve )
					);
				}
				busy.current = true;
				try {
					return await command( ...args );
				} finally {
					busy.current = false;
					onDone();
					waiting.current.shift()?.();
				}
			};
		}
		return {
			newTab: exclusive( async () => {
				tabsStore.open( '', null, NEW_FILE_FORMAT );
			}, undefined ),
			openFiles: exclusive( openFiles, undefined ),
			openPaths: exclusive( openPaths, undefined, true ),
			handleFileChange: exclusive( handleFileChange, undefined, true ),
			save: exclusive( save, undefined ),
			saveAs: exclusive( saveAs, undefined ),
			closeTab: exclusive( closeTab, undefined ),
			reopenWithEncoding: exclusive( reopenWithEncoding, undefined ),
			saveWithEncoding: exclusive( saveWithEncoding, undefined ),
			setLineEnding: exclusive( setLineEnding, undefined ),
			confirmQuit: exclusive( confirmQuit, false ),
		};
	}, [
		closeTab,
		confirmQuit,
		handleFileChange,
		onDone,
		openFiles,
		openPaths,
		reopenWithEncoding,
		save,
		saveAs,
		saveWithEncoding,
		setLineEnding,
	] );
}
