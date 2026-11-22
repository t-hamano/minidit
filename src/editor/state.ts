/**
 * External dependencies
 */
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
import { searchExtension } from './search';
import { editorTheme } from './theme';
import { viewSettingsCompartment } from './view-settings';

type UpdateListener = ( view: EditorView ) => void;

/**
 * Listeners called after every editor update in any tab, e.g. to refresh
 * the search match count.
 */
export const editorUpdateListeners = new Set< UpdateListener >();

/**
 * Creates the editor state for one tab. Each tab has its own state, so
 * undo history is kept per tab.
 *
 * @param text     Initial contents.
 * @param onUpdate Called with the new state after every update, and
 *                 whether the text changed.
 */
export function createEditorState(
	text: string,
	onUpdate: ( state: EditorState, docChanged: boolean ) => void
) {
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
			searchExtension,
			// Filled in when the state is shown.
			viewSettingsCompartment.of( [] ),
			EditorView.updateListener.of( ( update ) => {
				onUpdate( update.state, update.docChanged );
				editorUpdateListeners.forEach( ( listener ) =>
					listener( update.view )
				);
			} ),
			editorTheme,
		],
	} );
}
