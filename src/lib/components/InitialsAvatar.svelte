<script module lang="ts">
	// Fixed bg/text token-class pairs, each >= 4.5:1 (WCAG AA) in light and dark mode.
	// Full class strings, not `bg-${colour}-200` — Tailwind can't see concatenated names
	// and would purge them. A `[data-theme]` override should re-check the contrast.
	const COLOR_PALETTE = [
		'bg-tinte-200 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300',
		'bg-primary-200 dark:bg-primary-700 text-primary-800 dark:text-primary-200',
		'bg-secondary-200 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200',
		'bg-accent-200 dark:bg-accent-700 text-accent-800 dark:text-accent-200',
	];

	// Pure string hash — no Math.random/Date, so SSR and CSR agree. The final mixing step
	// matters: `% 4` reads only the low bits, and 31 ≡ -1 (mod 4) would pile short
	// lowercase usernames onto one or two colours without it.
	function hashString(value: string): number {
		let hash = 0;
		for (let i = 0; i < value.length; i++) {
			hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
		}
		hash ^= hash >>> 16;
		hash = Math.imul(hash, 0x7feb352d);
		hash ^= hash >>> 15;
		return hash >>> 0;
	}
</script>

<script lang="ts">
	/**
	 * Local, privacy-preserving fallback avatar for users without a `profileImage` —
	 * renders their initials instead of calling a third-party avatar service (which
	 * would otherwise leak the username to that service). The background/text colour
	 * pair is picked deterministically from `name` (a small pure string hash into a
	 * fixed palette of theme-token classes), so a given user always gets the same
	 * colour instead of a new random one on every page load.
	 */
	let { name, class: cls = '' }: { name: string; class?: string } = $props();

	const initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);

	const colorClasses = $derived(COLOR_PALETTE[hashString(name) % COLOR_PALETTE.length]);
</script>

<div
	class="flex items-center justify-center font-semibold select-none {colorClasses} {cls}"
	role="img"
	aria-label={name}
>
	{initials}
</div>
