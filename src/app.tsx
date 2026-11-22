/**
 * External dependencies
 */
import { useCallback, useRef } from 'react';

/**
 * Internal dependencies
 */
import { DialogProvider } from './dialogs/dialog-provider';
import { Editor, type EditorHandle } from './editor/editor';
import { tabsStore, useTabs } from './tabs/store';
import { TabBar } from './tabs/tab-bar';
import { useTabCommands } from './tabs/use-tab-commands';
import { useConfirmBeforeClose, useWindowTitle } from './tabs/use-window';
import { AppThemeProvider } from './theme/app-theme-provider';
import { StatusBar } from './status-bar';
import { useShortcuts } from './use-shortcuts';

function Workspace() {
	const editorRef = useRef< EditorHandle >( null );
	const focusEditor = useCallback( () => editorRef.current?.focus(), [] );
	const commands = useTabCommands( focusEditor );
	useTabs();
	const activeTab = tabsStore.getActiveTab();

	useShortcuts( commands );
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
	return (
		// The theme setting arrives with the settings screen; until then the
		// app follows the OS.
		<AppThemeProvider theme="system">
			<DialogProvider>
				<Workspace />
			</DialogProvider>
		</AppThemeProvider>
	);
}
