/**
 * External dependencies
 */
import { invoke } from '@tauri-apps/api/core';

/**
 * Internal dependencies
 */
import type { ThemePreference } from '../theme/use-color-scheme';

export type IndentType = 'tabs' | 'spaces';
export type TabWidth = 2 | 4 | 8;

export type Settings = {
	/** Font name; empty for the default font. */
	fontFamily: string;
	/** Font size in pixels. */
	fontSize: number;
	tabWidth: TabWidth;
	/** Indentation for new tabs, and when it can't be detected. */
	indentType: IndentType;
	theme: ThemePreference;
	lineNumbers: boolean;
	showWhitespace: boolean;
	checkForUpdates: boolean;
	/** Zoom level in percent, shared by all tabs. */
	zoom: number;
};

export const MIN_ZOOM = 50;
export const MAX_ZOOM = 300;
export const ZOOM_STEP = 10;

/**
 * Steps the zoom level, staying within its range.
 *
 * @param zoom      The current zoom level in percent.
 * @param direction `1` to zoom in, `-1` to zoom out.
 */
export function stepZoom( zoom: number, direction: 1 | -1 ) {
	return Math.min(
		MAX_ZOOM,
		Math.max( MIN_ZOOM, zoom + direction * ZOOM_STEP )
	);
}

export const MIN_FONT_SIZE = 6;
export const MAX_FONT_SIZE = 72;
export const TAB_WIDTHS: readonly TabWidth[] = [ 2, 4, 8 ];

export const DEFAULT_SETTINGS: Settings = {
	fontFamily: '',
	fontSize: 14,
	tabWidth: 4,
	indentType: 'tabs',
	theme: 'system',
	lineNumbers: false,
	showWhitespace: false,
	checkForUpdates: true,
	zoom: 100,
};

const isOneOf = < T >( value: unknown, options: readonly T[] ): value is T =>
	options.includes( value as T );

const isNumberIn = ( value: unknown, min: number, max: number ) =>
	typeof value === 'number' &&
	Number.isFinite( value ) &&
	value >= min &&
	value <= max;

/**
 * Checks values read from the settings file. Each missing or invalid value
 * falls back to its default.
 *
 * @param raw The parsed settings file.
 */
export function sanitizeSettings( raw: Record< string, unknown > ): Settings {
	const d = DEFAULT_SETTINGS;
	const bool = ( value: unknown, fallback: boolean ) =>
		typeof value === 'boolean' ? value : fallback;
	return {
		fontFamily:
			typeof raw.fontFamily === 'string'
				? raw.fontFamily.trim()
				: d.fontFamily,
		fontSize: isNumberIn( raw.fontSize, MIN_FONT_SIZE, MAX_FONT_SIZE )
			? Math.round( raw.fontSize as number )
			: d.fontSize,
		tabWidth: isOneOf( raw.tabWidth, TAB_WIDTHS )
			? raw.tabWidth
			: d.tabWidth,
		indentType: isOneOf( raw.indentType, [ 'tabs', 'spaces' ] as const )
			? raw.indentType
			: d.indentType,
		theme: isOneOf( raw.theme, [ 'system', 'light', 'dark' ] as const )
			? raw.theme
			: d.theme,
		lineNumbers: bool( raw.lineNumbers, d.lineNumbers ),
		showWhitespace: bool( raw.showWhitespace, d.showWhitespace ),
		checkForUpdates: bool( raw.checkForUpdates, d.checkForUpdates ),
		zoom:
			isNumberIn( raw.zoom, MIN_ZOOM, MAX_ZOOM ) &&
			( raw.zoom as number ) % ZOOM_STEP === 0
				? ( raw.zoom as number )
				: d.zoom,
	};
}

export async function readSettings(): Promise< Settings > {
	try {
		return sanitizeSettings(
			( await invoke< Record< string, unknown > >( 'read_settings' ) ) ??
				{}
		);
	} catch {
		return DEFAULT_SETTINGS;
	}
}

let pendingWrite = Promise.resolve();

/**
 * Saves the settings. Writes run one at a time, so the last change is
 * saved last.
 *
 * @param settings The settings to save.
 */
export function writeSettings( settings: Settings ) {
	pendingWrite = pendingWrite
		.then( () => invoke< void >( 'write_settings', { settings } ) )
		.catch( () => {} );
}

/** Resolves once every change so far has been saved. */
export function flushSettings(): Promise< void > {
	return pendingWrite;
}

/** Saves the window's position and size for the next launch. */
export function saveWindowState(): Promise< void > {
	return invoke( 'save_window_state' );
}

let fontList: Promise< string[] > | null = null;

/** The installed font families. Read once, when first needed. */
export function listFonts(): Promise< string[] > {
	fontList ??= invoke< string[] >( 'list_fonts' ).catch( () => {
		fontList = null;
		return [];
	} );
	return fontList;
}
