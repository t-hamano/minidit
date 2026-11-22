/**
 * External dependencies
 */
import type { Language } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { lineNumbers, type EditorView } from '@codemirror/view';

/**
 * Internal dependencies
 */
import type { Settings } from '../settings/settings';
import { indentationExtensions, type Indentation } from './indent';
import { syntaxColors } from './highlight';
import { fontTheme } from './theme';
import { showWhitespace } from './whitespace';

export type ViewSettings = Pick<
	Settings,
	'fontFamily' | 'tabWidth' | 'lineNumbers' | 'showWhitespace'
> & {
	/** Font size in pixels, including the zoom level. */
	fontSize: number;
	/** The active tab's indentation. */
	indentation: Indentation;
	/** The active tab's language, or `null` for plain text. */
	language: Language | null;
};

/**
 * Holds the extensions that follow the settings and the active tab. Each
 * tab's editor state includes it, and it is reconfigured in the shown tab
 * when any of them change.
 */
export const viewSettingsCompartment = new Compartment();

function extensionsFor( settings: ViewSettings ) {
	return [
		fontTheme( settings.fontFamily, settings.fontSize ),
		EditorState.tabSize.of( settings.tabWidth ),
		settings.lineNumbers ? lineNumbers() : [],
		settings.showWhitespace ? showWhitespace : [],
		indentationExtensions( settings.indentation ),
		settings.language ? [ settings.language, syntaxColors ] : [],
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
