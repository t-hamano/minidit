/**
 * External dependencies
 */
import {
	defaultHighlightStyle,
	syntaxHighlighting,
} from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Internal dependencies
 */
import type { ColorScheme } from '../theme/use-color-scheme';

/**
 * The editor's colors, including syntax colors, come from CodeMirror's
 * own themes: its default light style, and One Dark for the dark theme.
 * The app's design tokens are only used outside the editor.
 *
 * @param scheme The color scheme to display.
 */
export function editorColors( scheme: ColorScheme ) {
	return scheme === 'dark'
		? oneDark
		: syntaxHighlighting( defaultHighlightStyle );
}
