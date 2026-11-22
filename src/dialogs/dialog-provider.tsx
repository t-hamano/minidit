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
import { AlertDialog, Dialog } from '@wordpress/ui';

export type MessageOptions = {
	title: string;
	message: string;
};

export type ConfirmOptions = {
	title: string;
	message: string;
	confirmLabel: string;
	/** Defaults to `Cancel`. */
	cancelLabel?: string;
	/** Colors the confirm button as destructive. */
	irreversible?: boolean;
};

type Request =
	| { kind: 'message'; options: MessageOptions; resolve: () => void }
	| {
			kind: 'confirm';
			options: ConfirmOptions;
			resolve: ( confirmed: boolean ) => void;
	  };

type Dialogs = {
	/** Shows a message with a single `OK` button. */
	showMessage: ( options: MessageOptions ) => Promise< void >;
	/**
	 * Asks for confirmation with a cancel and a confirm button.
	 * Resolves to whether the user confirmed.
	 */
	confirm: ( options: ConfirmOptions ) => Promise< boolean >;
};

const DialogContext = createContext< Dialogs | null >( null );

/**
 * Hosts modal dialogs and lets any component show one with `useDialogs()`.
 * Requests made while a dialog is open are queued.
 *
 * @param props          Provider properties.
 * @param props.children The app.
 */
export function DialogProvider( { children }: { children: ReactNode } ) {
	const [ queue, setQueue ] = useState< Request[] >( [] );
	const confirmedRef = useRef( false );
	const current = queue[ 0 ];

	const dialogs = useMemo< Dialogs >(
		() => ( {
			showMessage: ( options ) =>
				new Promise( ( resolve ) =>
					setQueue( ( requests ) => [
						...requests,
						{ kind: 'message', options, resolve },
					] )
				),
			confirm: ( options ) =>
				new Promise( ( resolve ) =>
					setQueue( ( requests ) => [
						...requests,
						{ kind: 'confirm', options, resolve },
					] )
				),
		} ),
		[]
	);

	const close = useCallback( () => {
		if ( ! current ) {
			return;
		}
		if ( current.kind === 'confirm' ) {
			current.resolve( confirmedRef.current );
		} else {
			current.resolve();
		}
		confirmedRef.current = false;
		setQueue( ( requests ) => requests.slice( 1 ) );
	}, [ current ] );

	const onOpenChange = ( open: boolean ) => {
		if ( ! open ) {
			close();
		}
	};

	return (
		<DialogContext.Provider value={ dialogs }>
			{ children }
			{ current?.kind === 'message' && (
				<Dialog.Root
					open
					onOpenChange={ onOpenChange }
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
							<Dialog.Action>OK</Dialog.Action>
						</Dialog.Footer>
					</Dialog.Popup>
				</Dialog.Root>
			) }
			{ current?.kind === 'confirm' && (
				<AlertDialog.Root
					open
					onOpenChange={ onOpenChange }
					onConfirm={ () => {
						confirmedRef.current = true;
					} }
				>
					<AlertDialog.Popup
						intent={
							current.options.irreversible
								? 'irreversible'
								: 'default'
						}
						title={ current.options.title }
						description={ current.options.message }
						cancelButtonText={
							current.options.cancelLabel ?? 'Cancel'
						}
						confirmButtonText={ current.options.confirmLabel }
					/>
				</AlertDialog.Root>
			) }
		</DialogContext.Provider>
	);
}

export function useDialogs(): Dialogs {
	const dialogs = useContext( DialogContext );
	if ( ! dialogs ) {
		throw new Error( 'useDialogs must be used inside DialogProvider.' );
	}
	return dialogs;
}

/**
 * Shows an error message with a single `OK` button.
 *
 * @param dialogs The value of `useDialogs()`.
 * @param title   Short summary of what failed.
 * @param error   The error; its message is shown.
 */
export function showError(
	dialogs: Dialogs,
	title: string,
	error: unknown
): Promise< void > {
	return dialogs.showMessage( {
		title,
		message: error instanceof Error ? error.message : String( error ),
	} );
}
