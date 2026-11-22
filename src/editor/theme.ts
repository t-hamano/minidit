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
 * Editor colors come from the `@wordpress/theme` design tokens, so they
 * follow the light / dark theme without reconfiguring CodeMirror.
 */
export const editorTheme = EditorView.theme( {
	'&': {
		height: '100%',
		fontSize: 'var(--minidit-font-size, 14px)',
		color: 'var(--wpds-color-foreground-content-neutral)',
		backgroundColor: 'var(--wpds-color-background-surface-neutral)',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-scroller': {
		// The chosen font, with the default fonts as fallbacks.
		fontFamily: `var(--minidit-font-family,) ${ DEFAULT_FONT_FAMILY }`,
		lineHeight: '1.5',
	},
	'.cm-content': {
		padding: 'var(--wpds-dimension-padding-sm) 0',
		caretColor: 'var(--wpds-color-foreground-content-neutral)',
	},
	'.cm-gutters': {
		color: 'var(--wpds-color-foreground-content-neutral-weak)',
		backgroundColor: 'var(--wpds-color-background-surface-neutral)',
		border: 'none',
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
	'.cm-searchMatch': {
		backgroundColor: 'var(--wpds-color-background-surface-warning)',
		outline:
			'var(--wpds-border-width-xs) solid var(--wpds-color-stroke-surface-warning)',
	},
	'.cm-searchMatch-selected': {
		backgroundColor: 'var(--wpds-color-background-surface-brand)',
		outline:
			'var(--wpds-border-width-xs) solid var(--wpds-color-stroke-surface-brand-strong)',
	},
	'.cm-content ::selection, &.cm-focused .cm-content ::selection': {
		backgroundColor:
			'var(--wpds-color-background-interactive-brand-weak-active)',
	},
} );
