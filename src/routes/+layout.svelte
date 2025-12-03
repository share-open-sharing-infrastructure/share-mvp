<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Flash from '$lib/Flash.svelte';
	import '../app.css';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
	import { Footer, FooterBrand, FooterLinkGroup, FooterLink } from "flowbite-svelte";
	import share_logo from '$lib/images/share_logo.png';
	import { APP_NAME } from '$lib/names';


	let { children, data } = $props();

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
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">{APP_NAME}</span>
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
			<NavLi href="/logout" onclick={logout}>Logout</NavLi>
		{/if}
	</NavUl>
</Navbar>

{#if data.flash}
  <Flash flash={data.flash} />
{/if}

{@render children()}

<Footer footerType="socialmedia">
  <div class="mx-auto my-10 max-w-screen-xl text-center">
    <FooterBrand href="#" src={share_logo} alt="share Logo" name="" aClass="flex justify-center items-center text-2xl font-semibold text-gray-900 dark:text-white" />
    <p class="my-6 text-gray-500 dark:text-gray-400">Ein gemeinnütziger open-source Verleih-Marktplatz. Für alle.</p>
    <FooterLinkGroup class="mb-6 flex flex-wrap items-center justify-center text-gray-900 dark:text-white">
      <FooterLink aClass="mr-4 hover:underline md:mr-6" href="/org/about">Über</FooterLink>
      <FooterLink aClass="mr-4 hover:underline md:mr-6" href="/org/imprint">Impressum</FooterLink>
      <FooterLink aClass="mr-4 hover:underline md:mr-6" href="/org/contact">Kontakt</FooterLink>
    </FooterLinkGroup>
    <span class="text-sm text-gray-500 sm:text-center dark:text-gray-400">
      © 2025-2026 <a href="#" class="hover:underline">{APP_NAME}™</a>
      . All Rights Reserved.
    </span>
  </div>
</Footer>