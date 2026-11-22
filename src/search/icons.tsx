/**
 * Icons the WordPress icon library doesn't have, drawn in its style.
 */

const svgProps = {
	xmlns: 'http://www.w3.org/2000/svg',
	viewBox: '0 0 24 24',
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.5,
} as const;

/** A dot and an asterisk, as in `.*`. */
export const regex = (
	<svg { ...svgProps }>
		<path d="M15 5V13M11.54 7L18.46 11M11.54 11L18.46 7" />
		<circle cx="7" cy="17" r="0.75" />
	</svg>
);

/** The "replace" icon with each box stacked on another. */
export const replaceAll = (
	<svg { ...svgProps }>
		<path d="M11 18H15.5C16.6046 18 17.5 17.1046 17.5 16V13.25M15 15.25L17.5 13.25L20 15.25M13 6.25L8.5 6.25C7.39543 6.25 6.5 7.14543 6.5 8.25L6.5 11M9 9L6.5 11L4 9M5 19.25H8C8.69036 19.25 9.25 18.6904 9.25 18V15C9.25 14.3096 8.69036 13.75 8 13.75H5C4.30964 13.75 3.75 14.3096 3.75 15V18C3.75 18.6904 4.30964 19.25 5 19.25ZM16 10.25H19C19.6904 10.25 20.25 9.69036 20.25 9V6C20.25 5.30964 19.6904 4.75 19 4.75H16C15.3096 4.75 14.75 5.30964 14.75 6V9C14.75 9.69036 15.3096 10.25 16 10.25Z" />
		<path d="M5.75 12H10C10.5523 12 11 12.4477 11 13V17.25M16.75 3H21C21.5523 3 22 3.44772 22 4V8.25" />
	</svg>
);
