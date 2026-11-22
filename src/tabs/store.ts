/**
 * External dependencies
 */
import { useSyncExternalStore } from 'react';
import type { EditorState } from '@codemirror/state';

/**
 * Internal dependencies
 */
import { createEditorState } from '../editor/state';

export const UNTITLED = '(untitled)';

export type Tab = {
	id: number;
	/** `null` for a tab that has never been saved. */
	path: string | null;
	isDirty: boolean;
	/**
	 * The tab's editor state, including its undo history. Kept up to date
	 * on every editor update.
	 */
	editorState: EditorState;
};

type Snapshot = {
	tabs: readonly Tab[];
	activeId: number;
};

type Listener = () => void;

let nextId = 1;

/**
 * Holds the open tabs. Lives outside React so that commands such as the
 * quit handler can read the latest tabs without waiting for a render.
 */
class TabsStore {
	private snapshot: Snapshot;
	private listeners = new Set< Listener >();

	constructor() {
		const tab = this.createTab( '', null );
		this.snapshot = { tabs: [ tab ], activeId: tab.id };
	}

	subscribe = ( listener: Listener ) => {
		this.listeners.add( listener );
		return () => this.listeners.delete( listener );
	};

	getSnapshot = () => this.snapshot;

	getActiveTab(): Tab {
		const { tabs, activeId } = this.snapshot;
		return tabs.find( ( tab ) => tab.id === activeId ) ?? tabs[ 0 ];
	}

	getTab( id: number ): Tab | undefined {
		return this.snapshot.tabs.find( ( tab ) => tab.id === id );
	}

	findByPath( path: string ): Tab | undefined {
		return this.snapshot.tabs.find( ( tab ) => tab.path === path );
	}

	/**
	 * Opens a new tab after the active one and activates it.
	 *
	 * @param text Initial contents.
	 * @param path File path, or `null` for a new file.
	 * @return The new tab.
	 */
	open( text: string, path: string | null ): Tab {
		const tab = this.createTab( text, path );
		const { tabs, activeId } = this.snapshot;
		const index = tabs.findIndex( ( t ) => t.id === activeId );
		const next = [ ...tabs ];
		next.splice( index + 1, 0, tab );
		this.set( { tabs: next, activeId: tab.id } );
		return tab;
	}

	/**
	 * Replaces a tab's contents with a file, keeping its position.
	 *
	 * @param id   The tab to replace.
	 * @param text New contents.
	 * @param path File path.
	 */
	replace( id: number, text: string, path: string ) {
		const tab = this.createTab( text, path );
		this.set( {
			tabs: this.snapshot.tabs.map( ( t ) => ( t.id === id ? tab : t ) ),
			activeId:
				this.snapshot.activeId === id ? tab.id : this.snapshot.activeId,
		} );
	}

	activate( id: number ) {
		if ( this.snapshot.activeId !== id && this.getTab( id ) ) {
			this.set( { ...this.snapshot, activeId: id } );
		}
	}

	/**
	 * Closes a tab. Closing the last tab leaves one empty new tab.
	 *
	 * @param id The tab to close.
	 */
	close( id: number ) {
		const { tabs, activeId } = this.snapshot;
		const index = tabs.findIndex( ( tab ) => tab.id === id );
		if ( index === -1 ) {
			return;
		}
		const rest = tabs.filter( ( tab ) => tab.id !== id );
		if ( rest.length === 0 ) {
			const tab = this.createTab( '', null );
			this.set( { tabs: [ tab ], activeId: tab.id } );
			return;
		}
		const nextActive =
			activeId === id
				? rest[ Math.min( index, rest.length - 1 ) ].id
				: activeId;
		this.set( { tabs: rest, activeId: nextActive } );
	}

	/**
	 * Moves a tab to another position.
	 *
	 * @param id    The tab to move.
	 * @param index Its new index.
	 */
	move( id: number, index: number ) {
		const tabs = [ ...this.snapshot.tabs ];
		const from = tabs.findIndex( ( tab ) => tab.id === id );
		if ( from === -1 || from === index ) {
			return;
		}
		const [ tab ] = tabs.splice( from, 1 );
		tabs.splice( index, 0, tab );
		this.set( { ...this.snapshot, tabs } );
	}

	update( id: number, patch: Partial< Omit< Tab, 'id' > > ) {
		const tab = this.getTab( id );
		if (
			! tab ||
			Object.entries( patch ).every(
				( [ key, value ] ) => tab[ key as keyof Tab ] === value
			)
		) {
			return;
		}
		this.set( {
			...this.snapshot,
			tabs: this.snapshot.tabs.map( ( t ) =>
				t.id === id ? { ...t, ...patch } : t
			),
		} );
	}

	private createTab( text: string, path: string | null ): Tab {
		const id = nextId++;
		return {
			id,
			path,
			isDirty: false,
			editorState: createEditorState( text, ( state, docChanged ) => {
				// Mutated in place: the editor view already shows this state,
				// so listeners need no notification.
				const current = this.getTab( id );
				if ( current ) {
					current.editorState = state;
				}
				if ( docChanged ) {
					this.update( id, { isDirty: true } );
				}
			} ),
		};
	}

	private set( snapshot: Snapshot ) {
		this.snapshot = snapshot;
		this.listeners.forEach( ( listener ) => listener() );
	}
}

export const tabsStore = new TabsStore();

export function useTabs(): Snapshot {
	return useSyncExternalStore( tabsStore.subscribe, tabsStore.getSnapshot );
}

export function tabTitle( tab: Tab ): string {
	return tab.path ? fileNameOf( tab.path ) : UNTITLED;
}

export function fileNameOf( path: string ): string {
	return path.split( /[\\/]/ ).pop() ?? path;
}

/**
 * Whether a tab is a new, empty, unedited tab that opening a file may
 * replace.
 *
 * @param tab The tab.
 */
export function isBlank( tab: Tab ): boolean {
	return (
		tab.path === null && ! tab.isDirty && tab.editorState.doc.length === 0
	);
}
