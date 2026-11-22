/**
 * External dependencies
 */
import { useCallback, useRef, useState, type RefObject } from 'react';

/**
 * Internal dependencies
 */
import { showError, useDialog } from '../dialogs/dialog-provider';
import type { EditorHandle } from '../editor/editor';
import {
	fileNameOf,
	pickFileToOpen,
	pickFileToSave,
	readTextFile,
	writeTextFile,
} from './file-api';

export const UNTITLED = '(untitled)';

type LoadedDocument = {
	/** Changes whenever new contents are loaded into the editor. */
	key: number;
	initialText: string;
};

/**
 * File operations for the single open document: New, Open, Save, and
 * Save As (spec §4.1–4.3).
 *
 * @param editorRef The editor showing the document.
 */
export function useDocument( editorRef: RefObject< EditorHandle | null > ) {
	const showDialog = useDialog();
	const [ loaded, setLoaded ] = useState< LoadedDocument >( {
		key: 0,
		initialText: '',
	} );
	const [ path, setPath ] = useState< string | null >( null );
	const [ isDirty, setIsDirty ] = useState( false );

	// Keeps the latest values for callbacks that outlive a render, and
	// keeps two file operations from running at the same time.
	const state = useRef( { path, isDirty } );
	state.current = { path, isDirty };
	const busy = useRef( false );

	const markDirty = useCallback( () => setIsDirty( true ), [] );

	const writeTo = useCallback(
		async ( target: string ) => {
			try {
				await writeTextFile(
					target,
					editorRef.current?.getText() ?? ''
				);
			} catch ( error ) {
				await showError( showDialog, "Couldn't save the file", error );
				return false;
			}
			setPath( target );
			setIsDirty( false );
			return true;
		},
		[ editorRef, showDialog ]
	);

	const saveAs = useCallback( async () => {
		const current = state.current.path;
		const target = await pickFileToSave( current ?? 'untitled.txt' );
		return target ? writeTo( target ) : false;
	}, [ writeTo ] );

	const save = useCallback( async () => {
		const current = state.current.path;
		return current ? writeTo( current ) : saveAs();
	}, [ saveAs, writeTo ] );

	/**
	 * Asks whether to save unsaved changes before they are replaced.
	 *
	 * @return Whether it is OK to continue.
	 */
	const confirmDiscard = useCallback( async () => {
		if ( ! state.current.isDirty ) {
			return true;
		}
		const name = state.current.path
			? fileNameOf( state.current.path )
			: UNTITLED;
		const choice = await showDialog( {
			title: `Do you want to save the changes to ${ name }?`,
			message: "Your changes will be lost if you don't save them.",
			buttons: [
				{ label: 'Save', value: 'save', primary: true },
				{ label: "Don't Save", value: 'discard' },
				{ label: 'Cancel', value: 'cancel' },
			],
			dismissValue: 'cancel',
		} );
		if ( choice === 'save' ) {
			return save();
		}
		return choice === 'discard';
	}, [ save, showDialog ] );

	const load = useCallback( ( text: string, newPath: string | null ) => {
		setLoaded( ( previous ) => ( {
			key: previous.key + 1,
			initialText: text,
		} ) );
		setPath( newPath );
		setIsDirty( false );
	}, [] );

	const newFile = useCallback( async () => {
		if ( await confirmDiscard() ) {
			load( '', null );
		}
	}, [ confirmDiscard, load ] );

	const openFile = useCallback( async () => {
		if ( ! ( await confirmDiscard() ) ) {
			return;
		}
		const target = await pickFileToOpen();
		if ( ! target ) {
			return;
		}
		try {
			load( await readTextFile( target ), target );
		} catch ( error ) {
			await showError( showDialog, "Couldn't open the file", error );
		}
	}, [ confirmDiscard, load, showDialog ] );

	/**
	 * Wraps a command so it is ignored while another one is running.
	 *
	 * @param command The command to run.
	 */
	const exclusive = useCallback(
		( command: () => Promise< unknown > ) => async () => {
			if ( busy.current ) {
				return;
			}
			busy.current = true;
			try {
				await command();
			} finally {
				busy.current = false;
				editorRef.current?.focus();
			}
		},
		[ editorRef ]
	);

	return {
		loaded,
		path,
		isDirty,
		markDirty,
		commands: {
			newFile: exclusive( newFile ),
			openFile: exclusive( openFile ),
			save: exclusive( save ),
			saveAs: exclusive( saveAs ),
		},
	};
}
