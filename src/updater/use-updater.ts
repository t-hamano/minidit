/**
 * External dependencies
 */
import { useCallback, useEffect, useRef } from 'react';

/**
 * Internal dependencies
 */
import { showError, useDialogs } from '../dialogs/dialog-provider';
import { checkForUpdate, installUpdate, type Update } from './updater';

/**
 * Offers updates: once at startup when `checkAtStartup` is set, and on
 * demand with `offerUpdate`.
 *
 * @param checkAtStartup Whether to check for updates at startup.
 * @param confirmQuit    Asks about unsaved changes before restarting.
 * @return Asks to install an update.
 */
export function useUpdater(
	checkAtStartup: boolean,
	confirmQuit: () => Promise< boolean >
) {
	const dialogs = useDialogs();

	const offerUpdate = useCallback(
		async ( update: Update ) => {
			const install = await dialogs.confirm( {
				title: 'An update is available',
				message: `Minidit ${ update.version } is available. You have ${ update.currentVersion }.`,
				confirmLabel: 'Install and Restart',
				cancelLabel: 'Later',
			} );
			if ( ! install || ! ( await confirmQuit() ) ) {
				return;
			}
			try {
				await installUpdate( update );
			} catch ( error ) {
				await showError(
					dialogs,
					"Couldn't install the update",
					error
				);
			}
		},
		[ confirmQuit, dialogs ]
	);

	// Only the setting at startup counts.
	const checkAtStartupRef = useRef( checkAtStartup );
	const offerUpdateRef = useRef( offerUpdate );
	offerUpdateRef.current = offerUpdate;
	useEffect( () => {
		if ( ! checkAtStartupRef.current ) {
			return;
		}
		// Failures are only reported for checks the user asked for.
		checkForUpdate()
			.then( ( update ) => update && offerUpdateRef.current( update ) )
			.catch( () => {} );
	}, [] );

	return offerUpdate;
}
