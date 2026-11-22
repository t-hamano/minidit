/**
 * External dependencies
 */
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Internal dependencies
 */
import { flushSettings, saveWindowState } from '../settings/settings';

export type { Update };

/**
 * Checks GitHub Releases for a newer version.
 *
 * @return The update, or `null` when the app is up to date.
 * @throws {Error} When the check fails, e.g. while offline.
 */
export function checkForUpdate(): Promise< Update | null > {
	return check();
}

/**
 * Downloads and installs an update, then restarts the app.
 *
 * @param update The update to install.
 */
export async function installUpdate( update: Update ) {
	await update.download();
	// The Windows installer quits the app, so save the settings first.
	await flushSettings();
	await saveWindowState().catch( () => {} );
	await update.install();
	await relaunch();
}
