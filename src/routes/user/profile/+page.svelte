<script lang="ts">
	import { texts } from '$lib/texts';
	import Button from '$lib/components/ui/Button.svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import ProfileBasicsSection from './ProfileBasicsSection.svelte';
	import LocationSection from './LocationSection.svelte';
	import EmailSection from './EmailSection.svelte';
	import MessengerField from './MessengerField.svelte';
	import ContactSection from './ContactSection.svelte';
	import ExternalLendingInfoSection from './ExternalLendingInfoSection.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import LendingRequirementsSection from './LendingRequirementsSection.svelte';
	import InviteLink from './InviteLink.svelte';
	import ProfileToc from './ProfileToc.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { pushToast } from '$lib/stores/toast.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let { data, form } = $props();

	// Drives the sticky save bar's "unsaved changes" hint. Set on any edit within
	// the main form; cleared only when THIS form saves successfully (see the form's
	// enhance callback) — not when a sibling form (photo delete, resend) succeeds.
	let isDirty = $state(false);
	const markDirty = () => (isDirty = true);

	// Warn before leaving with unsaved edits (MaRaMinden review request). beforeNavigate
	// covers in-app navigation with a confirm; the native beforeunload below covers full
	// page unloads (reload / tab close / external links), where browsers show their own prompt.
	beforeNavigate((navigation) => {
		if (!isDirty || navigation.willUnload) return;
		if (!confirm(texts.pages.profile.unsavedLeaveConfirm)) navigation.cancel();
	});
	$effect(() => {
		function onBeforeUnload(e: BeforeUnloadEvent) {
			if (!isDirty) return;
			e.preventDefault();
			e.returnValue = '';
		}
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	});

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

<SeoHead title={texts.pages.profile.title} robots="noindex, nofollow" />

<main class="bg-secondary-100 dark:bg-tinte-900 min-h-screen pb-28">
	<div class="max-w-5xl mx-auto px-4 py-6 sm:py-10">
		<h1
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white mb-6"
		>
			{texts.pages.profile.title}
		</h1>

		{#if !data.currentUserPreferences?.hasOnboarded}
			<Button href={resolve('/onboarding')} size="lg" fullWidth class="mb-6">
				{texts.pages.profile.completeOnboarding}
			</Button>
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
						<ProfileBasicsSection
							username={data.currentUser.username}
							bio={data.currentUser.bio ?? ''}
							{profileImageUrl}
							ondirty={markDirty}
						/>
					</section>

					<!-- STANDORT & MOBILITÄT: address + transport mode -->
					<section id="standort" class={cardClass}>
						<h2 class={sectionTitleClass}>
							{texts.pages.profile.sections.location}
						</h2>
						<LocationSection
							city={data.currentUser.city ?? ''}
							initialTransportMode={(data.currentUserPreferences
								?.preferredTransportMode as TransportMode | undefined) ?? 'bicycle'}
							ondirty={markDirty}
						/>
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
								initialValue={data.contact.telegramUsername ?? ''}
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
								initialValue={data.contact.signalLink ?? ''}
								visibilityToggleName="signalVisibleToTrustedOnly"
								visibilityToggleChecked={data.contact
									.signalVisibleToTrustedOnly ?? true}
								tooltipId="signal-tooltip"
								tooltipTitle={texts.messenger.signalTooltipTitle}
								tooltipText={texts.messenger.signalTooltipText}
							/>
						</div>

						<!-- Off-platform contact opt-in (#438): the item-request CTA links to
						     e-mail/URL instead of an in-app chat. Saves via the shared save bar. -->
						<ContactSection
							contactMethod={data.currentUser.contactMethod ?? ''}
							contactEmail={data.currentUser.contactEmail ?? ''}
							contactUrl={data.currentUser.contactUrl ?? ''}
							contactPublic={data.currentUser.contactPublic ?? false}
						/>

						<!-- Ausleih-Hinweis for external items (#368): institutions only. Saves via
						     the shared save bar. -->
						{#if data.currentUser.isInstitution}
							<ExternalLendingInfoSection
								externalLendingInfo={data.currentUser.externalLendingInfo ?? ''}
							/>
						{/if}
					</section>

					<!-- VERLEIH-VORAUSSETZUNGEN: lender-defined borrower requirements (#443).
					     Toggles live in the main form and save via the shared save bar. -->
					<section id="verleih" class={cardClass}>
						<LendingRequirementsSection settings={data.requirementSettings} />
					</section>
				</form>

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
					<Button href={resolve('/user/account')} size="lg" class="shrink-0">
						{texts.account.manageLink}
					</Button>
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
			<Button type="submit" form="profile-settings-form" onclick={handleSaveClick}>
				{texts.buttons.save}
			</Button>
		</div>
	</div>
</main>
