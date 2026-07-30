<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		options: Option[];
		value: T;
		onchange?: (value: T) => void;
		/** Accessible name for the group (visually hidden if no visible legend is nearby). */
		label: string;
		/** Nur Layout-Klassen (Breite, Abstand, Positionierung) — nie Farben. */
		class?: string;
	}

	let { options, value = $bindable(), onchange, label, class: className = '' }: Props = $props();

	// Roving tabindex + arrow-key selection, per the WAI-ARIA radio-group pattern: the group is a
	// single Tab stop (only the checked radio is tabbable), and Arrow keys move focus *and*
	// selection between options.
	let buttons = $state<HTMLButtonElement[]>([]);

	function select(next: T) {
		value = next;
		onchange?.(next);
	}

	function onKeydown(event: KeyboardEvent, index: number) {
		const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
		const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
		if (!forward && !backward) return;
		event.preventDefault();
		const delta = forward ? 1 : -1;
		const nextIndex = (index + delta + options.length) % options.length;
		select(options[nextIndex].value);
		buttons[nextIndex]?.focus();
	}
</script>

<div role="radiogroup" aria-label={label} class="inline-flex flex-wrap gap-2 {className}">
	{#each options as option, index (option.value)}
		{@const active = option.value === value}
		<button
			bind:this={buttons[index]}
			type="button"
			role="radio"
			aria-checked={active}
			tabindex={active ? 0 : -1}
			onclick={() => select(option.value)}
			onkeydown={(event) => onKeydown(event, index)}
			class="rounded-full border px-3 py-1 text-sm font-medium transition-colors cursor-pointer
				{active
				? 'bg-primary border-primary text-white'
				: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
		>
			{option.label}
		</button>
	{/each}
</div>
