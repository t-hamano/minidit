/**
 * External dependencies
 */
import {
	closeSearchPanel,
	findNext,
	findPrevious,
	getSearchQuery,
	openSearchPanel,
	replaceAll,
	replaceNext,
	search,
	SearchQuery,
	searchPanelOpen,
	setSearchQuery,
} from '@codemirror/search';
import type { EditorView } from '@codemirror/view';

export type SearchOptions = {
	search: string;
	replace: string;
	caseSensitive: boolean;
	regexp: boolean;
};

/** Matches counted beyond this are shown as "10000+". */
export const MAX_COUNTED_MATCHES = 10000;

/**
 * CodeMirror's search state. Its panel is replaced by an empty element,
 * since the app draws its own search bar; the panel only needs to be open
 * for CodeMirror to highlight the matches.
 */
export const searchExtension = search( {
	createPanel: () => {
		const dom = document.createElement( 'div' );
		dom.hidden = true;
		return { dom, top: true };
	},
} );

export function toQuery( options: SearchOptions ) {
	return new SearchQuery( {
		search: options.search,
		replace: options.replace,
		caseSensitive: options.caseSensitive,
		regexp: options.regexp,
		literal: ! options.regexp,
	} );
}

/**
 * Shows the search options in an editor view, or hides them.
 *
 * @param view    The editor view.
 * @param options The options, or `null` to stop highlighting matches.
 */
export function applySearch( view: EditorView, options: SearchOptions | null ) {
	if ( ! options ) {
		if ( searchPanelOpen( view.state ) ) {
			closeSearchPanel( view );
		}
		return;
	}
	const query = toQuery( options );
	if ( ! query.eq( getSearchQuery( view.state ) ) ) {
		view.dispatch( { effects: setSearchQuery.of( query ) } );
	}
	if ( ! searchPanelOpen( view.state ) ) {
		openSearchPanel( view );
	}
}

function withValidQuery( command: ( view: EditorView ) => boolean ) {
	return ( view: EditorView ) =>
		getSearchQuery( view.state ).valid && command( view );
}

export const searchCommands = {
	findNext: withValidQuery( findNext ),
	findPrevious: withValidQuery( findPrevious ),
	replaceNext: withValidQuery( replaceNext ),
	replaceAll: withValidQuery( replaceAll ),
};

export type MatchInfo = {
	/** 1-based index of the selected match; 0 when none is selected. */
	current: number;
	total: number;
	/** Whether counting stopped at `MAX_COUNTED_MATCHES`. */
	capped: boolean;
};

/**
 * Counts the matches of the current query.
 *
 * @param view The editor view.
 */
export function getMatchInfo( view: EditorView ): MatchInfo {
	const query = getSearchQuery( view.state );
	const info: MatchInfo = { current: 0, total: 0, capped: false };
	if ( ! query.valid ) {
		return info;
	}
	const { from, to } = view.state.selection.main;
	const cursor = query.getCursor( view.state );
	for ( let match = cursor.next(); ! match.done; match = cursor.next() ) {
		if ( info.total === MAX_COUNTED_MATCHES ) {
			info.capped = true;
			break;
		}
		info.total++;
		if ( match.value.from === from && match.value.to === to ) {
			info.current = info.total;
		}
	}
	return info;
}

/**
 * Whether a regular expression is valid in JavaScript syntax.
 *
 * @param source The expression.
 */
export function isValidRegExp( source: string ) {
	try {
		new RegExp( source );
		return true;
	} catch {
		return false;
	}
}
