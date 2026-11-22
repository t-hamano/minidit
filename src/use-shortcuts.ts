/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';

/**
 * Internal dependencies
 */
import type { MenuHandlers } from './menu/app-menu';
import { tabsStore } from './tabs/store';

const isMac = navigator.userAgent.includes( 'Mac' );

type BrowserKeyHandlers = Pick<
	MenuHandlers,
	| 'find'
	| 'replace'
	| 'findNext'
	| 'findPrevious'
	| 'zoomIn'
	| 'zoomOut'
	| 'resetZoom'
>;

/**
 * Finds the command for a key that WebView2 on Windows keeps to itself as a
 * browser shortcut. Such keys reach the page but never the menu bar, so
 * their menu shortcuts do nothing. Matching `event.key` rather than the
 * physical key also lets Ctrl+= work on keyboards where `=` needs Shift,
 * such as Japanese ones.
 *
 * @param event The key event.
 */
function getBrowserKeyCommand(
	event: KeyboardEvent
): keyof BrowserKeyHandlers | null {
	if ( event.altKey || event.metaKey ) {
		return null;
	}
	if ( event.key === 'F3' ) {
		if ( event.ctrlKey ) {
			return null;
		}
		return event.shiftKey ? 'findPrevious' : 'findNext';
	}
	if ( ! event.ctrlKey ) {
		return null;
	}
	switch ( event.key ) {
		case 'f':
		case 'F':
			return event.shiftKey ? null : 'find';
		case 'h':
		case 'H':
			return event.shiftKey ? null : 'replace';
		case '=':
		case '+':
			return 'zoomIn';
		case '-':
			return event.shiftKey ? null : 'zoomOut';
		case '0':
			return event.shiftKey ? null : 'resetZoom';
		default:
			return null;
	}
}

/**
 * Runs the menu commands for the search keys (Ctrl+F, Ctrl+H, F3 and
 * Shift+F3) and the zoom keys on Windows, where WebView2 does not pass these
 * keys on to the menu bar.
 *
 * @param handlers Commands the keys run.
 */
export function useBrowserKeyShortcuts( handlers: BrowserKeyHandlers ) {
	const handlersRef = useRef( handlers );
	handlersRef.current = handlers;

	useEffect( () => {
		if ( isMac ) {
			return;
		}
		const onKeyDown = ( event: KeyboardEvent ) => {
			const command = getBrowserKeyCommand( event );
			if ( command ) {
				// Also keeps the key from reaching the menu bar, in case
				// WebView2 passes it on, so the command runs once.
				event.preventDefault();
				handlersRef.current[ command ]();
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );
}

/**
 * Keyboard shortcuts that have no menu item: Ctrl+Tab and Ctrl+Shift+Tab
 * switch tabs, on macOS too. The menu bar handles every other shortcut,
 * except for those in `useBrowserKeyShortcuts`.
 */
export function useTabSwitchShortcuts() {
	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ) => {
			if (
				event.key === 'Tab' &&
				event.ctrlKey &&
				! event.altKey &&
				! event.metaKey
			) {
				event.preventDefault();
				tabsStore.activateRelative( event.shiftKey ? -1 : 1 );
			}
		};
		window.addEventListener( 'keydown', onKeyDown, true );
		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );
}

/**
 * Scroll distance, in pixels, that makes one zoom step. One notch of a
 * mouse wheel scrolls about this far, while a trackpad sends many small
 * scrolls that add up to it, so the zoom doesn't race.
 */
const WHEEL_ZOOM_DISTANCE = 100;

/** Pixels in one line, for wheels that scroll by lines. */
const WHEEL_LINE_HEIGHT = 40;

/** After this pause, in milliseconds, the scroll distance starts again. */
const WHEEL_ZOOM_RESET_DELAY = 300;

/**
 * Zooms in and out with Ctrl+mouse wheel, and Cmd+mouse wheel on macOS.
 * Scrolling up zooms in and scrolling down zooms out, one step at a time.
 *
 * @param zoomIn  Steps the zoom level up.
 * @param zoomOut Steps the zoom level down.
 */
export function useWheelZoom( zoomIn: () => void, zoomOut: () => void ) {
	const handlersRef = useRef( { zoomIn, zoomOut } );
	useEffect( () => {
		handlersRef.current = { zoomIn, zoomOut };
	}, [ zoomIn, zoomOut ] );

	useEffect( () => {
		let distance = 0;
		let lastTime = 0;
		const onWheel = ( event: WheelEvent ) => {
			if ( ! event.ctrlKey && ! event.metaKey ) {
				return;
			}
			// Keeps the WebView from zooming the whole page.
			event.preventDefault();

			const delta =
				event.deltaMode === WheelEvent.DOM_DELTA_LINE
					? event.deltaY * WHEEL_LINE_HEIGHT
					: event.deltaY;
			if (
				event.timeStamp - lastTime > WHEEL_ZOOM_RESET_DELAY ||
				Math.sign( delta ) !== Math.sign( distance )
			) {
				distance = 0;
			}
			lastTime = event.timeStamp;
			distance += delta;

			// At most one step per scroll, even for a fast flick.
			if ( Math.abs( distance ) >= WHEEL_ZOOM_DISTANCE ) {
				if ( distance < 0 ) {
					handlersRef.current.zoomIn();
				} else {
					handlersRef.current.zoomOut();
				}
				distance = 0;
			}
		};
		window.addEventListener( 'wheel', onWheel, {
			capture: true,
			passive: false,
		} );
		return () =>
			window.removeEventListener( 'wheel', onWheel, { capture: true } );
	}, [] );
}
