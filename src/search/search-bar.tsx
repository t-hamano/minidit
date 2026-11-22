/**
 * External dependencies
 */
import {
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	forwardRef,
	type KeyboardEvent,
	type RefObject,
} from 'react';

/**
 * WordPress dependencies
 */
import { closeSmall } from '@wordpress/icons';
import { Button, IconButton, Input } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import type { EditorHandle } from '../editor/editor';
import {
	isValidRegExp,
	MAX_COUNTED_MATCHES,
	type MatchInfo,
	type SearchOptions,
} from '../editor/search';
import { editorUpdateListeners } from '../editor/state';

export type SearchBarHandle = {
	/** Focuses the Find field, or the Replace field, and selects its text. */
	focus: ( field: 'find' | 'replace' ) => void;
};

type Props = {
	options: SearchOptions;
	onChange: ( options: SearchOptions ) => void;
	onClose: () => void;
	editorRef: RefObject< EditorHandle | null >;
};

function formatCount( { current, total, capped }: MatchInfo ) {
	if ( total === 0 ) {
		return 'No results';
	}
	const all = capped ? `${ MAX_COUNTED_MATCHES }+` : String( total );
	return current ? `${ current } of ${ all }` : `${ all } results`;
}

/**
 * The find and replace bar shown above the editor.
 */
export const SearchBar = forwardRef< SearchBarHandle, Props >(
	function MiniditSearchBar(
		{ options, onChange, onClose, editorRef },
		ref
	) {
		const findRef = useRef< HTMLInputElement >( null );
		const replaceRef = useRef< HTMLInputElement >( null );
		const [ matchInfo, setMatchInfo ] = useState< MatchInfo | null >(
			null
		);

		useImperativeHandle( ref, () => ( {
			focus: ( field ) => {
				const input =
					field === 'find' ? findRef.current : replaceRef.current;
				input?.focus();
				input?.select();
			},
		} ) );

		// Recount after every editor update, at most once per frame.
		useEffect( () => {
			let frame = 0;
			const recount = () => {
				cancelAnimationFrame( frame );
				frame = requestAnimationFrame( () =>
					setMatchInfo( editorRef.current?.getMatchInfo() ?? null )
				);
			};
			recount();
			editorUpdateListeners.add( recount );
			return () => {
				cancelAnimationFrame( frame );
				editorUpdateListeners.delete( recount );
			};
		}, [ editorRef, options ] );

		const isInvalid =
			options.regexp &&
			options.search !== '' &&
			! isValidRegExp( options.search );

		useEffect( () => {
			findRef.current?.setCustomValidity(
				isInvalid ? 'Invalid regular expression' : ''
			);
		}, [ isInvalid ] );

		const run = (
			name: Parameters< EditorHandle[ 'runSearchCommand' ] >[ 0 ]
		) => editorRef.current?.runSearchCommand( name );

		const onKeyDown = (
			event: KeyboardEvent,
			field: 'find' | 'replace'
		) => {
			if ( event.key === 'Escape' ) {
				event.preventDefault();
				onClose();
			} else if ( event.key === 'Enter' ) {
				event.preventDefault();
				if ( field === 'replace' ) {
					run( 'replaceNext' );
				} else {
					run( event.shiftKey ? 'findPrevious' : 'findNext' );
				}
			}
		};

		const toggle = ( key: 'caseSensitive' | 'regexp', label: string ) => (
			<Button
				variant={ options[ key ] ? 'solid' : 'outline' }
				tone="neutral"
				size="compact"
				aria-pressed={ options[ key ] }
				onClick={ () =>
					onChange( { ...options, [ key ]: ! options[ key ] } )
				}
			>
				{ label }
			</Button>
		);

		return (
			<div
				className="minidit-search-bar"
				role="search"
				aria-label="Find and replace"
			>
				<div className="minidit-search-bar__row">
					<Input
						ref={ findRef }
						className="minidit-search-bar__input"
						size="compact"
						placeholder="Find"
						aria-label="Find"
						value={ options.search }
						data-validity-visible={ isInvalid ? '' : undefined }
						onChange={ ( event ) =>
							onChange( {
								...options,
								search: event.target.value,
							} )
						}
						onKeyDown={ ( event ) => onKeyDown( event, 'find' ) }
					/>
					<span
						className="minidit-search-bar__count"
						aria-live="polite"
					>
						{ options.search && ! isInvalid && matchInfo
							? formatCount( matchInfo )
							: '' }
					</span>
					{ toggle( 'caseSensitive', 'Match Case' ) }
					{ toggle( 'regexp', 'Regex' ) }
					<Button
						variant="outline"
						tone="neutral"
						size="compact"
						onClick={ () => run( 'findPrevious' ) }
					>
						Previous
					</Button>
					<Button
						variant="outline"
						tone="neutral"
						size="compact"
						onClick={ () => run( 'findNext' ) }
					>
						Next
					</Button>
					<IconButton
						label="Close"
						icon={ closeSmall }
						variant="minimal"
						tone="neutral"
						size="compact"
						onClick={ onClose }
					/>
				</div>
				<div className="minidit-search-bar__row">
					<Input
						ref={ replaceRef }
						className="minidit-search-bar__input"
						size="compact"
						placeholder="Replace"
						aria-label="Replace"
						value={ options.replace }
						onChange={ ( event ) =>
							onChange( {
								...options,
								replace: event.target.value,
							} )
						}
						onKeyDown={ ( event ) => onKeyDown( event, 'replace' ) }
					/>
					<Button
						variant="outline"
						tone="neutral"
						size="compact"
						onClick={ () => run( 'replaceNext' ) }
					>
						Replace
					</Button>
					<Button
						variant="outline"
						tone="neutral"
						size="compact"
						onClick={ () => run( 'replaceAll' ) }
					>
						Replace All
					</Button>
				</div>
			</div>
		);
	}
);
