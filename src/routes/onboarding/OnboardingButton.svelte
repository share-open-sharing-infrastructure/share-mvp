<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		variant?: 'primary' | 'ghost';
		type?: 'button' | 'submit';
		disabled?: boolean;
		onclick?: () => void;
	}

	let {
		children,
		variant = 'primary',
		type = 'button',
		disabled = false,
		onclick,
	}: Props = $props();
</script>

<button
	{type}
	{disabled}
	{onclick}
	class={variant === 'primary'
		? 'w-full py-2 px-6 min-button bg-primary-200 hover:bg-primary cursor-pointer disabled:opacity-60'
		: 'w-full py-2 px-6 text-sm text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200 transition-colors'}
>
	{@render children()}
</button>
