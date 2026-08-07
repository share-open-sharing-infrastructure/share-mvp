<script lang="ts">
	import { HeartOutline } from 'flowbite-svelte-icons';

	let {
		label,
		type = 'button',
		disabled = false,
		onclick,
		class: className = ''
	} = $props<{
		label: string;
		type?: 'button' | 'submit';
		disabled?: boolean;
		onclick?: () => void;
		class?: string;
	}>();

	let clicked = $state(false);

	function handleClick() {
		if (disabled) return;
		onclick?.();
		clicked = true;
		setTimeout(() => { clicked = false; }, 900);
	}
</script>

<div class="wrapper {className}" class:is-clicked={clicked}>
	<button {type} {disabled} class="sparkle-btn" onclick={handleClick}>
		<span class="shimmer" aria-hidden="true"></span>
		<HeartOutline class="me-2 h-5 w-5 relative z-10 sparkle-heart" />
		<span class="relative z-10">{label}</span>
	</button>
	<span class="spark s1" aria-hidden="true">✦</span>
	<span class="spark s2" aria-hidden="true">✧</span>
	<span class="spark s3" aria-hidden="true">★</span>
	<span class="spark s4" aria-hidden="true">✦</span>
	<span class="spark s5" aria-hidden="true">✧</span>
</div>

<style>
	.wrapper {
		position: relative;
		display: inline-flex;
		transition: transform 0.15s ease, filter 0.2s ease;
	}

	.wrapper:hover {
		transform: scale(1.05);
		filter:
			drop-shadow(0 0 6px var(--color-accent))
			drop-shadow(0 0 16px var(--color-primary-300));
	}

	/* Animated gradient background */
	.sparkle-btn {
		position: relative;
		overflow: hidden;
		display: inline-flex;
		align-items: center;
		padding: 10px 20px;
		border-radius: 25px;
		border: none;
		cursor: pointer;
		font-size: large;
		font-weight: bold;
		color: white;
		background: linear-gradient(
			135deg,
			var(--color-accent)    0%,
			var(--color-primary)   50%,
			var(--color-secondary) 100%
		);
		background-size: 250% 250%;
		animation: gradient-breathe 5s ease infinite;
	}

	.sparkle-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		animation: none;
	}

	@keyframes gradient-breathe {
		0%, 100% { background-position: 0% 50%; }
		50%       { background-position: 100% 50%; }
	}

	/* Rainbow shimmer — on click */
	.shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			105deg,
			transparent 20%,
			rgba(255, 255, 255, 0.2)  35%,
			rgba(245, 211,  58, 0.55) 45%,
			rgba(255, 255, 255, 0.75) 50%,
			rgba( 74, 111, 227, 0.35) 58%,
			rgba(255, 255, 255, 0.2)  65%,
			transparent 80%
		);
		transform: translateX(-150%);
		pointer-events: none;
		z-index: 0;
	}

	.wrapper.is-clicked .shimmer {
		animation: shimmer 0.65s ease-out 0.05s;
	}

	@keyframes shimmer {
		to { transform: translateX(150%); }
	}

	/* Sparkles — on click */
	.spark {
		position: absolute;
		left: 50%;
		top: 50%;
		pointer-events: none;
		opacity: 0;
		font-size: 0.9rem;
		line-height: 1;
		transform: translate(-50%, -50%) scale(0);
		color: var(--spark-color, var(--color-accent));
	}

	.s1 { --tx: -2rem;   --ty: -1.5rem; --delay:   0ms; --spark-color: var(--color-primary);       }
	.s2 { --tx:  0.2rem; --ty: -2.2rem; --delay:  70ms; --spark-color: var(--color-secondary);     }
	.s3 { --tx:  2rem;   --ty: -1.2rem; --delay: 140ms; --spark-color: var(--color-accent);        }
	.s4 { --tx: -2.1rem; --ty:  0.6rem; --delay:  35ms; --spark-color: var(--color-secondary-400); }
	.s5 { --tx:  1.6rem; --ty:  1rem;   --delay: 105ms; --spark-color: var(--color-primary-300);   }

	.wrapper.is-clicked .spark {
		animation: spark-fly 0.75s ease-out var(--delay) forwards;
	}

	@keyframes spark-fly {
		0%   { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(0deg); }
		25%  { opacity: 1; }
		100% { opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.2) rotate(40deg); }
	}

	/* Heartbeat — on click */
	.wrapper.is-clicked :global(.sparkle-heart) {
		animation: heartbeat 0.4s ease-in-out;
	}

	@keyframes heartbeat {
		0%   { transform: scale(1); }
		35%  { transform: scale(1.45); }
		100% { transform: scale(1); }
	}
</style>
