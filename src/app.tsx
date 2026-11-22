/**
 * External dependencies
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Internal dependencies
 */
import { DialogProvider } from './dialogs/dialog-provider';
import { Editor, type EditorHandle } from './editor/editor';
import { useAppMenu, type MenuHandlers } from './menu/app-menu';
import { StatusBar } from './status-bar';
import { tabsStore, useTabs } from './tabs/store';
import { TabBar } from './tabs/tab-bar';
import { useTabCommands } from './tabs/use-tab-commands';
import { useConfirmBeforeClose, useWindowTitle } from './tabs/use-window';
import { AppThemeProvider } from './theme/app-theme-provider';
import type { ThemePreference } from './theme/use-color-scheme';
import { useTabSwitchShortcuts } from './use-shortcuts';

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
			undo: () => editorRef.current?.undo(),
			redo: () => editorRef.current?.redo(),
			setTheme,
		} ),
		[ commands, setTheme ]
	);

	useAppMenu( menuHandlers, theme );
	useTabSwitchShortcuts();
	useWindowTitle( activeTab );
	useConfirmBeforeClose( commands.confirmQuit );

	return (
		<main className="minidit-app">
			<TabBar
				onNewTab={ commands.newTab }
				onCloseTab={ commands.closeTab }
				onFocusEditor={ focusEditor }
			/>
			<Editor ref={ editorRef } tab={ activeTab } />
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
