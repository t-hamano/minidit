/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';
import {
	CheckMenuItem,
	Menu,
	PredefinedMenuItem,
	Submenu,
	type MenuItemOptions,
} from '@tauri-apps/api/menu';

/**
 * Internal dependencies
 */
import type { ThemePreference } from '../theme/use-color-scheme';

const isMac = navigator.userAgent.includes( 'Mac' );

export type MenuHandlers = {
	newTab: () => void;
	openFiles: () => void;
	save: () => void;
	saveAs: () => void;
	closeTab: () => void;
	quit: () => void;
	undo: () => void;
	redo: () => void;
	find: () => void;
	replace: () => void;
	findNext: () => void;
	findPrevious: () => void;
	setTheme: ( theme: ThemePreference ) => void;
};

const THEMES: { value: ThemePreference; label: string }[] = [
	{ value: 'system', label: 'System' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
];

/**
 * Builds the menu bar: at the top of the screen on macOS, and inside the
 * window on Windows.
 *
 * Items for features that are not available yet are disabled.
 *
 * @param run   Runs a handler by name. Reads the latest handlers.
 * @param theme The current theme, checked in View > Theme.
 */
async function createAppMenu(
	run: < K extends keyof MenuHandlers >(
		name: K,
		...args: Parameters< MenuHandlers[ K ] >
	) => void,
	theme: ThemePreference
) {
	const item = (
		text: string,
		accelerator: string | undefined,
		action?: () => void
	): MenuItemOptions => ( {
		text,
		accelerator,
		enabled: !! action,
		action,
	} );
	const separator = { item: 'Separator' } as const;

	const themeItems = await Promise.all(
		THEMES.map( ( { value, label } ) =>
			CheckMenuItem.new( {
				id: `theme-${ value }`,
				text: label,
				checked: value === theme,
				action: () => run( 'setTheme', value ),
			} )
		)
	);

	const settings = item( 'Settings…', 'CmdOrCtrl+,' );
	const about = item( 'About Minidit', undefined );

	const appSubmenu = isMac
		? [
				await Submenu.new( {
					text: 'Minidit',
					items: [
						about,
						separator,
						settings,
						separator,
						item( 'Quit Minidit', 'Cmd+Q', () => run( 'quit' ) ),
					],
				} ),
			]
		: [];

	const menu = await Menu.new( {
		items: [
			...appSubmenu,
			await Submenu.new( {
				text: 'File',
				items: [
					item( 'New Tab', 'CmdOrCtrl+N', () => run( 'newTab' ) ),
					item( 'Open…', 'CmdOrCtrl+O', () => run( 'openFiles' ) ),
					separator,
					item( 'Save', 'CmdOrCtrl+S', () => run( 'save' ) ),
					item( 'Save As…', 'CmdOrCtrl+Shift+S', () =>
						run( 'saveAs' )
					),
					separator,
					item( 'Close Tab', 'CmdOrCtrl+W', () => run( 'closeTab' ) ),
					...( isMac
						? []
						: [
								separator,
								settings,
								about,
								separator,
								// Alt+F4 is handled by Windows itself.
								item( 'Exit', undefined, () => run( 'quit' ) ),
							] ),
				],
			} ),
			await Submenu.new( {
				text: 'Edit',
				items: [
					item( 'Undo', 'CmdOrCtrl+Z', () => run( 'undo' ) ),
					item( 'Redo', isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y', () =>
						run( 'redo' )
					),
					separator,
					{ item: 'Cut' },
					{ item: 'Copy' },
					{ item: 'Paste' },
					{ item: 'SelectAll' },
					separator,
					item( 'Find', 'CmdOrCtrl+F', () => run( 'find' ) ),
					item( 'Replace', isMac ? 'Cmd+Alt+F' : 'Ctrl+H', () =>
						run( 'replace' )
					),
					item( 'Find Next', isMac ? 'Cmd+G' : 'F3', () =>
						run( 'findNext' )
					),
					item(
						'Find Previous',
						isMac ? 'Cmd+Shift+G' : 'Shift+F3',
						() => run( 'findPrevious' )
					),
				],
			} ),
			await Submenu.new( {
				text: 'View',
				items: [
					item( 'Zoom In', 'CmdOrCtrl+=' ),
					item( 'Zoom Out', 'CmdOrCtrl+-' ),
					item( 'Reset Zoom', 'CmdOrCtrl+0' ),
					separator,
					item( 'Line Numbers', undefined ),
					item( 'Show Whitespace', undefined ),
					separator,
					await Submenu.new( { text: 'Theme', items: themeItems } ),
				],
			} ),
		],
	} );

	return { menu, themeItems };
}

/**
 * Installs the menu bar and keeps it in sync with the app.
 *
 * @param handlers Commands the menu runs.
 * @param theme    The current theme.
 */
export function useAppMenu( handlers: MenuHandlers, theme: ThemePreference ) {
	const handlersRef = useRef( handlers );
	handlersRef.current = handlers;
	const themeItemsRef = useRef< CheckMenuItem[] >( [] );
	const initialTheme = useRef( theme );

	useEffect( () => {
		let canceled = false;
		createAppMenu(
			( name, ...args ) =>
				// @ts-expect-error The arguments match the handler by name.
				handlersRef.current[ name ]( ...args ),
			initialTheme.current
		)
			.then( async ( { menu, themeItems } ) => {
				if ( canceled ) {
					return;
				}
				themeItemsRef.current = themeItems;
				await menu.setAsAppMenu();
			} )
			.catch( () => {} );
		return () => {
			canceled = true;
		};
	}, [] );

	useEffect( () => {
		themeItemsRef.current.forEach( ( themeItem, index ) => {
			themeItem
				.setChecked( THEMES[ index ].value === theme )
				.catch( () => {} );
		} );
	}, [ theme ] );
}

/**
 * Shows the editor's context menu at the pointer.
 *
 * @param handlers      Commands for items that the OS does not provide.
 * @param handlers.undo Undoes the last edit.
 * @param handlers.redo Redoes the last undone edit.
 */
export async function showEditorContextMenu( handlers: {
	undo: () => void;
	redo: () => void;
} ) {
	const menu = await Menu.new( {
		items: [
			{ text: 'Undo', action: handlers.undo },
			{ text: 'Redo', action: handlers.redo },
			await PredefinedMenuItem.new( { item: 'Separator' } ),
			{ item: 'Cut' },
			{ item: 'Copy' },
			{ item: 'Paste' },
			{ item: 'SelectAll' },
		],
	} );
	await menu.popup();
}
