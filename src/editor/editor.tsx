/**
 * External dependencies
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
	defaultKeymap,
	history,
	historyKeymap,
	insertTab,
} from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

/**
 * Internal dependencies
 */
import { editorTheme } from './theme';

export type EditorHandle = {
	getText: () => string;
	focus: () => void;
};

type Props = {
	/**
	 * Identifies the document. Changing it replaces the editor contents
	 * and clears the undo history.
	 */
	documentKey: number;
	/** Text loaded into the editor whenever `documentKey` changes. */
	initialText: string;
	/** Called on every edit by the user. */
	onChange: () => void;
};

function createState( text: string, onChange: () => void ) {
	return EditorState.create( {
		doc: text,
		extensions: [
			history(),
			keymap.of( [
				{ key: 'Tab', run: insertTab },
				...defaultKeymap,
				...historyKeymap,
			] ),
			EditorView.lineWrapping,
			EditorView.contentAttributes.of( {
				spellcheck: 'false',
				autocorrect: 'off',
				autocapitalize: 'off',
			} ),
			EditorView.updateListener.of( ( update ) => {
				if ( update.docChanged ) {
					onChange();
				}
			} ),
			editorTheme,
		],
	} );
}

/**
 * The text editing area, built on CodeMirror 6.
 */
export const Editor = forwardRef< EditorHandle, Props >( function MiniditEditor(
	{ documentKey, initialText, onChange },
	ref
) {
	const containerRef = useRef< HTMLDivElement >( null );
	const viewRef = useRef< EditorView | null >( null );
	const onChangeRef = useRef( onChange );
	onChangeRef.current = onChange;

	useImperativeHandle( ref, () => ( {
		getText: () => viewRef.current?.state.doc.toString() ?? '',
		focus: () => viewRef.current?.focus(),
	} ) );

	useEffect( () => {
		const view = new EditorView( {
			parent: containerRef.current!,
		} );
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [] );

	useEffect( () => {
		const view = viewRef.current;
		if ( ! view ) {
			return;
		}
		view.setState(
			createState( initialText, () => onChangeRef.current() )
		);
		view.focus();
		// `initialText` is only read when the document changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ documentKey ] );

	return <div className="minidit-editor" ref={ containerRef } />;
} );
