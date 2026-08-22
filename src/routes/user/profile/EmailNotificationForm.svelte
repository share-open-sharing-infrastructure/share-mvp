<script lang="ts">
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import type { UserPreferences } from '$lib/types/models';

	// #607 review split: moved out of NotificationSettings.svelte, which is now a thin wrapper
	// around PushNotificationSection.svelte + this. `pushSupported` only exists here to draw
	// the divider above the master toggle when the (unrelated) push section rendered above it.
	//
	// #607: prefs come from SSR (data.currentUserPreferences in +page.svelte) instead of a
	// client-side onMount fetch — no more flash-of-default while the PocketBase SDK call was
	// in flight, and the toggles now save through the `saveNotificationPrefs` form action
	// instead of writing to PocketBase directly (the "all mutations go through form actions"
	// guardrail — the old onMount/getClientPB read+write path predates it).
	let { prefs, pushSupported }: { prefs: UserPreferences | null; pushSupported: boolean } =
		$props();

	// Seed-once $state from the SSR-provided `prefs` prop (#558/#619 rule: bind:checked takes
	// over from here, never a one-way `checked=`). A missing row means "opted in to both" —
	// the same semantics `$lib/server/userPreferences.ts` documents and hardens on create.
	// svelte-ignore state_referenced_locally
	let emailEnabled = $state(prefs?.emailNotifications !== false);
	// svelte-ignore state_referenced_locally
	let digestEnabled = $state(prefs?.digestEmails !== false);

	// The last values actually persisted to the server — the rollback target if a save fails
	// (#607 S1). `prefs` itself is seed-once and is NOT re-seeded by invalidateAll(), so this
	// pair (updated only on a confirmed successful save, see the form's use:enhance below) is
	// the only way back to a known-good state without a full reload. Deliberately a one-time
	// snapshot, not a $derived — it must NOT keep following emailEnabled/digestEnabled.
	// svelte-ignore state_referenced_locally
	let savedEmailEnabled = emailEnabled;
	// svelte-ignore state_referenced_locally
	let savedDigestEnabled = digestEnabled;

	// Guards against overlapping autoSave() calls while a save is in flight (#607 nice-to-have
	// — mirrors the `busy` guard on the neighboring push toggle). Deliberately does NOT disable
	// either <Toggle> to enforce this: a native `disabled` on the master toggle would drop its
	// own `name` from FormData the same way it did for the digest toggle in B1 below.
	let savingPrefs = $state(false);

	let notifForm = $state<HTMLFormElement>();

	/** Auto-submits the shared prefs form on either toggle's onchange. Awaits a tick first so a
	 *  same-event `$state` write (e.g. the digest toggle's own bind:checked setting
	 *  `digestEnabled`) has flushed to the DOM before FormData is built — that DOM state is the
	 *  hidden `digestEmails` input's `value` attribute below (bound to `digestEnabled`), not the
	 *  visible digest <Toggle>'s own `checked`/`disabled`, which FormData never reads (#607 B1). */
	async function autoSave() {
		if (savingPrefs) return;
		savingPrefs = true;
		await tick();
		notifForm?.requestSubmit();
	}

	/** Digest toggle's onchange. The toggle is aria-disabled (not natively `disabled`) while the
	 *  master switch is off, so it stays focusable and reachable for keyboard/screen-reader users
	 *  (WCAG 4.1.2) — but a native disabled input would ALSO silently drop the toggle's `name`
	 *  from FormData on submit (a plain HTML forms rule), which is exactly bug #607 B1: a user
	 *  switching the master off would appear to keep their digest preference, while the missing
	 *  field actually got read back as `false` and persisted. The toggle now carries no `name` at
	 *  all (see the hidden input below); this handler just reverts the click while inert instead. */
	function handleDigestChange() {
		if (!emailEnabled) {
			digestEnabled = !digestEnabled;
			return;
		}
		autoSave();
	}
</script>

