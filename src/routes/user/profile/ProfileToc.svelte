<script lang="ts">
	import { onMount } from 'svelte';

	interface Section {
		id: string;
		label: string;
	}

	let { sections, title }: { sections: Section[]; title: string } = $props();

	// Highlight the section currently in view (scroll-spy). Falls back to the first.
	let activeId = $state(sections[0]?.id ?? '');

	onMount(() => {
		// The active section is the last one whose top has scrolled above a trigger
		// line ~120px below the viewport top (clears the sticky nav).
		const TRIGGER_OFFSET = 120;

		function updateActive() {
			const vh = window.innerHeight;
			const maxScroll = document.documentElement.scrollHeight - vh;
			// Clamp: elastic/overscroll can push scrollY past maxScroll (remaining < 0).
			const remaining = Math.max(0, maxScroll - window.scrollY);

			// Short trailing sections (e.g. E-Mail, Einladung, Konto) can never scroll
			// their top up to a fixed line because the page bottoms out first — they'd be
			// skipped. Over the last viewport of scroll, slide the line down through the
			// viewport so each remaining section gets its turn (and Konto wins at the end).
			let line = TRIGGER_OFFSET;
			if (maxScroll > 0 && remaining < vh) {
				line = TRIGGER_OFFSET + (vh - TRIGGER_OFFSET) * (1 - remaining / vh);
			}

			let current = sections[0]?.id ?? '';
			for (const s of sections) {
				const el = document.getElementById(s.id);
				if (el && el.getBoundingClientRect().top <= line) current = s.id;
			}
			activeId = current;
		}

		// Batch scroll handling into a single rAF to avoid layout thrash on every tick.
		let ticking = false;
		function onScroll() {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				updateActive();
				ticking = false;
			});
		}

		updateActive();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<!-- Desktop: sticky vertical table of contents -->
<nav class="hidden lg:block sticky top-24 self-start" aria-label={title}>
	<p
		class="px-3 mb-2 text-xs font-semibold uppercase tracking-wide text-tinte-500 dark:text-tinte-400"
	>
		{title}
	</p>
	<ul class="space-y-1">
		{#each sections as section (section.id)}
			<li>
				<a
					href="#{section.id}"
					aria-current={activeId === section.id ? 'location' : undefined}
					class="block rounded-lg px-3 py-2 text-sm font-medium transition-colors
						{activeId === section.id
						? 'bg-primary-50 text-primary dark:bg-primary-900/20 dark:text-primary-300'
						: 'text-tinte-600 hover:bg-tinte-100 hover:text-tinte-900 dark:text-tinte-300 dark:hover:bg-tinte-700'}"
				>
					{section.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>

<!-- Mobile: horizontal, scrollable chip strip pinned below the nav bar -->
<nav
	class="lg:hidden sticky top-16 z-20 -mx-4 px-4 py-2 bg-secondary-100/95 dark:bg-tinte-900/95 backdrop-blur border-b border-tinte-200 dark:border-tinte-700 overflow-x-auto"
	aria-label={title}
>
	<ul class="flex gap-2 w-max">
		{#each sections as section (section.id)}
			<li>
				<a
					href="#{section.id}"
					aria-current={activeId === section.id ? 'location' : undefined}
					class="block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors
						{activeId === section.id
						? 'bg-primary-200 text-white'
						: 'bg-tinte-100 text-tinte-700 dark:bg-tinte-700 dark:text-tinte-200'}"
				>
					{section.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
