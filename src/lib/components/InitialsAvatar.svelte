<script lang="ts">
	/**
	 * Local, privacy-preserving fallback avatar for users without a `profileImage` —
	 * renders their initials instead of calling a third-party avatar service (which
	 * would otherwise leak the username to that service).
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
</script>

<div
	class="flex items-center justify-center bg-tinte-200 dark:bg-tinte-700 text-tinte-600 dark:text-tinte-300 font-semibold select-none {cls}"
	role="img"
	aria-label={name}
>
	{initials}
</div>
