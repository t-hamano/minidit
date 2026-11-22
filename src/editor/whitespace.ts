/**
 * External dependencies
 */
import {
	Decoration,
	EditorView,
	highlightWhitespace,
	MatchDecorator,
	ViewPlugin,
	type DecorationSet,
	type ViewUpdate,
} from '@codemirror/view';

const fullWidthSpace = new MatchDecorator( {
	regexp: /\u3000/g,
	decoration: Decoration.mark( { class: 'cm-fullWidthSpace' } ),
} );

/** Outlines full-width spaces, which `highlightWhitespace` doesn't mark. */
const highlightFullWidthSpace = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor( view: EditorView ) {
			this.decorations = fullWidthSpace.createDeco( view );
		}

		update( update: ViewUpdate ) {
			this.decorations = fullWidthSpace.updateDeco(
				update,
				this.decorations
			);
		}
	},
	{ decorations: ( plugin ) => plugin.decorations }
);

// Same colors as CodeMirror's own whitespace markers.
const fullWidthSpaceTheme = EditorView.baseTheme( {
	'.cm-fullWidthSpace': {
		outline: '1px dashed',
		outlineOffset: '-1px',
	},
	'&light .cm-fullWidthSpace': {
		outlineColor: '#aaa',
	},
	'&dark .cm-fullWidthSpace': {
		outlineColor: '#555',
	},
} );

/** Shows half-width spaces, tabs, and full-width spaces. */
export const showWhitespace = [
	highlightWhitespace(),
	highlightFullWidthSpace,
	fullWidthSpaceTheme,
];
