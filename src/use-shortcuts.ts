/**
 * External dependencies
 */
import { useEffect, useRef } from 'react';

/**
 * Internal dependencies
 */
import { tabsStore } from './tabs/store';

/**
 * Keyboard shortcuts that have no menu item: Ctrl+Tab and Ctrl+Shift+Tab
 * switch tabs, on macOS too. The menu bar handles every other shortcut.
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
