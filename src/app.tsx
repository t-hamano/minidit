/**
 * External dependencies
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Internal dependencies
 */
import { DialogProvider } from './dialogs/dialog-provider';
import { Editor, type EditorHandle } from './editor/editor';
import type { SearchOptions } from './editor/search';
import { useAppMenu, type MenuHandlers } from './menu/app-menu';
import { SearchBar, type SearchBarHandle } from './search/search-bar';
import { DEFAULT_SETTINGS, stepZoom } from './settings/settings';
import { SettingsDialog } from './settings/settings-dialog';
import { AboutDialog } from './about/about-dialog';
import { useUpdater } from './updater/use-updater';
import { SettingsProvider, useSettings } from './settings/settings-provider';
import { StatusBar } from './status-bar';
import { tabsStore, useTabs } from './tabs/store';
import { TabBar } from './tabs/tab-bar';
import { useTabCommands } from './tabs/use-tab-commands';
import { useOsFiles } from './files/use-os-files';
import {
	closeWindow,
	useConfirmBeforeClose,
	useWindowTitle,
} from './tabs/use-window';
import { AppThemeProvider } from './theme/app-theme-provider';
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

function Workspace() {
	const { settings, updateSettings } = useSettings();
	const [ settingsOpen, setSettingsOpen ] = useState( false );
	const [ aboutOpen, setAboutOpen ] = useState( false );
	const editorRef = useRef< EditorHandle >( null );
	const focusEditor = useCallback( () => editorRef.current?.focus(), [] );
	const commands = useTabCommands( focusEditor );
	useTabs();
	const activeTab = tabsStore.getActiveTab();

	const searchBarRef = useRef< SearchBarHandle >( null );
	const [ searchOpen, setSearchOpen ] = useState( false );
	// Find opens the bar with only its Find field, as in VS Code.
	const [ replaceOpen, setReplaceOpen ] = useState( false );
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
		if ( field === 'replace' ) {
			setReplaceOpen( true );
		}
		setFocusRequest( { field } );
	}, [] );
	const closeSearch = useCallback( () => {
		setSearchOpen( false );
		setReplaceOpen( false );
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
					await closeWindow();
				}
			},
			undo: () => undoOrRedo( 'undo' ),
			redo: () => undoOrRedo( 'redo' ),
			find: () => openSearch( 'find' ),
			replace: () => openSearch( 'replace' ),
			findNext: () => findAgain( 'findNext' ),
			findPrevious: () => findAgain( 'findPrevious' ),
			openSettings: () => setSettingsOpen( true ),
			openAbout: () => setAboutOpen( true ),
			setTheme: ( theme ) => updateSettings( { theme } ),
			toggleLineNumbers: () =>
				updateSettings( { lineNumbers: ! settings.lineNumbers } ),
			toggleWhitespace: () =>
				updateSettings( { showWhitespace: ! settings.showWhitespace } ),
			zoomIn: () =>
				updateSettings( { zoom: stepZoom( settings.zoom, 1 ) } ),
			zoomOut: () =>
				updateSettings( { zoom: stepZoom( settings.zoom, -1 ) } ),
			resetZoom: () => updateSettings( { zoom: DEFAULT_SETTINGS.zoom } ),
		} ),
		[
			commands,
			openSearch,
			findAgain,
			undoOrRedo,
			updateSettings,
			settings.lineNumbers,
			settings.showWhitespace,
			settings.zoom,
		]
	);

	useAppMenu( menuHandlers, settings );
	useTabSwitchShortcuts();
	useWindowTitle( activeTab );
	useConfirmBeforeClose( commands.confirmQuit );
	useOsFiles( commands );
	const offerUpdate = useUpdater(
		settings.checkForUpdates,
		commands.confirmQuit
	);

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
					replaceOpen={ replaceOpen }
					onToggleReplace={ () =>
						setReplaceOpen( ( open ) => ! open )
					}
					onClose={ closeSearch }
					editorRef={ editorRef }
				/>
			) }
			<Editor
				ref={ editorRef }
				tab={ activeTab }
				search={ searchOpen ? searchOptions : null }
				settings={ settings }
			/>
			<StatusBar
				tab={ activeTab }
				commands={ commands }
				zoom={ settings.zoom }
			/>
			<SettingsDialog
				open={ settingsOpen }
				onClose={ () => setSettingsOpen( false ) }
			/>
			<AboutDialog
				open={ aboutOpen }
				onClose={ () => setAboutOpen( false ) }
				onUpdateFound={ offerUpdate }
			/>
		</main>
	);
}

function ThemedApp() {
	const { settings } = useSettings();
	return (
		<AppThemeProvider theme={ settings.theme }>
			<DialogProvider>
				<Workspace />
			</DialogProvider>
		</AppThemeProvider>
	);
}

export function App() {
	return (
		<SettingsProvider>
			<ThemedApp />
		</SettingsProvider>
	);
}
