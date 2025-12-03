<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Flash from '$lib/Flash.svelte';
	import '../app.css';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, GradientButton, Modal } from 'flowbite-svelte';

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
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">AllerLeih</span>
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

<GradientButton
	color="redToYellow" 
	pill
	onclick={() => {feedbackModalNotion = true}}
			
	class="
		fixed               /* take it out of the normal flow */
		bottom-10 left-10    /* position in the corner */
		z-50                /* above other content */
	">
	Feedback geben
</GradientButton>

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

