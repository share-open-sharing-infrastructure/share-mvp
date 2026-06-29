<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import ProfileImageField from './ProfileImageField.svelte';
	import EmailSection from './EmailSection.svelte';
	import MessengerField from './MessengerField.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import LendingRequirementsSection from './LendingRequirementsSection.svelte';
	import InviteLink from './InviteLink.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';
	import ProfileToc from './ProfileToc.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let { data, form } = $props();

	let selectedTransportMode = $state<TransportMode>(
		(data.currentUser.preferredTransportMode as TransportMode | undefined) ??
			'bicycle'
	);

	// Drives the sticky save bar's "unsaved changes" hint. Set on any edit within
	// the main form; cleared only when THIS form saves successfully (see the form's
	// enhance callback) — not when a sibling form (photo delete, resend) succeeds.
	let isDirty = $state(false);
	const markDirty = () => (isDirty = true);

	let settingsForm = $state<HTMLFormElement>();

	// The save bar's button submits the main form via its `form` attribute. If the
	// form is invalid (e.g. AddressInput's hidden validity guard when a city was
	// typed but not picked from the search), the browser blocks submission before
	// use:enhance runs — so no toast would appear. Surface it and scroll the user
	// to the offending field instead of failing silently.
	function handleSaveClick(e: MouseEvent) {
		if (!settingsForm || settingsForm.checkValidity()) return;
		e.preventDefault();
		const invalid = settingsForm.querySelector(':invalid');
		// The address validity lives on an sr-only input; guide the user to the
		// visible city field instead of an invisible one.
		const target =
			invalid?.getAttribute('aria-hidden') === 'true'
				? document.getElementById('city')
				: (invalid as HTMLElement | null);
		target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		(target as HTMLElement | null)?.focus?.();
		pushToast('error', texts.pages.profile.fixErrorsBeforeSave);
	}

	const profileImageUrl = $derived(
		data.currentUser.profileImage
			? `${data.PB_URL}api/files/users/${data.currentUser.id}/${data.currentUser.profileImage}`
			: null
	);

	// Surface every form-action result as a bottom toast (replaces the old inline
	// alert that forced a scroll-to-top). Guarded by reference so it fires once per result.
	let lastFormResult: unknown = null;
	$effect(() => {
		if (form && form !== lastFormResult) {
			lastFormResult = form;
			// Every current action returns a message; guard so a future message-less
			// result can't render an empty toast.
			if (form.message)
				pushToast(form.success ? 'success' : 'error', form.message);
		}
	});

	// Table-of-contents entries — ids must match the <section> anchors below.
	const sections = [
		{ id: 'profil', label: texts.pages.profile.sections.profile },
		{ id: 'standort', label: texts.pages.profile.sections.location },
		{ id: 'kontakt', label: texts.pages.profile.sections.contact },
		{ id: 'verleih', label: texts.lendingRequirements.sectionTitle },
		{
			id: 'benachrichtigungen',
			label: texts.pages.profile.sections.notifications,
		},
		{ id: 'email', label: texts.pages.profile.sections.email },
		{ id: 'einladung', label: texts.pages.profile.sections.invite },
		{ id: 'konto', label: texts.pages.profile.sections.account },
	];

	const cardClass =
		'bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8 scroll-mt-28';
	const sectionTitleClass =
		'text-lg font-semibold text-tinte-900 dark:text-white';
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="bg-secondary-100 dark:bg-tinte-900 min-h-screen pb-28">
	<div class="max-w-5xl mx-auto px-4 py-6 sm:py-10">
		<h1
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white mb-6"
		>
			{texts.pages.profile.title}
		</h1>

		{#if !data.currentUser.hasOnboarded}
			<a
				href={resolve('/onboarding')}
				class="flex items-center justify-center gap-2 w-full mb-6 py-3 px-6 min-button bg-primary-200 hover:bg-primary-300 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
			>
				{texts.pages.profile.completeOnboarding}
			</a>
		{/if}

		<div class="grid gap-8 lg:grid-cols-[200px_1fr]">
			<ProfileToc {sections} title={texts.pages.profile.sections.tocLabel} />

			<div class="space-y-6 min-w-0">
				<!-- Sections that share the single save bar live in one form.
				     reset: false preserves typed field values after use:enhance processes the submission. -->
				<form
					bind:this={settingsForm}
					id="profile-settings-form"
					method="POST"
					action="?/saveProfile"
					enctype="multipart/form-data"
					oninput={markDirty}
					onchange={markDirty}
					class="space-y-6"
					use:enhance={() =>
						async ({ result, update }) => {
							await update({ reset: false });
							// A returned {error:true} is still an ActionResult of type 'success'
							// (HTTP 200), so gate on the action's own success flag — otherwise a
							// rejected save (e.g. invalid Telegram handle) would clear the hint.
							if (
								result.type === 'success' &&
								(result.data as { success?: boolean } | undefined)?.success
							)
								isDirty = false;
						}}
				>
					<!-- PROFIL: username, image, bio -->
					<section id="profil" class={cardClass}>
						<h2 class={sectionTitleClass}>
							{texts.pages.profile.sections.profile}
						</h2>
						<div class="mt-4 space-y-4">
							<div
								class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
							>
								<label
									for="username"
									class="sm:w-36 sm:shrink-0 text-sm font-medium text-tinte-900 dark:text-white"
								>
									{texts.ui.username}
								</label>
								<input
									type="text"
									name="username"
									id="username"
									value={data.currentUser.username}
									class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									required
								/>
							</div>

							<div
								class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4"
							>
								<label
									for="profileImage"
									class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
								>
									{texts.pages.profile.profileImageLabel}
								</label>
								<div class="sm:flex-1">
									<ProfileImageField imageUrl={profileImageUrl} />
								</div>
							</div>

							<div
								class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4"
							>
								<label
									for="bio"
									class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
								>
									{texts.pages.profile.bioLabel}
								</label>
								<textarea
									name="bio"
									id="bio"
									rows="4"
									value={data.currentUser.bio ?? ''}
									class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y"
									placeholder={texts.pages.profile.bioPlaceholder}
								></textarea>
							</div>
						</div>
					</section>

					<!-- STANDORT & MOBILITÄT: address + transport mode.
					     #address is a deep-link target from the item-page lending-requirement CTA. -->
					<section id="standort" class={cardClass}>
						<h2 class={sectionTitleClass}>
							{texts.pages.profile.sections.location}
						</h2>
						<div class="mt-4 space-y-4">
							<div
								id="address"
								class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 scroll-mt-28"
							>
								<label
									for="city"
									class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
								>
									{texts.ui.location}
								</label>
								<div class="sm:flex-1">
									<AddressInput initialValue={data.currentUser.city ?? ''} />
									<p
										class="text-sm text-tinte-600 dark:text-tinte-400 mb-2 mt-2"
									>
										{texts.pages.userProfile.addressNote}
									</p>
									<p class="text-xs text-tinte-500 dark:text-tinte-400">
										{texts.pages.userProfile.addressHint}
									</p>
								</div>
							</div>

							<div
								class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4"
							>
								<div
									class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
								>
									{texts.pages.profile.transportModeLabel}
								</div>
								<div>
									<div class="flex gap-2">
										<input
											type="hidden"
											name="preferredTransportMode"
											value={selectedTransportMode}
										/>
										{#each ['foot', 'bicycle', 'car'] as TransportMode[] as mode (mode)}
											<button
												type="button"
												onclick={() => {
													selectedTransportMode = mode;
													markDirty();
												}}
												class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-colors cursor-pointer
													{selectedTransportMode === mode
													? 'border-primary bg-primary-50 dark:bg-primary-900/20 text-primary dark:text-primary-300'
													: 'border-tinte-200 dark:border-tinte-600 text-tinte-600 dark:text-tinte-300 hover:border-tinte-400 dark:hover:border-tinte-400'}"
											>
												<TransportModeIcon {mode} class="h-5 w-5" />
												<span class="text-xs font-medium"
													>{texts.pages.search.transportModes[mode]}</span
												>
											</button>
										{/each}
									</div>
									<p class="text-xs text-tinte-500 dark:text-tinte-400 mt-2">
										{texts.pages.profile.transportModeNote}
									</p>
								</div>
							</div>
						</div>
					</section>

					<!-- KONTAKT: messenger handles + visibility -->
					<section id="kontakt" class={cardClass}>
						<h2 class={sectionTitleClass}>
							{texts.pages.profile.sections.contact}
						</h2>
						<p class="mt-2 text-sm text-tinte-600 dark:text-tinte-400">
							{texts.messenger.introText}
						</p>
						<div class="mt-4 space-y-4">
							<MessengerField
								fieldName="telegramUsername"
								label={texts.messenger.telegramUsername}
								placeholder={texts.messenger.telegramUsernamePlaceholder}
								value={data.contact.telegramUsername ?? ''}
								visibilityToggleName="telegramVisibleToTrustedOnly"
								visibilityToggleChecked={data.contact
									.telegramVisibleToTrustedOnly ?? true}
								tooltipId="telegram-tooltip"
								tooltipTitle={texts.messenger.telegramTooltipTitle}
								tooltipText={texts.messenger.telegramTooltipText}
							/>
							<MessengerField
								fieldName="signalLink"
								label={texts.messenger.signalLink}
								placeholder={texts.messenger.signalLinkPlaceholder}
								value={data.contact.signalLink ?? ''}
								visibilityToggleName="signalVisibleToTrustedOnly"
								visibilityToggleChecked={data.contact
									.signalVisibleToTrustedOnly ?? true}
								tooltipId="signal-tooltip"
								tooltipTitle={texts.messenger.signalTooltipTitle}
								tooltipText={texts.messenger.signalTooltipText}
							/>
						</div>
					</section>

					<!-- VERLEIH-VORAUSSETZUNGEN: lender-defined borrower requirements (#443).
					     Toggles live in the main form and save via the shared save bar. -->
					<section id="verleih" class={cardClass}>
						<LendingRequirementsSection settings={data.requirementSettings} />
					</section>
				</form>

				<!-- Standalone form targeted by the "delete photo" button in ProfileImageField -->
				<form
					id="delete-profile-image-form"
					method="POST"
					action="?/deleteProfileImage"
					use:enhance={() =>
						({ update }) =>
							update({ reset: false })}
				></form>

				<!-- BENACHRICHTIGUNGEN: auto-saving toggles (push + email) -->
				<section id="benachrichtigungen" class="scroll-mt-28">
					<NotificationSettings userId={data.currentUser.id} />
				</section>

				<!-- E-MAIL: address, change link, verification. #email is a deep-link target. -->
				<section id="email" class={cardClass}>
					<h2 class="{sectionTitleClass} mb-3">
						{texts.pages.profile.sections.email}
					</h2>
					<EmailSection
						email={data.currentUser.email}
						verified={data.currentUser.verified ?? false}
					/>
				</section>

				<!-- EINLADUNG -->
				<section id="einladung" class="scroll-mt-28">
					<InviteLink inviteUrl={data.inviteUrl} />
				</section>

				<!-- KONTO & DATENSCHUTZ -->
				<section
					id="konto"
					class="{cardClass} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
				>
					<div>
						<h2 class={sectionTitleClass}>{texts.account.manageLink}</h2>
						<p class="mt-1 text-sm text-tinte-600 dark:text-tinte-400">
							{texts.account.pageIntro}
						</p>
					</div>
					<a
						href={resolve('/user/account')}
						class="shrink-0 inline-flex items-center justify-center py-2.5 px-5 min-button bg-primary-200 hover:bg-primary text-white font-semibold rounded-xl transition-opacity"
					>
						{texts.account.manageLink}
					</a>
				</section>
			</div>
		</div>
	</div>

	<!-- Sticky save bar: fixed to the viewport bottom so the single Save action is
	     always reachable without scrolling. Submits the main settings form via its form id. -->
	<div
		class="fixed inset-x-0 bottom-0 z-40 border-t border-tinte-200 dark:border-tinte-700 bg-sand/95 dark:bg-tinte-800/95 backdrop-blur"
	>
		<div
			class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-end gap-4"
		>
			{#if isDirty}
				<span
					role="status"
					class="text-sm text-tinte-600 dark:text-tinte-400 mr-auto"
				>
					{texts.pages.profile.unsavedChanges}
				</span>
			{/if}
			<Button
				class="min-button bg-primary-200 hover:bg-primary"
				type="submit"
				form="profile-settings-form"
				onclick={handleSaveClick}
			>
				{texts.buttons.save}
			</Button>
		</div>
	</div>
</main>
