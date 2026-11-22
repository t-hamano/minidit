/**
 * External dependencies
 */
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Syntax colors from the design tokens, so they follow the light / dark
 * theme.
 */
export const syntaxColors = syntaxHighlighting(
	HighlightStyle.define( [
		{
			tag: [ t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier ],
			color: 'var(--wpds-color-foreground-interactive-brand)',
		},
		{
			tag: [ t.string, t.special( t.string ), t.regexp, t.character ],
			color: 'var(--wpds-color-foreground-content-success)',
		},
		{
			tag: [ t.number, t.bool, t.null, t.atom, t.unit ],
			color: 'var(--wpds-color-foreground-content-caution)',
		},
		{
			tag: [ t.comment, t.meta, t.processingInstruction ],
			color: 'var(--wpds-color-foreground-content-neutral-weak)',
			fontStyle: 'italic',
		},
		{
			tag: [ t.typeName, t.className, t.namespace, t.labelName ],
			color: 'var(--wpds-color-foreground-content-info)',
		},
		{
			tag: [
				t.function( t.variableName ),
				t.function( t.propertyName ),
				t.macroName,
			],
			color: 'var(--wpds-color-foreground-interactive-brand-strong)',
		},
		{
			tag: [ t.tagName, t.heading, t.self ],
			color: 'var(--wpds-color-foreground-content-error)',
		},
		{
			tag: [ t.attributeName, t.propertyName, t.definition( t.name ) ],
			color: 'var(--wpds-color-foreground-content-warning)',
		},
		{ tag: t.heading, fontWeight: 'bold' },
		{ tag: t.strong, fontWeight: 'bold' },
		{ tag: t.emphasis, fontStyle: 'italic' },
		{ tag: t.strikethrough, textDecoration: 'line-through' },
		{
			tag: [ t.link, t.url ],
			color: 'var(--wpds-color-foreground-content-info)',
			textDecoration: 'underline',
		},
		{ tag: t.invalid, color: 'var(--wpds-color-foreground-content-error)' },
	] )
);
