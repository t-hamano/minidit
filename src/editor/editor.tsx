/**
 * External dependencies
 */
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
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
import { loadedLanguage, loadLanguage } from './languages';
import { applyViewSettings, type ViewSettings } from './view-settings';
import type { Settings } from '../settings/settings';

export type EditorHandle = {
	focus: () => void;
	undo: () => void;
	redo: () => void;
	/**
	 * Runs a search command, after first showing `options` when given.
	 */
	runSearchCommand: (
		name: keyof typeof searchCommands,
		options?: SearchOptions
	) => void;
	getMatchInfo: () => MatchInfo;
};

type Props = {
	/** The active tab, whose contents the editor shows. */
	tab: Tab;
	/** The search bar's options while it is open, otherwise `null`. */
	search: SearchOptions | null;
	settings: Settings;
};

/**
 * The text editing area, built on CodeMirror 6. One editor view is shared
 * by all tabs; switching tabs swaps in the tab's own editor state.
 */
export const Editor = forwardRef< EditorHandle, Props >( function MiniditEditor(
	{ tab, search, settings },
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
		runSearchCommand: ( name, options ) => {
			if ( viewRef.current ) {
				if ( options ) {
					applySearch( viewRef.current, options );
				}
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

	// Rerenders once the active tab's language has loaded.
	const [ , setLanguagesLoaded ] = useState( 0 );
	useEffect( () => {
		if ( ! loadedLanguage( tab.path ) ) {
			loadLanguage( tab.path ).then( ( language ) => {
				if ( language ) {
					setLanguagesLoaded( ( count ) => count + 1 );
				}
			} );
		}
	}, [ tab.path ] );
	const language = loadedLanguage( tab.path );

	const viewSettings = useMemo< ViewSettings >(
		() => ( {
			fontFamily: settings.fontFamily,
			fontSize: ( settings.fontSize * settings.zoom ) / 100,
			tabWidth: settings.tabWidth,
			lineNumbers: settings.lineNumbers,
			showWhitespace: settings.showWhitespace,
			indentation: tab.indentation ?? {
				type: settings.indentType,
				width: settings.tabWidth,
			},
			language,
		} ),
		[
			settings.fontFamily,
			settings.fontSize,
			settings.zoom,
			settings.tabWidth,
			settings.lineNumbers,
			settings.showWhitespace,
			settings.indentType,
			tab.indentation,
			language,
		]
	);
	const viewSettingsRef = useRef( viewSettings );
	viewSettingsRef.current = viewSettings;

	useEffect( () => {
		const view = viewRef.current;
		if ( view ) {
			view.setState( tab.editorState );
			applyViewSettings( view, viewSettingsRef.current );
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

	useEffect( () => {
		if ( viewRef.current ) {
			applyViewSettings( viewRef.current, viewSettings );
		}
	}, [ viewSettings ] );

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
