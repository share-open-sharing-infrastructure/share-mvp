<script lang="ts">
	// Small hand-rolled SVG line chart — no charting dependency for a handful of
	// trend lines. Deliberately minimal: one series, no axes/gridlines, an accessible
	// text summary carries the meaning for screen readers (the line itself is decorative).
	interface Props {
		label: string;
		points: number[];
		dates: string[];
	}

	let { label, points, dates }: Props = $props();

	const WIDTH = 320;
	const HEIGHT = 64;
	const PAD = 4;

	const max = $derived(Math.max(...points, 0));
	const min = $derived(Math.min(...points, 0));
	const range = $derived(max - min || 1);

	const path = $derived(
		points
			.map((p, i) => {
				const x = points.length > 1 ? (i / (points.length - 1)) * (WIDTH - 2 * PAD) + PAD : WIDTH / 2;
				const y = HEIGHT - PAD - ((p - min) / range) * (HEIGHT - 2 * PAD);
				return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ')
	);

	const summary = $derived(
		points.length === 0
			? `${label}: keine Daten`
			: `${label}: ${points[0]} am ${dates[0]}, ${points[points.length - 1]} am ${dates[dates.length - 1]}`
	);
</script>

<figure class="m-0">
	<figcaption class="mb-1 text-sm font-medium text-tinte-700 dark:text-tinte-300">{label}</figcaption>
	{#if points.length > 1}
		<svg viewBox="0 0 {WIDTH} {HEIGHT}" class="h-16 w-full" role="img" aria-label={summary}>
			<path d={path} fill="none" class="stroke-primary-500" stroke-width="2" />
		</svg>
	{:else}
		<p class="text-sm text-tinte-500">{summary}</p>
	{/if}
</figure>
