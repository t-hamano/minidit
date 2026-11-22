/**
 * External dependencies
 */
import detectIndent from 'detect-indent';
import { indentMore, insertTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { keymap, type Command } from '@codemirror/view';

/**
 * Internal dependencies
 */
import { TAB_WIDTHS, type IndentType } from '../settings/settings';

export type Indentation = {
	type: IndentType;
	/** Spaces per level when `type` is `spaces`. */
	width: number;
};

/** Lines examined when detecting a file's indentation. */
const DETECTION_LINES = 1000;

/**
 * Detects a file's indentation from its first lines.
 *
 * @param text The file's text.
 * @return The indentation, or `null` when no line is indented or the width
 *         isn't one of 2, 4, or 8, so the settings' defaults apply.
 */
export function detectIndentation( text: string ): Indentation | null {
	let end = -1;
	for ( let line = 0; line < DETECTION_LINES; line++ ) {
		end = text.indexOf( '\n', end + 1 );
		if ( end === -1 ) {
			break;
		}
	}
	const { type, amount } = detectIndent(
		end === -1 ? text : text.slice( 0, end )
	);
	if ( type === 'tab' ) {
		return { type: 'tabs', width: amount };
	}
	if (
		type === 'space' &&
		( TAB_WIDTHS as readonly number[] ).includes( amount )
	) {
		return { type: 'spaces', width: amount };
	}
	return null;
}

/**
 * Inserts one indentation level of spaces, or indents the selected lines.
 *
 * @param width Spaces per indentation level.
 */
function insertSpaces( width: number ): Command {
	const spaces = ' '.repeat( width );
	return ( view ) => {
		const { state } = view;
		if ( state.selection.ranges.some( ( range ) => ! range.empty ) ) {
			return indentMore( view );
		}
		view.dispatch( state.replaceSelection( spaces ), {
			scrollIntoView: true,
			userEvent: 'input',
		} );
		return true;
	};
}

/**
 * The Tab key's behavior and the indentation unit for an indentation.
 *
 * @param indentation The tab's indentation.
 */
export function indentationExtensions( indentation: Indentation ): Extension {
	return indentation.type === 'tabs'
		? [
				indentUnit.of( '\t' ),
				keymap.of( [ { key: 'Tab', run: insertTab } ] ),
			]
		: [
				indentUnit.of( ' '.repeat( indentation.width ) ),
				keymap.of( [
					{ key: 'Tab', run: insertSpaces( indentation.width ) },
				] ),
			];
}
