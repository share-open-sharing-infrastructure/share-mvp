<script lang="ts">
	let { size = 64, speed = 1.8, label = 'Lädt …', variant = 'pulse' }: {
		size?: number;
		speed?: number;
		label?: string;
		variant?: 'pulse' | 'rotate';
	} = $props();

	const rotating = $derived(variant === 'rotate');
</script>

<span
	class="aller-loader w-full h-full inline-flex items-center justify-center"
	role="status"
	aria-label={label}
	style="--size: {size}px; --speed: {speed}s;"
>
	<svg viewBox="0 0 120 120" aria-hidden="true">
		<g class:orbit={rotating}>
			<rect class="shape shape-square" class:counter={rotating}
				x="14" y="14" width="32" height="32"
				fill="#F5D33A" stroke="#1F1F1F" stroke-width="1" />
		</g>
		<g class:orbit={rotating}>
			<polygon class="shape shape-triangle" class:counter={rotating}
				points="90,16 108,48 72,48"
				fill="#4A6FE3" stroke="#1F1F1F" stroke-width="1"
				stroke-linejoin="round" />
		</g>
		<g class:orbit={rotating}>
			<circle class="shape shape-circle" class:counter={rotating}
				cx="60" cy="90" r="20"
				fill="#E8553F" stroke="#1F1F1F" stroke-width="1" />
		</g>
	</svg>
	<span class="sr-only">{label}</span>
</span>

<style>
	.aller-loader { display: inline-flex; width: var(--size); height: var(--size); line-height: 0; position: relative; }
	svg { width: 100%; height: 100%; overflow: visible; }

	/* Pulse variant */
	.shape {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0.35;
		animation: pulse var(--speed) ease-in-out infinite;
	}
	.shape-square   { animation-delay: 0s; }
	.shape-triangle { animation-delay: calc(var(--speed) * -0.6667); }
	.shape-circle   { animation-delay: calc(var(--speed) * -0.3333); }

	/* Rotate variant — the <g> orbits the SVG center; the shape counter-rotates to stay upright */
	.orbit {
		transform-box: view-box;
		transform-origin: 50% 50%;
		animation: orbit var(--speed) linear infinite;
	}
	.shape.counter {
		opacity: 1;
		animation: counter var(--speed) linear infinite;
	}

	@keyframes pulse {
		0%        { opacity: 0.35; transform: scale(0.88); }
		15%       { opacity: 1;    transform: scale(1.12); }
		33%, 100% { opacity: 0.35; transform: scale(0.88); }
	}
	@keyframes orbit   { to { transform: rotate(360deg); } }
	@keyframes counter { to { transform: rotate(-360deg); } }

	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	@media (prefers-reduced-motion: reduce) {
		.shape, .orbit { animation: none; opacity: 1; transform: none; }
	}
</style>
