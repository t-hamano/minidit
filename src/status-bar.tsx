/**
 * WordPress dependencies
 */
import { Button, Menu } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	ENCODING_LABELS,
	ENCODINGS,
	LINE_ENDING_LABELS,
	LINE_ENDINGS,
	type LineEnding,
} from './files/text-format';
import { DEFAULT_SETTINGS, MAX_ZOOM, MIN_ZOOM } from './settings/settings';
import type { Tab } from './tabs/store';
import type { TabCommands } from './tabs/use-tab-commands';

type Props = {
	tab: Tab;
	commands: TabCommands;
	/** Zoom level in percent. */
	zoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetZoom: () => void;
};

const isMac = navigator.userAgent.includes( 'Mac' );

/**
 * Builds the shortcut shown in a menu item for Cmd (macOS) or Ctrl plus a key,
 * matching the accelerators in the View menu.
 *
 * @param key      The key, as shown on screen.
 * @param keyLabel The key's name, read by screen readers.
 */
function zoomShortcut( key: string, keyLabel: string ) {
	return isMac
		? {
				displayShortcut: `⌘${ key }`,
				ariaKeyShortcut: `Meta+${ key }`,
				label: `Command ${ keyLabel }`,
			}
		: {
				displayShortcut: `Ctrl+${ key }`,
				ariaKeyShortcut: `Control+${ key }`,
				label: `Control ${ keyLabel }`,
			};
}

const ZOOM_IN_SHORTCUT = zoomShortcut( '=', 'Equals' );
const ZOOM_OUT_SHORTCUT = zoomShortcut( '-', 'Minus' );
const RESET_ZOOM_SHORTCUT = zoomShortcut( '0', '0' );

const triggerButton = (
	<Button
		className="minidit-status-bar__menu-trigger"
		variant="minimal"
		tone="neutral"
		size="small"
	/>
);

/**
 * Shows the zoom level, encoding, and line ending of the active tab.
 *
 * @param props             Component properties.
 * @param props.tab         The active tab.
 * @param props.commands    File and tab operations.
 * @param props.zoom        Zoom level in percent.
 * @param props.onZoomIn    Steps the zoom level up.
 * @param props.onZoomOut   Steps the zoom level down.
 * @param props.onResetZoom Resets the zoom level.
 */
export function StatusBar( {
	tab,
	commands,
	zoom,
	onZoomIn,
	onZoomOut,
	onResetZoom,
}: Props ) {
	return (
		<footer className="minidit-status-bar">
			<Menu.Root>
				<Menu.Trigger
					render={ triggerButton }
					aria-label={ `Zoom: ${ zoom }%` }
				>
					{ zoom }%
				</Menu.Trigger>
				<Menu.Popup>
					{ /* Stays open so the zoom level can be stepped repeatedly. */ }
					<Menu.Item
						onClick={ onZoomIn }
						shortcut={ ZOOM_IN_SHORTCUT }
						disabled={ zoom >= MAX_ZOOM }
						closeOnClick={ false }
					>
						<Menu.ItemLabel>Zoom In</Menu.ItemLabel>
					</Menu.Item>
					<Menu.Item
						onClick={ onZoomOut }
						shortcut={ ZOOM_OUT_SHORTCUT }
						disabled={ zoom <= MIN_ZOOM }
						closeOnClick={ false }
					>
						<Menu.ItemLabel>Zoom Out</Menu.ItemLabel>
					</Menu.Item>
					<Menu.Item
						onClick={ onResetZoom }
						shortcut={ RESET_ZOOM_SHORTCUT }
						disabled={ zoom === DEFAULT_SETTINGS.zoom }
					>
						<Menu.ItemLabel>Reset Zoom</Menu.ItemLabel>
					</Menu.Item>
				</Menu.Popup>
			</Menu.Root>
			<Menu.Root>
				<Menu.Trigger
					render={ triggerButton }
					aria-label={ `Encoding: ${ ENCODING_LABELS[ tab.encoding ] }` }
				>
					{ ENCODING_LABELS[ tab.encoding ] }
				</Menu.Trigger>
				<Menu.Popup>
					<Menu.SubmenuRoot>
						<Menu.SubmenuTrigger disabled={ ! tab.path }>
							<Menu.ItemLabel>
								Reopen with Encoding
							</Menu.ItemLabel>
						</Menu.SubmenuTrigger>
						<Menu.Popup>
							{ ENCODINGS.map( ( encoding ) => (
								<Menu.Item
									key={ encoding }
									onClick={ () =>
										commands.reopenWithEncoding( encoding )
									}
								>
									<Menu.ItemLabel>
										{ ENCODING_LABELS[ encoding ] }
									</Menu.ItemLabel>
								</Menu.Item>
							) ) }
						</Menu.Popup>
					</Menu.SubmenuRoot>
					<Menu.SubmenuRoot>
						<Menu.SubmenuTrigger>
							<Menu.ItemLabel>Save with Encoding</Menu.ItemLabel>
						</Menu.SubmenuTrigger>
						<Menu.Popup>
							{ ENCODINGS.map( ( encoding ) => (
								<Menu.Item
									key={ encoding }
									onClick={ () =>
										commands.saveWithEncoding( encoding )
									}
								>
									<Menu.ItemLabel>
										{ ENCODING_LABELS[ encoding ] }
									</Menu.ItemLabel>
								</Menu.Item>
							) ) }
						</Menu.Popup>
					</Menu.SubmenuRoot>
				</Menu.Popup>
			</Menu.Root>
			<Menu.Root>
				<Menu.Trigger
					render={ triggerButton }
					aria-label={ `Line ending: ${
						LINE_ENDING_LABELS[ tab.lineEnding ]
					}` }
				>
					{ LINE_ENDING_LABELS[ tab.lineEnding ] }
				</Menu.Trigger>
				<Menu.Popup>
					<Menu.RadioGroup
						value={ tab.lineEnding }
						onValueChange={ ( value: LineEnding ) =>
							commands.setLineEnding( value )
						}
					>
						{ LINE_ENDINGS.map( ( lineEnding ) => (
							<Menu.RadioItem
								key={ lineEnding }
								value={ lineEnding }
								closeOnClick
							>
								<Menu.ItemLabel>
									{ LINE_ENDING_LABELS[ lineEnding ] }
								</Menu.ItemLabel>
							</Menu.RadioItem>
						) ) }
					</Menu.RadioGroup>
				</Menu.Popup>
			</Menu.Root>
		</footer>
	);
}
