/**
 * External dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Internal dependencies
 */
import { DialogProvider } from './dialogs/dialog-provider';
import { Editor, type EditorHandle } from './editor/editor';
import type { SearchOptions } from './editor/search';
import { useAppMenu, type MenuHandlers } from './menu/app-menu';
import { SearchBar, type SearchBarHandle } from './search/search-bar';
import { StatusBar } from './status-bar';
import { tabsStore, useTabs } from './tabs/store';
import { TabBar } from './tabs/tab-bar';
import { useTabCommands } from './tabs/use-tab-commands';
import { useConfirmBeforeClose, useWindowTitle } from './tabs/use-window';
import { AppThemeProvider } from './theme/app-theme-provider';
import type { ThemePreference } from './theme/use-color-scheme';
import { useTabSwitchShortcuts } from './use-shortcuts';

const DEFAULT_SEARCH: SearchOptions = {
	search: '',
	replace: '',
	caseSensitive: false,
	regexp: false,
};

/**
 * Whether a text field outside the editor, such as in the search bar, has
 * focus. Undo and Redo then apply to that field.
 *
 * @param ownerDocument The app's document.
 */
function isTextFieldFocused( ownerDocument: Document ) {
	const element = ownerDocument.activeElement;
	return (
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement
	);
}

type WorkspaceProps = {
	theme: ThemePreference;
	setTheme: ( theme: ThemePreference ) => void;
};

function Workspace( { theme, setTheme }: WorkspaceProps ) {
	const editorRef = useRef< EditorHandle >( null );
	const focusEditor = useCallback( () => editorRef.current?.focus(), [] );
	const commands = useTabCommands( focusEditor );
	useTabs();
	const activeTab = tabsStore.getActiveTab();

	const searchBarRef = useRef< SearchBarHandle >( null );
	const [ searchOpen, setSearchOpen ] = useState( false );
	const [ searchOptions, setSearchOptions ] =
		useState< SearchOptions >( DEFAULT_SEARCH );
	const searchOptionsRef = useRef( searchOptions );
	searchOptionsRef.current = searchOptions;

	// Focused after rendering, since the bar may not be mounted yet.
	const [ focusRequest, setFocusRequest ] = useState< {
		field: 'find' | 'replace';
	} | null >( null );
	useEffect( () => {
		if ( focusRequest ) {
			searchBarRef.current?.focus( focusRequest.field );
		}
	}, [ focusRequest ] );

	const openSearch = useCallback( ( field: 'find' | 'replace' ) => {
		setSearchOpen( true );
		setFocusRequest( { field } );
	}, [] );
	const closeSearch = useCallback( () => {
		setSearchOpen( false );
		focusEditor();
	}, [ focusEditor ] );
	const findAgain = useCallback(
		( command: 'findNext' | 'findPrevious' ) => {
			if ( searchOptionsRef.current.search ) {
				setSearchOpen( true );
				editorRef.current?.runSearchCommand(
					command,
					searchOptionsRef.current
				);
			} else {
				openSearch( 'find' );
			}
		},
		[ openSearch ]
	);

	const mainRef = useRef< HTMLElement >( null );
	const undoOrRedo = useCallback( ( command: 'undo' | 'redo' ) => {
		const ownerDocument = mainRef.current?.ownerDocument;
		if ( ownerDocument && isTextFieldFocused( ownerDocument ) ) {
			ownerDocument.execCommand( command );
		} else {
			editorRef.current?.[ command ]();
		}
	}, [] );

	const menuHandlers = useMemo< MenuHandlers >(
		() => ( {
			newTab: commands.newTab,
			openFiles: commands.openFiles,
			save: commands.save,
			saveAs: commands.saveAs,
			closeTab: () => commands.closeTab(),
			quit: async () => {
				if ( await commands.confirmQuit() ) {
					await getCurrentWindow().destroy();
				}
			},
			undo: () => undoOrRedo( 'undo' ),
			redo: () => undoOrRedo( 'redo' ),
			find: () => openSearch( 'find' ),
			replace: () => openSearch( 'replace' ),
			findNext: () => findAgain( 'findNext' ),
			findPrevious: () => findAgain( 'findPrevious' ),
			setTheme,
		} ),
		[ commands, setTheme, openSearch, findAgain, undoOrRedo ]
	);

	useAppMenu( menuHandlers, theme );
	useTabSwitchShortcuts();
	useWindowTitle( activeTab );
	useConfirmBeforeClose( commands.confirmQuit );

	return (
		<main className="minidit-app" ref={ mainRef }>
			<TabBar
				onNewTab={ commands.newTab }
				onCloseTab={ commands.closeTab }
				onFocusEditor={ focusEditor }
			/>
			{ searchOpen && (
				<SearchBar
					ref={ searchBarRef }
					options={ searchOptions }
					onChange={ setSearchOptions }
					onClose={ closeSearch }
					editorRef={ editorRef }
				/>
			) }
			<Editor
				ref={ editorRef }
				tab={ activeTab }
				search={ searchOpen ? searchOptions : null }
			/>
			<StatusBar tab={ activeTab } commands={ commands } />
		</main>
	);
}

export function App() {
	// Saved to the settings file once settings are added.
	const [ theme, setTheme ] = useState< ThemePreference >( 'system' );
	return (
		<AppThemeProvider theme={ theme }>
			<DialogProvider>
				<Workspace theme={ theme } setTheme={ setTheme } />
			</DialogProvider>
		</AppThemeProvider>
	);
}
