/**
 * External dependencies
 */
import { useState } from 'react';

/**
 * WordPress dependencies
 */
import {
	Dialog,
	InputControl,
	SelectControl,
	Stack,
	SwitchControl,
} from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	TAB_WIDTHS,
	type Settings,
} from './settings';
import { useSettings } from './settings-provider';

const isMac = navigator.userAgent.includes( 'Mac' );
const DEFAULT_FONT_NAME = isMac ? 'Menlo' : 'Consolas';

type SelectItem = { value: string; label: string };

type Option< T > = { value: T; label: string };

const TAB_WIDTH_OPTIONS = TAB_WIDTHS.map( ( width ) => ( {
	value: width,
	label: String( width ),
} ) );

const INDENT_OPTIONS: Option< Settings[ 'indentType' ] >[] = [
	{ value: 'tabs', label: 'Tabs' },
	{ value: 'spaces', label: 'Spaces' },
];

const THEME_OPTIONS: Option< Settings[ 'theme' ] >[] = [
	{ value: 'system', label: 'System' },
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
];

type ChoiceProps< T > = {
	label: string;
	options: Option< T >[];
	value: T;
	onChange: ( value: T ) => void;
};

/**
 * A select field for one of a few fixed values.
 *
 * @param props          Field properties.
 * @param props.label    The field label.
 * @param props.options  The choices.
 * @param props.value    The chosen value.
 * @param props.onChange Called with the newly chosen value.
 */
function Choice< T >( { label, options, value, onChange }: ChoiceProps< T > ) {
	const items: SelectItem[] = options.map( ( option ) => ( {
		value: String( option.value ),
		label: option.label,
	} ) );
	return (
		<SelectControl
			label={ label }
			items={ items }
			value={ items.find( ( item ) => item.value === String( value ) ) }
			isItemEqualToValue={ ( item, selected ) =>
				item.value === selected.value
			}
			onValueChange={ ( item ) => {
				const option = options.find(
					( { value: optionValue } ) =>
						String( optionValue ) === item?.value
				);
				if ( option ) {
					onChange( option.value );
				}
			} }
		/>
	);
}

type Props = {
	open: boolean;
	onClose: () => void;
};

/**
 * The settings screen. Changes take effect and are saved immediately.
 *
 * @param props         Dialog properties.
 * @param props.open    Whether the dialog is shown.
 * @param props.onClose Called when the dialog is dismissed.
 */
export function SettingsDialog( { open, onClose }: Props ) {
	const { settings, updateSettings } = useSettings();
	// Kept as typed, so the field can be empty or out of range while
	// editing; only valid sizes are applied.
	const [ fontSize, setFontSize ] = useState( String( settings.fontSize ) );

	return (
		<Dialog.Root
			open={ open }
			onOpenChange={ ( isOpen ) => {
				if ( ! isOpen ) {
					setFontSize( String( settings.fontSize ) );
					onClose();
				}
			} }
		>
			<Dialog.Popup size="small">
				<Dialog.Header>
					<Dialog.Title>Settings</Dialog.Title>
					<Dialog.CloseIconButton />
				</Dialog.Header>
				<Dialog.Content>
					<Stack direction="column" gap="lg">
						<Stack direction="row" gap="md">
							<InputControl
								className="minidit-settings__font-family"
								label="Font"
								placeholder={ DEFAULT_FONT_NAME }
								value={ settings.fontFamily }
								onChange={ ( event ) =>
									updateSettings( {
										fontFamily: event.target.value,
									} )
								}
							/>
							<InputControl
								className="minidit-settings__font-size"
								label="Font Size"
								type="number"
								min={ MIN_FONT_SIZE }
								max={ MAX_FONT_SIZE }
								value={ fontSize }
								onChange={ ( event ) => {
									setFontSize( event.target.value );
									const size = Number( event.target.value );
									if (
										Number.isInteger( size ) &&
										size >= MIN_FONT_SIZE &&
										size <= MAX_FONT_SIZE
									) {
										updateSettings( { fontSize: size } );
									}
								} }
								onBlur={ () =>
									setFontSize( String( settings.fontSize ) )
								}
							/>
						</Stack>
						<Stack direction="row" gap="md">
							<Choice
								label="Tab Width"
								options={ TAB_WIDTH_OPTIONS }
								value={ settings.tabWidth }
								onChange={ ( tabWidth ) =>
									updateSettings( { tabWidth } )
								}
							/>
							<Choice
								label="Indentation"
								options={ INDENT_OPTIONS }
								value={ settings.indentType }
								onChange={ ( indentType ) =>
									updateSettings( { indentType } )
								}
							/>
							<Choice
								label="Theme"
								options={ THEME_OPTIONS }
								value={ settings.theme }
								onChange={ ( theme ) =>
									updateSettings( { theme } )
								}
							/>
						</Stack>
						<SwitchControl
							label="Show Line Numbers"
							checked={ settings.lineNumbers }
							onCheckedChange={ ( lineNumbers ) =>
								updateSettings( { lineNumbers } )
							}
						/>
						<SwitchControl
							label="Show Whitespace"
							checked={ settings.showWhitespace }
							onCheckedChange={ ( showWhitespace ) =>
								updateSettings( { showWhitespace } )
							}
						/>
						<SwitchControl
							label="Check for Updates at Startup"
							checked={ settings.checkForUpdates }
							onCheckedChange={ ( checkForUpdates ) =>
								updateSettings( { checkForUpdates } )
							}
						/>
					</Stack>
				</Dialog.Content>
			</Dialog.Popup>
		</Dialog.Root>
	);
}
