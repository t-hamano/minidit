/**
 * External dependencies
 */
import { useEffect, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * WordPress dependencies
 */
import { Button, Dialog, Link, Notice, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import appIcon from '../../src-tauri/icons/128x128@2x.png';
import { checkForUpdate, type Update } from '../updater/updater';

const REPOSITORY_URL = 'https://github.com/t-hamano/minidit';

type Status =
	| { kind: 'idle' }
	| { kind: 'checking' }
	| { kind: 'up-to-date' }
	| { kind: 'error'; message: string };

type Props = {
	open: boolean;
	onClose: () => void;
	/** Asks to install an update that a check found. */
	onUpdateFound: ( update: Update ) => void;
};

export function AboutDialog( { open, onClose, onUpdateFound }: Props ) {
	const [ version, setVersion ] = useState( '' );
	const [ status, setStatus ] = useState< Status >( { kind: 'idle' } );

	useEffect( () => {
		getVersion()
			.then( setVersion )
			.catch( () => {} );
	}, [] );

	useEffect( () => {
		if ( ! open ) {
			setStatus( { kind: 'idle' } );
		}
	}, [ open ] );

	const onCheck = async () => {
		setStatus( { kind: 'checking' } );
		try {
			const update = await checkForUpdate();
			if ( update ) {
				onClose();
				onUpdateFound( update );
			} else {
				setStatus( { kind: 'up-to-date' } );
			}
		} catch ( error ) {
			setStatus( { kind: 'error', message: String( error ) } );
		}
	};

	return (
		<Dialog.Root
			open={ open }
			onOpenChange={ ( isOpen ) => {
				if ( ! isOpen ) {
					onClose();
				}
			} }
		>
			<Dialog.Popup size="small">
				<Dialog.Header>
					<Dialog.Title>About Minidit</Dialog.Title>
					<Dialog.CloseIconButton />
				</Dialog.Header>
				<Dialog.Content>
					<Stack direction="column" align="stretch" gap="2xl">
						<Stack direction="column" align="center" gap="sm">
							<img
								src={ appIcon }
								alt=""
								width={ 96 }
								height={ 96 }
							/>
							<Text variant="heading-xl">Minidit</Text>
							{ version && <Text>Version { version }</Text> }
							<Text>Licensed under GPL-2.0-or-later</Text>
							<Link
								href={ REPOSITORY_URL }
								onClick={ ( event ) => {
									event.preventDefault();
									openUrl( REPOSITORY_URL ).catch( () => {} );
								} }
							>
								GitHub Repository
							</Link>
						</Stack>
						<Stack direction="column" align="center">
							<Button
								variant="outline"
								loading={ status.kind === 'checking' }
								loadingAnnouncement="Checking for updates"
								disabled={ status.kind === 'checking' }
								onClick={ onCheck }
							>
								Check for Updates
							</Button>
						</Stack>
						{ status.kind === 'up-to-date' && (
							<Notice.Root intent="success">
								<Notice.Description>
									You&apos;re up to date.
								</Notice.Description>
							</Notice.Root>
						) }
						{ status.kind === 'error' && (
							<Notice.Root intent="error">
								<Notice.Description className="minidit-about__error">
									Couldn&apos;t check for updates:{ ' ' }
									{ status.message }
								</Notice.Description>
							</Notice.Root>
						) }
					</Stack>
				</Dialog.Content>
			</Dialog.Popup>
		</Dialog.Root>
	);
}
