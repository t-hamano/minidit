export type Encoding =
	'utf-8' | 'utf-8-bom' | 'utf-16-le' | 'utf-16-be' | 'shift-jis';
export type LineEnding = 'crlf' | 'lf';

export type TextFormat = {
	encoding: Encoding;
	lineEnding: LineEnding;
};

export const ENCODINGS: readonly Encoding[] = [
	'utf-8',
	'utf-8-bom',
	'utf-16-le',
	'utf-16-be',
	'shift-jis',
];

export const ENCODING_LABELS: Record< Encoding, string > = {
	'utf-8': 'UTF-8',
	'utf-8-bom': 'UTF-8 with BOM',
	'utf-16-le': 'UTF-16 LE',
	'utf-16-be': 'UTF-16 BE',
	'shift-jis': 'Shift_JIS',
};

export const LINE_ENDINGS: readonly LineEnding[] = [ 'crlf', 'lf' ];

export const LINE_ENDING_LABELS: Record< LineEnding, string > = {
	crlf: 'CRLF',
	lf: 'LF',
};

const isWindows = navigator.userAgent.includes( 'Windows' );

/** The format of a new file: UTF-8 with the OS's line ending. */
export const NEW_FILE_FORMAT: TextFormat = {
	encoding: 'utf-8',
	lineEnding: isWindows ? 'crlf' : 'lf',
};
