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
import {
	applySearch,
	getMatchInfo,
	searchCommands,
	type MatchInfo,
	type SearchOptions,
} from './search';

export type EditorHandle = {
	focus: () => void;
	undo: () => void;
	redo: () => void;
	runSearchCommand: ( name: keyof typeof searchCommands ) => void;
	getMatchInfo: () => MatchInfo;
};

type Props = {
	/** The active tab, whose contents the editor shows. */
	tab: Tab;
	/** The search bar's options while it is open, otherwise `null`. */
	search: SearchOptions | null;
};

/**
 * The text editing area, built on CodeMirror 6. One editor view is shared
 * by all tabs; switching tabs swaps in the tab's own editor state.
 */
export const Editor = forwardRef< EditorHandle, Props >( function MiniditEditor(
	{ tab, search },
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
		runSearchCommand: ( name ) => {
			if ( viewRef.current ) {
				searchCommands[ name ]( viewRef.current );
			}
		},
		getMatchInfo: () =>
			viewRef.current
				? getMatchInfo( viewRef.current )
				: { current: 0, total: 0, capped: false },
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
	const searchRef = useRef( search );
	searchRef.current = search;

	useEffect( () => {
		const view = viewRef.current;
		if ( view ) {
			view.setState( tab.editorState );
			applySearch( view, searchRef.current );
			if ( ! searchRef.current ) {
				view.focus();
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ tab.id ] );

	useEffect( () => {
		if ( viewRef.current ) {
			applySearch( viewRef.current, search );
		}
	}, [ search ] );

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
