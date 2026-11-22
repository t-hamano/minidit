/**
 * WordPress dependencies
 */
import { ThemeProvider } from '@wordpress/theme';
import { Text } from '@wordpress/ui';

/**
 * Placeholder root component. The editor, tabs, and status bar are added
 * in later phases.
 */
export function App() {
	return (
		<ThemeProvider isRoot>
			<main className="minidit-app">
				<Text>Minidit</Text>
			</main>
		</ThemeProvider>
	);
}