<!-- Email + weekly digest ("Wochen-Rückblick") — one form, auto-submitted on either toggle's change. -->
<form
	method="POST"
	action="?/saveNotificationPrefs"
	bind:this={notifForm}
	aria-busy={savingPrefs || undefined}
	use:enhance={() => async ({ result, update }) => {
		try {
			// Don't reset: a native form reset would flip both toggles back to the value
			// they had when the page was rendered, even though the server already saved
			// the new one (same reasoning as the group-settings isPublic toggle).
			await update({ reset: false });
			// A returned {error:true} is still an ActionResult of type 'success' (HTTP 200),
			// so gate on the action's own success flag (same pattern as +page.svelte's main
			// form) — otherwise a failed save would be treated as confirmed (#607 S1).
			const succeeded =
				result.type === 'success' &&
				(result.data as { success?: boolean } | undefined)?.success;
			if (succeeded) {
				savedEmailEnabled = emailEnabled;
				savedDigestEnabled = digestEnabled;
			} else {
				// Roll the toggles back to the last confirmed server state — otherwise the UI
				// keeps showing the failed, unsaved value until the next full reload (#607 S1).
				emailEnabled = savedEmailEnabled;
				digestEnabled = savedDigestEnabled;
			}
		} finally {
			savingPrefs = false;
		}
	}}
>
	<!-- role="group" wraps BOTH toggles: the digest is a sub-option of the master switch
	     (expressed visually via the pl-4 indent below), and this makes that parent/child
	     relationship exist programmatically too, not just visually (WCAG 1.3.1). -->
	<div role="group" aria-label={texts.pages.profile.notifications.emailToggleLabel}>
		<div
			class="flex items-center justify-between"
			class:border-t={pushSupported}
			class:border-tinte-200={pushSupported}
			class:dark:border-tinte-700={pushSupported}
			class:mt-6={pushSupported}
			class:pt-6={pushSupported}
		>
			<div>
				<p class="text-sm font-medium text-tinte-900 dark:text-white">
					{texts.pages.profile.notifications.emailToggleLabel}
				</p>
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
					{texts.pages.profile.notifications.emailToggleDescription}
				</p>
			</div>
			<Toggle
				name="emailNotifications"
				bind:checked={emailEnabled}
				onchange={autoSave}
				aria-label={texts.pages.profile.notifications.emailToggleLabel}
				classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
			/>
		</div>

		<!-- Digest is a separate opt-out from the email master switch (#607) — indented
		     underneath it and inert (aria-disabled, kept focusable — see handleDigestChange)
		     while the master switch is off. The visible toggle carries no `name`: the hidden
		     input below is what FormData actually reads, so it always reflects `digestEnabled`
		     regardless of the toggle's own disabled-ish state (#607 B1). -->
		<div class="flex items-center justify-between mt-4 pl-4">
			<div>
				<p class="text-sm font-medium text-tinte-900 dark:text-white">
					{texts.pages.profile.notifications.digestToggleLabel}
				</p>
				<p class="text-sm text-tinte-600 dark:text-tinte-400 mt-1">
					{texts.pages.profile.notifications.digestToggleDescription}
				</p>
			</div>
			<Toggle
				bind:checked={digestEnabled}
				class={!emailEnabled ? 'cursor-not-allowed opacity-50' : ''}
				aria-disabled={!emailEnabled || undefined}
				aria-describedby={!emailEnabled ? 'email-master-note' : undefined}
				onchange={handleDigestChange}
				aria-label={texts.pages.profile.notifications.digestToggleLabel}
				classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
			/>
		</div>
		<input type="hidden" name="digestEmails" value={digestEnabled ? 'on' : ''} />
		{#if !emailEnabled}
			<p id="email-master-note" class="text-xs text-tinte-600 dark:text-tinte-400 mt-2 pl-4">
				{texts.pages.profile.notifications.emailMasterNote}
			</p>
		{/if}
	</div>
</form>
