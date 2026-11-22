/**
 * External dependencies
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { redo, undo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';

/**
 * Internal dependencies
 */
import { showEditorContextMenu } from '../menu/app-menu';
import type { Tab } from '../tabs/store';

export type EditorHandle = {
	focus: () => void;
	undo: () => void;
	redo: () => void;
};

type Props = {
	/** The active tab, whose contents the editor shows. */
	tab: Tab;
};

/**
 * The text editing area, built on CodeMirror 6. One editor view is shared
 * by all tabs; switching tabs swaps in the tab's own editor state.
 */
export const Editor = forwardRef< EditorHandle, Props >( function MiniditEditor(
	{ tab },
	ref
) {
	const containerRef = useRef< HTMLDivElement >( null );
	const viewRef = useRef< EditorView | null >( null );

	const handle: EditorHandle = {
		focus: () => viewRef.current?.focus(),
		undo: () => {
			if ( viewRef.current ) {
				undo( viewRef.current );
			}
		},
		redo: () => {
			if ( viewRef.current ) {
				redo( viewRef.current );
			}
		},
	};
	useImperativeHandle( ref, () => handle );

	useEffect( () => {
		const view = new EditorView( { parent: containerRef.current! } );
		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [] );

	// A tab's `editorState` follows every update, so it only needs to be
	// swapped in when another tab becomes active.
	useEffect( () => {
		const view = viewRef.current;
		if ( view ) {
			view.setState( tab.editorState );
			view.focus();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ tab.id ] );

	return (
		<div
			className="minidit-editor"
			ref={ containerRef }
			onContextMenu={ ( event ) => {
				event.preventDefault();
				showEditorContextMenu( handle ).catch( () => {} );
			} }
		/>
	);
} );
