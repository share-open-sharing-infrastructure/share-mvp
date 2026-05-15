<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import { page } from '$app/state';
	import { texts } from '$lib/texts';
	import SparkleButton from './SparkleButton.svelte';
	import FeedbackForm from './FeedbackForm.svelte';

	let { class: className = '' } = $props<{ class?: string }>();
	let isFeedbackModalOpen = $state(false);

	function getPageName(pathname: string): string {
		const names: Record<string, string> = {
			'/': 'Startseite',
			'/search': texts.nav.search,
			'/conversations': texts.nav.requests,
			'/notifications': texts.nav.notifications,
			'/social': texts.nav.social,
			'/user/items': texts.nav.myItems,
			'/user/items/bulk-add': texts.nav.myItems,
			'/user/profile': texts.nav.myProfile,
			'/user/profile/updatemail': texts.nav.myProfile,
			'/user/import': texts.nav.myProfile,
			'/misc/about': texts.nav.about,
			'/misc/imprint': texts.nav.imprint,
			'/misc/contact': texts.nav.contact,
			'/misc/newsletter': texts.nav.newsletter,
			'/misc/newsletter/thanks': texts.nav.newsletter,
			'/misc/faq': texts.nav.faq,
			'/misc/guide': texts.nav.guide,
			'/misc/privacy': texts.nav.privacy,
			'/misc/tos': texts.nav.tos,
			'/auth/login': texts.nav.login,
			'/auth/register': texts.nav.register,
			'/auth/logout': texts.nav.logout,
			'/auth/reset': 'Passwort zurücksetzen',
			'/onboarding': 'Onboarding',
		};
		if (names[pathname]) return names[pathname];
		if (pathname.startsWith('/conversations/')) return texts.nav.requests;
		if (pathname.startsWith('/items/')) return 'Gegenstand';
		if (pathname.startsWith('/users/')) return 'Nutzerprofil';
		if (pathname.startsWith('/invite/')) return 'Einladung';
		return pathname;
	}

	const pageName = $derived(getPageName(page.url.pathname));
</script>

<SparkleButton
	label="Feedback"
	class={className}
	onclick={() => { isFeedbackModalOpen = true; }}
/>

<Modal bind:open={isFeedbackModalOpen} size="sm" title={`Feedback zur Seite "${pageName}" geben`}>
	<FeedbackForm {pageName} onsuccess={() => { isFeedbackModalOpen = false; }} />
</Modal>
