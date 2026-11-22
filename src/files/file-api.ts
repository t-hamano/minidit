/**
 * External dependencies
 */
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

const FILTERS = [
	{ name: 'Text Files', extensions: [ 'txt', 'md' ] },
	{ name: 'All Files', extensions: [ '*' ] },
];

export function readTextFile( path: string ): Promise< string > {
	return invoke( 'read_text_file', { path } );
}

export function writeTextFile(
	path: string,
	contents: string
): Promise< void > {
	return invoke( 'write_text_file', { path, contents } );
}

/**
 * Shows the OS open dialog.
 *
 * @return The chosen path, or `null` when canceled.
 */
export async function pickFileToOpen(): Promise< string | null > {
	const path = await open( {
		multiple: false,
		directory: false,
		filters: FILTERS,
	} );
	return typeof path === 'string' ? path : null;
}

/**
 * Shows the OS save dialog.
 *
 * @param defaultPath Suggested file name or path.
 * @return The chosen path, or `null` when canceled.
 */
export function pickFileToSave(
	defaultPath?: string
): Promise< string | null > {
	return save( { defaultPath, filters: FILTERS } );
}

export function fileNameOf( path: string ): string {
	return path.split( /[\\/]/ ).pop() ?? path;
}
