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
		Modal
	} from 'flowbite-svelte';
	import { Footer, FooterBrand, FooterLinkGroup, FooterLink } from 'flowbite-svelte';
	import { APP_NAME } from '$lib/names';

	let { children, data } = $props();

	let feedbackModalNotion = $state(false);

	async function logout() {
		const res = await fetch('/logout', {
			method: 'POST'
		});

		await invalidateAll();

		if (res.redirected) {
			goto(res.url);
		} else {
			goto('/');
		}
	}
</script>

<Navbar>
	<NavBrand href="/">
		<!-- img src="src/lib/images/share_logo.png" class="me-3 h-6 sm:h-9" alt="Logo" /> -->
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white logo"
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
			<NavLi href="/chat">Chats</NavLi>
			<NavLi href="/profile">Profil</NavLi>
			<NavLi href="/social">Soziales</NavLi>
			<NavLi href="/logout" onclick={logout}>Logout</NavLi>
		{/if}
	</NavUl>
</Navbar>

<Button
	pill
	onclick={() => {
		feedbackModalNotion = true;
	}}
	class="
		min-button
		fixed bottom-10 left-10 z-50
		cursor-pointer
	"
>
	Feedback geben
</Button>

{#if data.flash}
	<Flash flash={data.flash} />
{/if}

{@render children()}
<Modal bind:open={feedbackModalNotion} size="lg" title="Feedback geben">
	<iframe
		title="Feedback Form"
		src="https://dismantle-capitalism.notion.site/ebd/2bc20d17d64980d798b8f4d1105c8bc0"
		width="100%"
		height="800"
		frameborder="0"
		allowfullscreen
	>
	</iframe>
</Modal>
<!-- to set bg color assign class="bg-primary-50"-->
<Footer footerType="socialmedia" class="">
	<div class="mx-auto my-10 max-w-screen-xl text-center">
		<FooterBrand
			href="#"
			alt="share Logo"
			name=""
			aClass="flex justify-center items-center text-md logo font-semibold text-gray-900 dark:text-white"
		> {APP_NAME} </FooterBrand>
		<p class="my-6 text-gray-500 dark:text-gray-400">
			Ein gemeinnütziger open-source Verleih-Marktplatz. Für alle.
		</p>
		<FooterLinkGroup
			class="mb-6 flex flex-wrap items-center justify-center text-gray-900 dark:text-white"
		>
			<FooterLink classes={{ link: 'mr-4 hover:underline md:mr-6' }} href="/org/about"
				>Über</FooterLink
			>
			<FooterLink classes={{ link: 'mr-4 hover:underline md:mr-6' }} href="/org/imprint"
				>Impressum</FooterLink
			>
			<FooterLink classes={{ link: 'mr-4 hover:underline md:mr-6' }} href="/org/contact"
				>Kontakt</FooterLink
			>
		</FooterLinkGroup>
		<span class="text-sm text-gray-500 sm:text-center dark:text-gray-400">
			© 2026 <a href="/" class="hover:underline">{APP_NAME}</a>
		</span>
	</div>
</Footer>
