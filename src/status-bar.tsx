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
import type { Tab } from './tabs/store';
import type { TabCommands } from './tabs/use-tab-commands';

type Props = {
	tab: Tab;
	commands: TabCommands;
};

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
 * @param props          Component properties.
 * @param props.tab      The active tab.
 * @param props.commands File and tab operations.
 */
export function StatusBar( { tab, commands }: Props ) {
	return (
		<footer className="minidit-status-bar">
			<span className="minidit-status-bar__item">100%</span>
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
