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
	type ComponentProps,
	type RefObject,
} from 'react';

/**
 * WordPress dependencies
 */
import {
	arrowDown,
	arrowUp,
	chevronDown,
	chevronRight,
	closeSmall,
	formatCapitalize,
	replace,
} from '@wordpress/icons';
import { IconButton, InputLayout } from '@wordpress/ui';

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
import { regex, replaceAll } from './icons';

export type SearchBarHandle = {
	/** Focuses the Find field, or the Replace field, and selects its text. */
	focus: ( field: 'find' | 'replace' ) => void;
};

type Props = {
	options: SearchOptions;
	onChange: ( options: SearchOptions ) => void;
	/** Whether the Replace field is shown. */
	replaceOpen: boolean;
	onToggleReplace: () => void;
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
 * A 24px text field. `Input` only comes in 32px and 40px, so this puts a
 * native input in the `InputLayout` that `Input` itself is built on.
 */
const SearchInput = forwardRef< HTMLInputElement, ComponentProps< 'input' > >(
	function MiniditSearchInput( props, ref ) {
		return (
			<InputLayout size="small" className="minidit-search-input">
				<input
					ref={ ref }
					type="text"
					className="minidit-search-input__field"
					{ ...props }
				/>
			</InputLayout>
		);
	}
);

/**
 * The find and replace bar shown above the editor.
 */
export const SearchBar = forwardRef< SearchBarHandle, Props >(
	function MiniditSearchBar(
		{ options, onChange, replaceOpen, onToggleReplace, onClose, editorRef },
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

		// Escape closes the bar from the bar or the editor. It is caught
		// before the editor sees it, which would otherwise only deselect
		// the match.
		const onCloseRef = useRef( onClose );
		onCloseRef.current = onClose;
		useEffect( () => {
			const ownerDocument = findRef.current?.ownerDocument;
			if ( ! ownerDocument ) {
				return;
			}
			const onEscape = ( event: globalThis.KeyboardEvent ) => {
				if (
					event.key !== 'Escape' ||
					event.isComposing ||
					! (
						event.target instanceof Element &&
						event.target.closest(
							'.minidit-search-bar, .cm-editor'
						)
					)
				) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				onCloseRef.current();
			};
			ownerDocument.addEventListener( 'keydown', onEscape, true );
			return () =>
				ownerDocument.removeEventListener( 'keydown', onEscape, true );
		}, [] );

		const run = (
			name: Parameters< EditorHandle[ 'runSearchCommand' ] >[ 0 ]
		) => editorRef.current?.runSearchCommand( name );

		const onKeyDown = (
			event: KeyboardEvent,
			field: 'find' | 'replace'
		) => {
			// Keys that confirm an input method's text are not commands.
			if ( event.nativeEvent.isComposing ) {
				return;
			}
			if ( event.key === 'Enter' ) {
				event.preventDefault();
				if ( field === 'replace' ) {
					run( 'replaceNext' );
				} else {
					run( event.shiftKey ? 'findPrevious' : 'findNext' );
				}
			}
		};

		const toggle = (
			key: 'caseSensitive' | 'regexp',
			label: string,
			icon: ComponentProps< typeof IconButton >[ 'icon' ]
		) => (
			<IconButton
				label={ label }
				icon={ icon }
				variant={ options[ key ] ? 'solid' : 'minimal' }
				tone="neutral"
				size="small"
				aria-pressed={ options[ key ] }
				onClick={ () =>
					onChange( { ...options, [ key ]: ! options[ key ] } )
				}
			/>
		);

		const action = (
			label: string,
			icon: ComponentProps< typeof IconButton >[ 'icon' ],
			command: Parameters< EditorHandle[ 'runSearchCommand' ] >[ 0 ],
			disabled = false
		) => (
			<IconButton
				label={ label }
				icon={ icon }
				variant="minimal"
				tone="neutral"
				size="small"
				disabled={ disabled }
				onClick={ () => run( command ) }
			/>
		);

		// Nothing to move to or replace without a search that finds something.
		const hasMatches =
			!! options.search && ! isInvalid && !! matchInfo?.total;

		return (
			<div
				className="minidit-search-bar"
				role="search"
				aria-label="Find and replace"
			>
				<IconButton
					label="Toggle Replace"
					icon={ replaceOpen ? chevronDown : chevronRight }
					variant="minimal"
					tone="neutral"
					size="small"
					aria-expanded={ replaceOpen }
					onClick={ onToggleReplace }
				/>
				<div className="minidit-search-bar__row">
					<SearchInput
						ref={ findRef }
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
					<div className="minidit-search-bar__actions">
						<span
							className="minidit-search-bar__count"
							aria-live="polite"
						>
							{ options.search && ! isInvalid && matchInfo
								? formatCount( matchInfo )
								: '' }
						</span>
						{ toggle(
							'caseSensitive',
							'Match Case',
							formatCapitalize
						) }
						{ toggle( 'regexp', 'Regex', regex ) }
						{ action(
							'Previous Match',
							arrowUp,
							'findPrevious',
							! hasMatches
						) }
						{ action(
							'Next Match',
							arrowDown,
							'findNext',
							! hasMatches
						) }
						<IconButton
							label="Close"
							icon={ closeSmall }
							variant="minimal"
							tone="neutral"
							size="small"
							onClick={ onClose }
						/>
					</div>
				</div>
				{ replaceOpen && (
					<div className="minidit-search-bar__row">
						<SearchInput
							ref={ replaceRef }
							placeholder="Replace"
							aria-label="Replace"
							value={ options.replace }
							onChange={ ( event ) =>
								onChange( {
									...options,
									replace: event.target.value,
								} )
							}
							onKeyDown={ ( event ) =>
								onKeyDown( event, 'replace' )
							}
						/>
						<div className="minidit-search-bar__actions">
							{ action(
								'Replace',
								replace,
								'replaceNext',
								! hasMatches
							) }
							{ action(
								'Replace All',
								replaceAll,
								'replaceAll',
								! hasMatches
							) }
						</div>
					</div>
				) }
			</div>
		);
	}
);
