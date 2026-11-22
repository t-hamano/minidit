/**
 * External dependencies
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * WordPress dependencies
 */
import {
	Dialog,
	InputControl,
	SearchableSelectControl,
	SelectControl,
	Stack,
	SwitchControl,
	Text,
} from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	listFonts,
	MAX_FONT_SIZE,
	MIN_FONT_SIZE,
	TAB_WIDTHS,
	type Settings,
} from './settings';
import { useSettings } from './settings-provider';

const isMac = navigator.userAgent.includes( 'Mac' );
const DEFAULT_FONT_LABEL = `Default (${ isMac ? 'Menlo' : 'Consolas' })`;

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
	description?: string;
	options: Option< T >[];
	value: T;
	onChange: ( value: T ) => void;
};

/**
 * A select field for one of a few fixed values.
 *
 * @param props             Field properties.
 * @param props.label       The field label.
 * @param props.description Optional text shown under the field.
 * @param props.options     The choices.
 * @param props.value       The chosen value.
 * @param props.onChange    Called with the newly chosen value.
 */
function Choice< T >( {
	label,
	description,
	options,
	value,
	onChange,
}: ChoiceProps< T > ) {
	const items: SelectItem[] = options.map( ( option ) => ( {
		value: String( option.value ),
		label: option.label,
	} ) );
	return (
		<SelectControl
			label={ label }
			description={ description }
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

/**
 * A titled group of settings, one setting per row.
 *
 * @param props          Section properties.
 * @param props.title    The heading.
 * @param props.children The settings.
 */
function Section( {
	title,
	children,
}: {
	title: string;
	children: ReactNode;
} ) {
	return (
		<section>
			<Stack direction="column" gap="lg">
				<Text variant="heading-md" render={ <h3 /> }>
					{ title }
				</Text>
				{ children }
			</Stack>
		</section>
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
	const [ fonts, setFonts ] = useState< string[] >( [] );

	useEffect( () => {
		if ( open ) {
			listFonts().then( setFonts );
		}
	}, [ open ] );

	const fontItems = useMemo( () => {
		const names = fonts.includes( settings.fontFamily )
			? fonts
			: // Keep a font that is no longer installed selectable.
				[ settings.fontFamily, ...fonts ].filter( Boolean );
		return [
			{ value: '', label: DEFAULT_FONT_LABEL },
			...names.map( ( name ) => ( { value: name, label: name } ) ),
		];
	}, [ fonts, settings.fontFamily ] );

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
					<Stack direction="column" gap="2xl">
						<Section title="General">
							<Choice
								label="Theme"
								options={ THEME_OPTIONS }
								value={ settings.theme }
								onChange={ ( theme ) =>
									updateSettings( { theme } )
								}
							/>
							<SwitchControl
								label="Check for Updates at Startup"
								checked={ settings.checkForUpdates }
								onCheckedChange={ ( checkForUpdates ) =>
									updateSettings( { checkForUpdates } )
								}
							/>
						</Section>
						<Section title="Editor Settings">
							<SearchableSelectControl
								label="Font"
								description="Lists the fonts installed on your computer."
								items={ fontItems }
								value={
									fontItems.find(
										( item ) =>
											item.value === settings.fontFamily
									) ?? fontItems[ 0 ]
								}
								isItemEqualToValue={ ( item, selected ) =>
									item.value === selected.value
								}
								onValueChange={ ( item ) =>
									updateSettings( {
										fontFamily: item?.value ?? '',
									} )
								}
							/>
							<InputControl
								label="Font Size"
								description="Size in pixels."
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
							<Choice
								label="Tab Width"
								description="Width of tab characters and of each indentation level. Opened files indented with spaces use their own width instead."
								options={ TAB_WIDTH_OPTIONS }
								value={ settings.tabWidth }
								onChange={ ( tabWidth ) =>
									updateSettings( { tabWidth } )
								}
							/>
							<Choice
								label="Indentation"
								description="Used for new files. Opened files keep the indentation they already use."
								options={ INDENT_OPTIONS }
								value={ settings.indentType }
								onChange={ ( indentType ) =>
									updateSettings( { indentType } )
								}
							/>
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
						</Section>
					</Stack>
				</Dialog.Content>
			</Dialog.Popup>
		</Dialog.Root>
	);
}
