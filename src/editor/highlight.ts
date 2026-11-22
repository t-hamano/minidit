/**
 * External dependencies
 */
import {
	defaultHighlightStyle,
	syntaxHighlighting,
} from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Internal dependencies
 */
import type { ColorScheme } from '../theme/use-color-scheme';

// Search matches are the one exception to CodeMirror's colors: the
// current match gets a strong orange with a border, so it stands out from
// the other matches, which keep a pale background.
const lightSearchColors = EditorView.theme( {
	'.cm-searchMatch': {
		backgroundColor: '#ffe5004d',
	},
	'.cm-searchMatch.cm-searchMatch-selected': {
		backgroundColor: '#ff9632',
		outline: '1px solid #c25400',
	},
} );

const darkSearchColors = EditorView.theme(
	{
		'.cm-searchMatch': {
			backgroundColor: '#72a1ff33',
			outline: 'none',
		},
		'.cm-searchMatch.cm-searchMatch-selected': {
			backgroundColor: '#8c4600b3',
			outline: '1px solid #ffa24d',
		},
	},
	{ dark: true }
);

/**
 * The editor's colors, including syntax colors, come from CodeMirror's
 * own themes: its default light style, and One Dark for the dark theme.
 * The app's design tokens are only used outside the editor.
 *
 * @param scheme The color scheme to display.
 */
export function editorColors( scheme: ColorScheme ) {
	return scheme === 'dark'
		? [ darkSearchColors, oneDark ]
		: [ lightSearchColors, syntaxHighlighting( defaultHighlightStyle ) ];
}
