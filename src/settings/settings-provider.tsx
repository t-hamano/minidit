/**
 * External dependencies
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';

/**
 * Internal dependencies
 */
import {
	initialSettings,
	readSettings,
	writeSettings,
	type Settings,
} from './settings';

type SettingsContextValue = {
	settings: Settings;
	/** Changes some settings; they take effect and are saved right away. */
	updateSettings: ( changes: Partial< Settings > ) => void;
};

const SettingsContext = createContext< SettingsContextValue | null >( null );

/**
 * Loads the settings before showing the app, and saves every change.
 *
 * @param props          Provider properties.
 * @param props.children The app.
 */
export function SettingsProvider( { children }: { children: ReactNode } ) {
	const [ settings, setSettings ] = useState< Settings | null >(
		initialSettings
	);
	const settingsRef = useRef( settings );

	useEffect( () => {
		if ( settingsRef.current ) {
			return;
		}
		readSettings().then( ( loaded ) => {
			settingsRef.current = loaded;
			setSettings( loaded );
		} );
	}, [] );

	const updateSettings = useCallback( ( changes: Partial< Settings > ) => {
		const current = settingsRef.current;
		if ( ! current ) {
			return;
		}
		const next = { ...current, ...changes };
		settingsRef.current = next;
		setSettings( next );
		writeSettings( next );
	}, [] );

	const value = useMemo(
		() => ( settings ? { settings, updateSettings } : null ),
		[ settings, updateSettings ]
	);

	// Shown after the settings load, so the theme doesn't flash.
	if ( ! value ) {
		return null;
	}
	return (
		<SettingsContext.Provider value={ value }>
			{ children }
		</SettingsContext.Provider>
	);
}

export function useSettings(): SettingsContextValue {
	const value = useContext( SettingsContext );
	if ( ! value ) {
		throw new Error( 'useSettings must be used inside SettingsProvider.' );
	}
	return value;
}
