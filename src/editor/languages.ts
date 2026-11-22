/**
 * External dependencies
 */
import { StreamLanguage, type Language } from '@codemirror/language';

type Loader = () => Promise< Language >;

const legacy = ( parser: Parameters< typeof StreamLanguage.define >[ 0 ] ) =>
	StreamLanguage.define( parser );

/**
 * Languages by file extension. Each language's parser is a separate chunk,
 * loaded the first time a file needs it.
 *
 * Only the parsers are used, without the packages' autocompletion,
 * bracket closing, or tag closing.
 */
const LOADERS: Record< string, Loader > = {};
const loaded = new Map< string, Language >();

function register( extensions: string[], loader: Loader ) {
	let promise: Promise< Language > | null = null;
	const cached = () => {
		promise ??= loader().then(
			( language ) => {
				extensions.forEach( ( extension ) =>
					loaded.set( extension, language )
				);
				return language;
			},
			( error ) => {
				promise = null;
				throw error;
			}
		);
		return promise;
	};
	extensions.forEach( ( extension ) => {
		LOADERS[ extension ] = cached;
	} );
}

register(
	[ 'js', 'mjs', 'cjs' ],
	async () =>
		( await import( '@codemirror/lang-javascript' ) ).javascriptLanguage
);
register(
	[ 'jsx' ],
	async () => ( await import( '@codemirror/lang-javascript' ) ).jsxLanguage
);
register(
	[ 'ts', 'mts', 'cts' ],
	async () =>
		( await import( '@codemirror/lang-javascript' ) ).typescriptLanguage
);
register(
	[ 'tsx' ],
	async () => ( await import( '@codemirror/lang-javascript' ) ).tsxLanguage
);
register(
	[ 'json' ],
	async () => ( await import( '@codemirror/lang-json' ) ).jsonLanguage
);
register(
	[ 'html', 'htm' ],
	async () => ( await import( '@codemirror/lang-html' ) ).htmlLanguage
);
register(
	[ 'css' ],
	async () => ( await import( '@codemirror/lang-css' ) ).cssLanguage
);
register(
	[ 'scss' ],
	async () => ( await import( '@codemirror/lang-sass' ) ).sassLanguage
);
register(
	[ 'md', 'markdown' ],
	async () => ( await import( '@codemirror/lang-markdown' ) ).markdownLanguage
);
register(
	[ 'xml', 'svg' ],
	async () => ( await import( '@codemirror/lang-xml' ) ).xmlLanguage
);
register(
	[ 'yml', 'yaml' ],
	async () => ( await import( '@codemirror/lang-yaml' ) ).yamlLanguage
);
register( [ 'toml' ], async () =>
	legacy( ( await import( '@codemirror/legacy-modes/mode/toml' ) ).toml )
);
register(
	[ 'py' ],
	async () => ( await import( '@codemirror/lang-python' ) ).pythonLanguage
);
register(
	[ 'php' ],
	async () => ( await import( '@codemirror/lang-php' ) ).phpLanguage
);
register( [ 'rb' ], async () =>
	legacy( ( await import( '@codemirror/legacy-modes/mode/ruby' ) ).ruby )
);
register(
	[ 'java' ],
	async () => ( await import( '@codemirror/lang-java' ) ).javaLanguage
);
register(
	[ 'c', 'h', 'cpp', 'hpp', 'cc' ],
	async () => ( await import( '@codemirror/lang-cpp' ) ).cppLanguage
);
register( [ 'cs' ], async () =>
	legacy( ( await import( '@codemirror/legacy-modes/mode/clike' ) ).csharp )
);
register(
	[ 'go' ],
	async () => ( await import( '@codemirror/lang-go' ) ).goLanguage
);
register(
	[ 'rs' ],
	async () => ( await import( '@codemirror/lang-rust' ) ).rustLanguage
);
register( [ 'sh', 'bash', 'zsh' ], async () =>
	legacy( ( await import( '@codemirror/legacy-modes/mode/shell' ) ).shell )
);
register( [ 'ps1' ], async () =>
	legacy(
		( await import( '@codemirror/legacy-modes/mode/powershell' ) )
			.powerShell
	)
);
register(
	[ 'sql' ],
	async () => ( await import( '@codemirror/lang-sql' ) ).StandardSQL.language
);

/**
 * The lowercase extension of a file path, without the dot.
 *
 * @param path The file path.
 */
export function extensionOf( path: string ): string {
	const name = path.split( /[\\/]/ ).pop() ?? '';
	const dot = name.lastIndexOf( '.' );
	return dot > 0 ? name.slice( dot + 1 ).toLowerCase() : '';
}

/**
 * Loads the language for a file, or resolves to `null` for files that
 * aren't highlighted, such as `.txt` files and new tabs.
 *
 * @param path The file path, or `null` for a new tab.
 */
export function loadLanguage(
	path: string | null
): Promise< Language | null > {
	const loader = path ? LOADERS[ extensionOf( path ) ] : undefined;
	return loader ? loader().catch( () => null ) : Promise.resolve( null );
}

/**
 * The language for a file if it has already been loaded, so that switching
 * tabs shows the colors right away.
 *
 * @param path The file path, or `null` for a new tab.
 */
export function loadedLanguage( path: string | null ): Language | null {
	return ( path && loaded.get( extensionOf( path ) ) ) || null;
}
