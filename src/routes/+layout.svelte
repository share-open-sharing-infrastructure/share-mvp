<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import '../app.css';
	import {
		Navbar,
		NavBrand,
		NavLi,
		NavUl,
		NavHamburger,
		Button,
		Modal,
	} from 'flowbite-svelte';
	import {
		Footer,
		FooterBrand,
		FooterLinkGroup,
		FooterLink,
	} from 'flowbite-svelte';
	import { APP_NAME } from '$lib/names';
	import FeedbackForm from '$lib/components/FeedbackForm.svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	let { children, data } = $props();

	let isFeedbackModalOpen = $state(false);

	async function logout(): Promise<void> {
		await fetch('/logout', {
			method: 'POST',
		});

		await invalidateAll();

		goto(resolve('/'));
	}
</script>

<div class="min-h-screen flex flex-col">
	<Navbar>
		<NavBrand href="/">
			<!-- img src="src/lib/images/share_logo.png" class="me-3 h-6 sm:h-9" alt="Logo" /> -->
			<span
				class="self-center text-xl font-semibold whitespace-nowrap dark:text-white logo"
				>{APP_NAME}</span
			>
		</NavBrand>
		<NavHamburger />
		<NavUl>
			{#if !data.currentUser}
				<NavLi href="/login">{texts.nav.login}</NavLi>
				<NavLi href="/register">{texts.nav.register}</NavLi>
			{/if}
			<NavLi href="/search">{texts.nav.search}</NavLi>
			{#if data.currentUser}
				<NavLi href="/conversations">{texts.nav.requests}</NavLi>
				<NavLi href="/profile">{texts.nav.myItems}</NavLi>
				<NavLi href="/social">{texts.nav.social}</NavLi>
				<NavLi href="/logout" onclick={logout}>{texts.nav.logout}</NavLi>
			{/if}
		</NavUl>
	</Navbar>

	<main class="flex-1">
		{@render children()}
	</main>

	<Button
		pill
		onclick={(): void => {
			isFeedbackModalOpen = true;
		}}
		class="
				min-button
				fixed bottom-10 left-10 z-50
				cursor-pointer
			"
	>
		Feedback
	</Button>

	<Modal bind:open={isFeedbackModalOpen} size="sm" title="Feedback geben">
		<FeedbackForm />
	</Modal>

	<!-- to set bg color assign class="bg-primary-50"-->
	<Footer footerType="socialmedia" class="">
		<div class="mx-auto my-10 max-w-screen-xl text-center">
			<FooterBrand
				href="#"
				alt="share Logo"
				name=""
				aClass="flex justify-center items-center text-md logo font-semibold text-gray-900 dark:text-white"
			>
				{APP_NAME}
			</FooterBrand>
			<p class="my-6 text-gray-500 dark:text-gray-400">
				Ein gemeinnütziger open-source Verleih-Marktplatz. Für alle.
			</p>
			<FooterLinkGroup
				class="mb-6 flex flex-wrap items-center justify-center text-gray-900 dark:text-white"
			>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/about">{texts.nav.about}</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/imprint">{texts.nav.imprint}</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/contact">{texts.nav.contact}</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/newsletter">{texts.nav.newsletter}</FooterLink
				>
			</FooterLinkGroup>
			<span class="text-sm text-gray-500 sm:text-center dark:text-gray-400">
				© 2026 <a href={resolve('/')} class="hover:underline">{APP_NAME}</a>
			</span>
		</div>
	</Footer>
</div>
