<script lang="ts">
	import { texts } from '$lib/texts';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	interface Props {
		mode: TransportMode;
		onchange: (mode: TransportMode) => void;
	}

	let { mode, onchange }: Props = $props();

	const modes: { value: TransportMode; label: string }[] = [
		{ value: 'foot', label: texts.pages.search.transportModes.foot },
		{ value: 'bicycle', label: texts.pages.search.transportModes.bicycle },
		{ value: 'car', label: texts.pages.search.transportModes.car },
	];
</script>

<div class="flex gap-1 items-center">
	{#each modes as m(m.value)}
		<button
			type="button"
			class="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors hover:cursor-pointer
				{mode === m.value
				? 'bg-primary text-white border-primary'
				: 'bg-sand text-tinte-600 border-tinte-300 hover:bg-papier dark:bg-tinte-800 dark:text-tinte-300 dark:border-tinte-600'}"
			onclick={() => onchange(m.value)}
			aria-pressed={mode === m.value}
		>
			{#if m.value === 'foot'}
				<!-- Walking person icon -->
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
				</svg>
			{:else if m.value === 'bicycle'}
				<!-- Bicycle icon -->
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M15.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12.5a4.5 4.5 0 1 0 9 0 4.5 4.5 0 0 0-9 0zm2 0a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm8-4.5-3.5-4H8v2h2.8l2.1 2.5-4.4 3.5H4v2h5l3.6-2.9 1.8 2.1-.5 3.3H16v-4.2l-1-1.3zM19 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/>
				</svg>
			{:else}
				<!-- Car icon -->
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
					<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
				</svg>
			{/if}
			{m.label}
		</button>
	{/each}
</div>
