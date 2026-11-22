/**
 * External dependencies
 */
import { Compartment, EditorState } from '@codemirror/state';
import { lineNumbers, type EditorView } from '@codemirror/view';

/**
 * Internal dependencies
 */
import type { Settings } from '../settings/settings';

export type ViewSettings = Pick< Settings, 'tabWidth' | 'lineNumbers' >;

/**
 * Holds the extensions that follow the settings. Each tab's editor state
 * includes it, and it is reconfigured in the shown tab when it changes.
 */
export const viewSettingsCompartment = new Compartment();

function extensionsFor( settings: ViewSettings ) {
	return [
		EditorState.tabSize.of( settings.tabWidth ),
		settings.lineNumbers ? lineNumbers() : [],
	];
}

/**
 * Applies the settings to the state shown in an editor view.
 *
 * @param view     The editor view.
 * @param settings The settings.
 */
export function applyViewSettings( view: EditorView, settings: ViewSettings ) {
	view.dispatch( {
		effects: viewSettingsCompartment.reconfigure(
			extensionsFor( settings )
		),
	} );
}
