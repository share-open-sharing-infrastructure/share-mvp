<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Flash from '$lib/Flash.svelte';
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
	import FeedbackForm from '$lib/FeedbackForm.svelte';

	let { children, data } = $props();

	let isFeedbackModalOpen = $state(false);

	async function logout() {
		const res = await fetch('/logout', {
			method: 'POST',
		});

		await invalidateAll();

		if (res.redirected) {
			goto(res.url);
		} else {
			goto('/');
		}
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
				<NavLi href="/login">Login</NavLi>
				<NavLi href="/register">Registrieren</NavLi>
			{/if}
			<NavLi href="/search">Suche</NavLi>
			{#if data.currentUser}
				<NavLi href="/conversations">Anfragen</NavLi>
				<NavLi href="/profile">Meine Dinge</NavLi>
				<NavLi href="/social">Soziales</NavLi>
				<NavLi href="/logout" onclick={logout}>Logout</NavLi>
			{/if}
		</NavUl>
	</Navbar>

	<main class="flex-1">
		{#if data.flash}
			<Flash flash={data.flash} />
		{/if}

		{@render children()}
	</main>

	<Button
		pill
		onclick={() => {
			isFeedbackModalOpen = true;
		}}
		class="
				min-button
				fixed bottom-10 left-10 z-50
				cursor-pointer
			"
	>
		Feedback geben
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
					href="/org/about">Über</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/imprint">Impressum</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/contact">Kontakt</FooterLink
				>
				<FooterLink
					classes={{ link: 'mr-4 hover:underline md:mr-6' }}
					href="/org/newsletter">Newsletter</FooterLink
				>
			</FooterLinkGroup>
			<span class="text-sm text-gray-500 sm:text-center dark:text-gray-400">
				© 2026 <a href="/" class="hover:underline">{APP_NAME}</a>
			</span>
		</div>
	</Footer>
</div>
