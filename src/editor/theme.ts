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
		fontSize: '14px',
		color: 'var(--wpds-color-foreground-content-neutral)',
		backgroundColor: 'var(--wpds-color-background-surface-neutral)',
	},
	'&.cm-focused': {
		outline: 'none',
	},
	'.cm-scroller': {
		fontFamily: DEFAULT_FONT_FAMILY,
		lineHeight: '1.5',
	},
	'.cm-content': {
		padding: '8px 0',
		caretColor: 'var(--wpds-color-foreground-content-neutral)',
	},
	'.cm-line': {
		padding: '0 12px',
	},
	'.cm-content ::selection, &.cm-focused .cm-content ::selection': {
		backgroundColor:
			'var(--wpds-color-background-interactive-brand-weak-active)',
	},
} );
