<script lang="ts">
	import StepWelcome from './StepWelcome.svelte';
	import StepHowItWorks from './StepHowItWorks.svelte';
	import StepProfile from './StepProfile.svelte';
	import StepLocation from './StepLocation.svelte';
	import StepContact from './StepContact.svelte';
	import StepTrustees from './StepTrustees.svelte';
	import StepTransportMode from './StepTransportMode.svelte';
	import StepBrowserLocation from './StepBrowserLocation.svelte';
	import StepPushNotifications from './StepPushNotifications.svelte';
	import StepSurvey from './StepSurvey.svelte';
	import StepDone from './StepDone.svelte';
	import { texts } from '$lib/texts';
	import { instance } from '$lib/instance';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let { data } = $props();

	type OnboardingStep =
		| 'welcome'
		| 'howItWorks'
		| 'survey'
		| 'profile'
		| 'location'
		| 'transportMode'
		| 'contact'
		| 'trustees'
		| 'browserLocation'
		| 'pushNotifications'
		| 'done';

	// The survey step only exists when the instance has a configured onboarding survey (Class D,
	// share-mvp#631) — `instance` is a module singleton, evaluated identically on server and
	// client, so this never diverges between SSR and hydration. Steps are IDs, not indices: the
	// `{#if}` chain below switches on `current === '<id>'`, so a step being absent from `STEPS`
	// (rather than every later numeric index shifting) is the only thing that changes when the
	// survey is off.
	const STEPS: OnboardingStep[] = [
		'welcome',
		'howItWorks',
		...(instance.onboardingSurvey.url ? (['survey'] as const) : []),
		'profile',
		'location',
		'transportMode',
		'contact',
		'trustees',
		'browserLocation',
		'pushNotifications',
		'done',
	];

	let step = $state(1);
	const current = $derived(STEPS[step - 1]);

	function next() {
		if (step < STEPS.length) step++;
	}

	function back() {
		if (step > 1) step--;
	}
</script>

<SeoHead title={texts.seo.onboarding.title} robots="noindex, nofollow" />

<div class="min-h-screen bg-secondary-100 dark:bg-tinte-900 flex items-center justify-center px-4 py-10">
	<div class="w-full max-w-md bg-sand dark:bg-tinte-800 rounded-2xl shadow-lg p-8 sm:p-10">

		<!-- Back button -->
		<div class="h-6 mb-4">
			{#if step > 1}
				<button
					type="button"
					onclick={back}
					class="flex items-center gap-1 text-sm text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200 transition-colors"
				>
					← Zurück
				</button>
			{/if}
		</div>

		<!-- Progress dots: purely decorative. They are empty, non-interactive divs with no
		     accessible name, so `aria-current` on them was inert anyway — the `sr-only` live
		     region below is the single source of truth for assistive tech. -->
		<div class="flex justify-center gap-2 mb-8" aria-hidden="true">
			{#each STEPS as id, i (id)}
				<div
					class="h-2 rounded-full transition-all duration-300 {i + 1 === step
						? 'w-6 bg-primary'
						: i + 1 < step
							? 'w-2 bg-primary opacity-40'
							: 'w-2 bg-tinte-300 dark:bg-tinte-600'}"
				></div>
			{/each}
		</div>
		<p class="sr-only" aria-live="polite">{texts.onboarding.progress(step, STEPS.length)}</p>

		{#if current === 'welcome'}
			<StepWelcome onNext={next} />
		{:else if current === 'howItWorks'}
			<StepHowItWorks onNext={next} />
		{:else if current === 'survey'}
			<StepSurvey onNext={next} survey={instance.onboardingSurvey} />
		{:else if current === 'profile'}
			<StepProfile onNext={next} currentUser={data.currentUser} pbUrl={data.PB_URL} />
		{:else if current === 'location'}
			<StepLocation
				onNext={next}
				initialCity={data.currentUser.city}
				initialGeolocation={data.geolocation}
			/>
		{:else if current === 'transportMode'}
			<StepTransportMode onNext={next} preferredTransportMode={data.currentUserPreferences?.preferredTransportMode} />
		{:else if current === 'contact'}
			<StepContact onNext={next} currentUser={data.contact} />
		{:else if current === 'trustees'}
			<StepTrustees
				onNext={next}
				users={data.users}
				trustIds={data.trustIds}
				currentUserId={data.currentUser.id}
			/>
		{:else if current === 'browserLocation'}
			<StepBrowserLocation onNext={next} />
		{:else if current === 'pushNotifications'}
			<StepPushNotifications onNext={next} />
		{:else if current === 'done'}
			<StepDone inviteUrl={data.inviteUrl} username={data.username} />
		{/if}

	</div>
</div>
