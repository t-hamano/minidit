/**
 * External dependencies
 */
import { EditorView } from '@codemirror/view';

const isMac = navigator.userAgent.includes( 'Mac' );

// Latin font first, then a Japanese font as fallback.
const DEFAULT_FONT_FAMILY = isMac
	? '"Menlo", "Hiragino Sans", monospace'
	: '"Consolas", "MS Gothic", monospace';

/**
 * The editor font. A chosen font comes first, with the default fonts as
 * fallbacks for missing glyphs.
 *
 * @param fontFamily Font name; empty for the default font.
 * @param fontSize   Font size in pixels, including the zoom level.
 */
export function fontTheme( fontFamily: string, fontSize: number ) {
	const name = fontFamily.trim();
	return EditorView.theme( {
		'&': { fontSize: `${ fontSize }px` },
		'.cm-scroller': {
			fontFamily: name
				? `${ JSON.stringify( name ) }, ${ DEFAULT_FONT_FAMILY }`
				: DEFAULT_FONT_FAMILY,
		},
	} );
}

/**
 * The editor's layout. Its colors are left to CodeMirror's themes; see
 * `editorColors`.
 */
export const editorTheme = EditorView.theme( {
	'&': {
		height: '100%',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-scroller': {
		lineHeight: '1.5',
	},
	'.cm-content': {
		padding: 'var(--wpds-dimension-padding-sm) 0',
	},
	'.cm-lineNumbers .cm-gutterElement': {
		paddingInlineStart: 'var(--wpds-dimension-padding-md)',
	},
	'.cm-line': {
		padding: '0 var(--wpds-dimension-padding-md)',
	},
	// Holds CodeMirror's hidden search panel; the app draws its own bar.
	'.cm-panels-top': {
		border: 'none',
	},
} );
