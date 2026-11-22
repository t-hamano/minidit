/**
 * External dependencies
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';

/**
 * Internal dependencies
 */
import type { Encoding, TextFormat } from './text-format';

const FILTERS = [
	{ name: 'Text Files', extensions: [ 'txt', 'md' ] },
	{ name: 'All Files', extensions: [ '*' ] },
];

export type OpenedFile = TextFormat & {
	/** The text with LF line endings. */
	text: string;
	/** Whether some bytes could not be decoded and were replaced. */
	hadErrors: boolean;
};

/**
 * Thrown when saving fails. `unrepresentable` means the text has characters
 * that the encoding cannot represent.
 */
export type SaveError =
	{ kind: 'unrepresentable' } | { kind: 'io'; message: string };

/**
 * Reads a text file.
 *
 * @param path     The file.
 * @param encoding The encoding to use; detected when omitted.
 */
export function readTextFile(
	path: string,
	encoding?: Encoding
): Promise< OpenedFile > {
	return invoke( 'read_text_file', { path, encoding } );
}

/**
 * Saves text to a file.
 *
 * @param  path     The file.
 * @param  contents The text with LF line endings.
 * @param  format   The encoding and line ending to save with.
 * @throws {SaveError} When saving fails.
 */
export function writeTextFile(
	path: string,
	contents: string,
	format: TextFormat
): Promise< void > {
	return invoke( 'write_text_file', {
		path,
		contents,
		encoding: format.encoding,
		lineEnding: format.lineEnding,
	} );
}

/**
 * Shows the OS open dialog, which allows selecting several files.
 *
 * @return The chosen paths; empty when canceled.
 */
export async function pickFilesToOpen(): Promise< string[] > {
	const paths = await open( {
		multiple: true,
		directory: false,
		filters: FILTERS,
	} );
	return paths ?? [];
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

/**
 * A file that another app changed or deleted.
 */
export type FileChange = {
	path: string;
	deleted: boolean;
};

/**
 * Watches exactly the given files for changes by other apps.
 *
 * @param paths The open files.
 */
export function watchFiles( paths: string[] ): Promise< void > {
	return invoke( 'watch_files', { paths } );
}

/**
 * Tells the app that the window is ready to open files.
 *
 * @return The files waiting to open, such as those named on the command
 *         line.
 */
export function takePendingFiles(): Promise< string[] > {
	return invoke( 'take_pending_files' );
}

/**
 * Listens for files that the OS asks the running app to open.
 *
 * @param callback Receives the files.
 * @return Stops listening.
 */
export function onOpenFiles(
	callback: ( paths: string[] ) => void
): Promise< UnlistenFn > {
	return listen< string[] >( 'open-files', ( event ) =>
		callback( event.payload )
	);
}

/**
 * Listens for changes to the watched files by other apps.
 *
 * @param callback Receives each change.
 * @return Stops listening.
 */
export function onFileChanged(
	callback: ( change: FileChange ) => void
): Promise< UnlistenFn > {
	return listen< FileChange >( 'file-changed', ( event ) =>
		callback( event.payload )
	);
}
