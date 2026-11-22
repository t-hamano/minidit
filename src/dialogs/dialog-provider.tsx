/**
 * External dependencies
 */
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';

/**
 * WordPress dependencies
 */
import { Dialog } from '@wordpress/ui';

export type DialogButton< T > = {
	label: string;
	value: T;
	/** The primary button is filled; others are outlined. */
	primary?: boolean;
};

export type DialogOptions< T > = {
	title: string;
	message: string;
	/** Buttons from left to right. */
	buttons: DialogButton< T >[];
	/** Returned when the dialog is dismissed with `Esc`. */
	dismissValue: T;
};

type ShowDialog = < T >( options: DialogOptions< T > ) => Promise< T >;

type Request = {
	options: DialogOptions< unknown >;
	resolve: ( value: unknown ) => void;
};

const DialogContext = createContext< ShowDialog | null >( null );

/**
 * Hosts modal message dialogs and lets any component show one with
 * `useDialog()`. Requests made while a dialog is open are queued.
 *
 * @param props          Provider properties.
 * @param props.children The app.
 */
export function DialogProvider( { children }: { children: ReactNode } ) {
	const [ queue, setQueue ] = useState< Request[] >( [] );
	const resultRef = useRef< { value: unknown } | null >( null );
	const current = queue[ 0 ];

	const showDialog = useCallback< ShowDialog >(
		( options ) =>
			new Promise( ( resolve ) => {
				setQueue( ( requests ) => [
					...requests,
					{
						options: options as DialogOptions< unknown >,
						resolve: resolve as ( value: unknown ) => void,
					},
				] );
			} ),
		[]
	);

	const close = useCallback( () => {
		if ( ! current ) {
			return;
		}
		const value = resultRef.current
			? resultRef.current.value
			: current.options.dismissValue;
		resultRef.current = null;
		current.resolve( value );
		setQueue( ( requests ) => requests.slice( 1 ) );
	}, [ current ] );

	const contextValue = useMemo( () => showDialog, [ showDialog ] );

	return (
		<DialogContext.Provider value={ contextValue }>
			{ children }
			{ current && (
				<Dialog.Root
					open
					onOpenChange={ ( open ) => {
						if ( ! open ) {
							close();
						}
					} }
					disablePointerDismissal
				>
					<Dialog.Popup size="small">
						<Dialog.Header>
							<Dialog.Title>
								{ current.options.title }
							</Dialog.Title>
						</Dialog.Header>
						<Dialog.Content>
							<Dialog.Description>
								{ current.options.message }
							</Dialog.Description>
						</Dialog.Content>
						<Dialog.Footer>
							{ current.options.buttons.map( ( button ) => (
								<Dialog.Action
									key={ button.label }
									variant={
										button.primary ? 'solid' : 'outline'
									}
									onClick={ () => {
										resultRef.current = {
											value: button.value,
										};
									} }
								>
									{ button.label }
								</Dialog.Action>
							) ) }
						</Dialog.Footer>
					</Dialog.Popup>
				</Dialog.Root>
			) }
		</DialogContext.Provider>
	);
}

export function useDialog(): ShowDialog {
	const showDialog = useContext( DialogContext );
	if ( ! showDialog ) {
		throw new Error( 'useDialog must be used inside DialogProvider.' );
	}
	return showDialog;
}

/**
 * Shows an error message with a single `OK` button.
 *
 * @param showDialog The function from `useDialog()`.
 * @param title      Short summary of what failed.
 * @param error      The error; its message is shown.
 */
export function showError(
	showDialog: ShowDialog,
	title: string,
	error: unknown
): Promise< void > {
	return showDialog( {
		title,
		message: error instanceof Error ? error.message : String( error ),
		buttons: [ { label: 'OK', value: undefined, primary: true } ],
		dismissValue: undefined,
	} );
}
