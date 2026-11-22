/**
 * External dependencies
 */
import { useRef, useState, type PointerEvent } from 'react';
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { closeSmall, plus } from '@wordpress/icons';
import { Button, IconButton, Tooltip } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { tabsStore, tabTitle, useTabs, type Tab } from './store';

type Props = {
	onNewTab: () => void;
	onFocusEditor: () => void;
	onCloseTab: ( id: number ) => void;
};

/** How far, in pixels, the pointer moves before a tab starts dragging. */
const DRAG_THRESHOLD = 4;

export function TabBar( { onNewTab, onCloseTab, onFocusEditor }: Props ) {
	const { tabs, activeId } = useTabs();
	const [ dropIndex, setDropIndex ] = useState< number | null >( null );
	const listRef = useRef< HTMLDivElement >( null );

	/**
	 * The index that a tab dropped at a horizontal position moves to.
	 *
	 * @param clientX The pointer's position.
	 */
	const dropIndexAt = ( clientX: number ) => {
		const items = Array.from( listRef.current?.children ?? [] );
		const index = items.findIndex( ( item ) => {
			const { left, width } = item.getBoundingClientRect();
			return clientX < left + width / 2;
		} );
		return index === -1 ? items.length : index;
	};

	// Uses pointer events instead of HTML drag and drop, which does not
	// work in the window on Windows while dropping files onto it is
	// enabled.
	const startDrag = ( event: PointerEvent, id: number ) => {
		if ( event.button !== 0 ) {
			return;
		}
		const { ownerDocument } = event.currentTarget;
		const startX = event.clientX;
		let dragging = false;

		const onMove = ( moveEvent: globalThis.PointerEvent ) => {
			if (
				! dragging &&
				Math.abs( moveEvent.clientX - startX ) < DRAG_THRESHOLD
			) {
				return;
			}
			dragging = true;
			setDropIndex( dropIndexAt( moveEvent.clientX ) );
		};
		const onEnd = ( endEvent: globalThis.PointerEvent ) => {
			ownerDocument.removeEventListener( 'pointermove', onMove );
			ownerDocument.removeEventListener( 'pointerup', onEnd );
			ownerDocument.removeEventListener( 'pointercancel', onEnd );
			setDropIndex( null );
			if ( ! dragging || endEvent.type === 'pointercancel' ) {
				return;
			}
			const index = dropIndexAt( endEvent.clientX );
			const from = tabsStore
				.getSnapshot()
				.tabs.findIndex( ( tab ) => tab.id === id );
			if ( from !== -1 ) {
				tabsStore.move( id, index > from ? index - 1 : index );
			}
		};
		ownerDocument.addEventListener( 'pointermove', onMove );
		ownerDocument.addEventListener( 'pointerup', onEnd );
		ownerDocument.addEventListener( 'pointercancel', onEnd );
	};

	return (
		<div className="minidit-tab-bar">
			<div className="minidit-tab-bar__tabs">
				<div
					ref={ listRef }
					className="minidit-tab-bar__list"
					role="tablist"
					aria-label="Open files"
				>
					{ tabs.map( ( tab, index ) => (
						<TabItem
							key={ tab.id }
							tab={ tab }
							onFocusEditor={ onFocusEditor }
							isActive={ tab.id === activeId }
							dropSide={
								// eslint-disable-next-line no-nested-ternary
								dropIndex === index
									? 'before'
									: dropIndex === index + 1 &&
										  index === tabs.length - 1
										? 'after'
										: undefined
							}
							onClose={ () => onCloseTab( tab.id ) }
							onPointerDown={ ( event ) =>
								startDrag( event, tab.id )
							}
						/>
					) ) }
				</div>
			</div>
			<IconButton
				className="minidit-tab-bar__new"
				label="New Tab"
				icon={ plus }
				variant="minimal"
				tone="neutral"
				size="small"
				onClick={ onNewTab }
			/>
		</div>
	);
}

type TabItemProps = {
	tab: Tab;
	onFocusEditor: () => void;
	isActive: boolean;
	dropSide?: 'before' | 'after';
	onClose: () => void;
	onPointerDown: ( event: PointerEvent ) => void;
};

function TabItem( {
	tab,
	onFocusEditor,
	isActive,
	dropSide,
	onClose,
	onPointerDown,
}: TabItemProps ) {
	const title = tabTitle( tab );
	return (
		// The close button sits on top of the tab button instead of inside it,
		// so that the two buttons are not nested. Mouse handling here covers
		// the whole tab.
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			className={ clsx( 'minidit-tab', {
				'is-active': isActive,
				'is-drop-before': dropSide === 'before',
				'is-drop-after': dropSide === 'after',
			} ) }
			onPointerDown={ onPointerDown }
			onMouseDown={ ( event ) => {
				if ( event.button === 0 ) {
					tabsStore.activate( tab.id );
				}
			} }
			onAuxClick={ ( event ) => {
				if ( event.button === 1 ) {
					onClose();
				}
			} }
		>
			<Tooltip.Root disabled={ ! tab.path }>
				<Tooltip.Trigger
					render={
						<Button
							className="minidit-tab__button"
							variant="minimal"
							tone="neutral"
							size="compact"
							role="tab"
							aria-selected={ isActive }
							tabIndex={ isActive ? 0 : -1 }
							onClick={ ( event ) => {
								tabsStore.activate( tab.id );
								// Return focus to the editor after a mouse click,
								// but keep it on the tab for the keyboard.
								if ( event.detail > 0 ) {
									onFocusEditor();
								}
							} }
						/>
					}
				>
					<span className="minidit-tab__title">{ title }</span>
					{ tab.isDirty && (
						<span
							className="minidit-tab__dirty"
							aria-label="Unsaved changes"
						>
							•
						</span>
					) }
				</Tooltip.Trigger>
				<Tooltip.Popup>{ tab.path }</Tooltip.Popup>
			</Tooltip.Root>
			<IconButton
				className="minidit-tab__close"
				label={ `Close ${ title }` }
				icon={ closeSmall }
				variant="minimal"
				tone="neutral"
				size="small"
				onMouseDown={ ( event ) => event.stopPropagation() }
				onPointerDown={ ( event ) => event.stopPropagation() }
				onClick={ onClose }
			/>
		</div>
	);
}
