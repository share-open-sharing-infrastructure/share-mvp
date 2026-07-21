<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'link';
	type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm';
	type Hue = 'primary' | 'secondary' | 'accent';

	interface Props
		extends HTMLButtonAttributes,
			Pick<HTMLAnchorAttributes, 'href' | 'target' | 'rel' | 'download'> {
		children: Snippet;
		variant?: Variant;
		size?: Size;
		/** Only affects `variant="primary"`: which color scale the soft fill is drawn
		 * from. Shape, border and text color stay identical across hues — this is for
		 * cases like two side-by-side CTAs that should look the same except for color. */
		color?: Hue;
		/** Zeigt einen Spinner, deaktiviert den Button und setzt aria-busy. */
		loading?: boolean;
		fullWidth?: boolean;
		/** Nur Layout-Klassen (Breite, Abstand, Positionierung) — nie Farben/Rundungen.
		 * Siehe docs/design-system.md */
		class?: string;
	}

	let {
		children,
		variant = 'primary',
		size = 'md',
		color = 'primary',
		loading = false,
		fullWidth = false,
		disabled = false,
		href,
		type = 'button',
		class: className = '',
		...rest
	}: Props = $props();

	const base =
		'transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
	// The pill "box": every variant except `link` gets it. `link` renders inline
	// inside prose (e.g. the register consent line), so it must stay a plain
	// inline element rather than an atomic inline-flex box.
	const box = 'inline-flex items-center justify-center gap-2 rounded-full';

	const variants: Record<Variant, string> = {
		primary: 'border border-tinte-900 text-tinte-900',
		secondary:
			'border border-tinte-300 text-tinte-600 hover:bg-tinte-100 dark:border-tinte-600 dark:text-tinte-300 dark:hover:bg-tinte-800',
		ghost: 'text-tinte-500 hover:text-tinte-700 dark:text-tinte-400 dark:hover:text-tinte-200',
		accent: 'bg-accent text-white hover:bg-accent-600',
		danger: 'bg-danger text-white hover:bg-danger/90',
		link: 'text-primary-600 hover:underline dark:text-primary-400'
	};

	// The soft fill for variant="primary", swappable by hue — border/text stay fixed above.
	const primaryFills: Record<Hue, string> = {
		primary: 'bg-primary-200 hover:bg-primary',
		secondary: 'bg-secondary-200 hover:bg-secondary',
		accent: 'bg-accent-200 hover:bg-accent'
	};

	// font-weight lives here (not in `base`) so each size sets exactly one weight
	// utility — two conflicting font-weight classes in the same string would leave
	// the winner to stylesheet order, not DOM order (same reason `class` overrides
	// can't reliably beat a variant's color, see docs/design-system.md).
	const sizes: Record<Size, string> = {
		sm: 'px-3 py-1.5 text-xs font-semibold',
		md: 'px-4 py-2 text-sm font-semibold',
		lg: 'px-6 py-2.5 text-base font-semibold',
		// Wider + bolder: xl is for rare, prominent single CTAs (landing hero) that
		// should read as a headline action, not just a scaled-up default button.
		xl: 'px-12 py-4 text-xl font-bold min-w-[18rem]',
		icon: 'h-9 w-9 font-semibold',
		'icon-sm': 'h-7 w-7 font-semibold'
	};

	// 'link' renders inline with surrounding text: text size only, no padding box
	const linkSizes: Record<Size, string> = {
		sm: 'text-xs font-semibold',
		md: 'text-sm font-semibold',
		lg: 'text-base font-semibold',
		xl: 'text-lg font-bold',
		icon: '',
		'icon-sm': ''
	};

	const isDisabled = $derived(disabled || loading);
	// The rest props are typed against <button>; when rendering the <a> branch the
	// event-handler element types differ, so re-type them for the anchor spread.
	const anchorRest = $derived(rest as unknown as HTMLAnchorAttributes);
	const classes = $derived(
		[
			base,
			variant !== 'link' && box,
			variants[variant],
			variant === 'primary' && primaryFills[color],
			variant === 'link' ? linkSizes[size] : sizes[size],
			fullWidth && 'w-full',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- href is provided by callers, who resolve() their paths; the rule can't see through the prop -->
	<a
		{href}
		class="{classes}{isDisabled ? ' pointer-events-none opacity-60' : ''}"
		aria-disabled={isDisabled || undefined}
		tabindex={isDisabled ? -1 : undefined}
		{...anchorRest}
	>
		{@render children()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button {type} disabled={isDisabled} aria-busy={loading || undefined} class={classes} {...rest}>
		{#if loading}
			<span
				class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></span>
		{/if}
		{@render children()}
	</button>
{/if}
