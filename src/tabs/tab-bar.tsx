/**
 * External dependencies
 */
import { useState, type DragEvent } from 'react';
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { closeSmall, plus } from '@wordpress/icons';
import { IconButton, Tooltip } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { tabsStore, tabTitle, useTabs, type Tab } from './store';

type Props = {
	onNewTab: () => void;
	onFocusEditor: () => void;
	onCloseTab: ( id: number ) => void;
};

const DRAG_TYPE = 'application/x-minidit-tab';

export function TabBar( { onNewTab, onCloseTab, onFocusEditor }: Props ) {
	const { tabs, activeId } = useTabs();
	const [ dropIndex, setDropIndex ] = useState< number | null >( null );

	const onDragOver = ( event: DragEvent, index: number ) => {
		if ( ! event.dataTransfer.types.includes( DRAG_TYPE ) ) {
			return;
		}
		event.preventDefault();
		const { left, width } = event.currentTarget.getBoundingClientRect();
		setDropIndex( event.clientX < left + width / 2 ? index : index + 1 );
	};

	const onDrop = ( event: DragEvent ) => {
		const id = Number( event.dataTransfer.getData( DRAG_TYPE ) );
		const from = tabs.findIndex( ( tab ) => tab.id === id );
		if ( from !== -1 && dropIndex !== null ) {
			event.preventDefault();
			tabsStore.move( id, dropIndex > from ? dropIndex - 1 : dropIndex );
		}
		setDropIndex( null );
	};

	return (
		<div className="minidit-tab-bar">
			<div
				className="minidit-tab-bar__tabs"
				onDrop={ onDrop }
				onDragLeave={ ( event ) => {
					if (
						! event.currentTarget.contains(
							event.relatedTarget as Node | null
						)
					) {
						setDropIndex( null );
					}
				} }
			>
				<div
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
							onDragOver={ ( event ) =>
								onDragOver( event, index )
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
	onDragOver: ( event: DragEvent ) => void;
};

function TabItem( {
	tab,
	onFocusEditor,
	isActive,
	dropSide,
	onClose,
	onDragOver,
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
			draggable
			onDragStart={ ( event ) => {
				event.dataTransfer.setData( DRAG_TYPE, String( tab.id ) );
				event.dataTransfer.effectAllowed = 'move';
			} }
			onDragOver={ onDragOver }
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
						<button
							type="button"
							className="minidit-tab__button"
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
				onClick={ onClose }
			/>
		</div>
	);
}
