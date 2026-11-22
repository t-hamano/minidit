/**
 * External dependencies
 */
import { useRef } from 'react';

/**
 * Internal dependencies
 */
import { DialogProvider } from './dialogs/dialog-provider';
import { Editor, type EditorHandle } from './editor/editor';
import { useDocument } from './files/use-document';
import { AppThemeProvider } from './theme/app-theme-provider';
import { useShortcuts } from './use-shortcuts';

function Workspace() {
	const editorRef = useRef< EditorHandle >( null );
	const { loaded, markDirty, commands } = useDocument( editorRef );
	useShortcuts( commands );

	return (
		<main className="minidit-app">
			<Editor
				ref={ editorRef }
				documentKey={ loaded.key }
				initialText={ loaded.initialText }
				onChange={ markDirty }
			/>
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
