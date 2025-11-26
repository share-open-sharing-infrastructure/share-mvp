<script lang="ts">
	import Flash from '$lib/Flash.svelte';
	import '../app.css';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';

	let { children, data } = $props();
</script>

<Navbar>
	<NavBrand href="/">
		<!-- img src="src/lib/images/share_logo.png" class="me-3 h-6 sm:h-9" alt="Logo" /> -->
		<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Share</span>
	</NavBrand>
	<NavHamburger />
	<NavUl>
		{#if !data.currentUser}
			<NavLi href="/login">Login</NavLi>
			<NavLi href="/register">Registrieren</NavLi>
		{/if}
		<NavLi href="/items">Gegenstände</NavLi>
		{#if data.currentUser}
			<NavLi href="/chat">Chats</NavLi>
			<NavLi href="/profile">Profil</NavLi>
			<NavLi class="cursor-pointer">
				<!-- This is a bit of an ugly solution, but I didn't find a better one yet -->
				<form method="POST" action="/logout">
					<button type="submit" class="cursor-pointer">
						Logout
					</button>
				</form>
			</NavLi>
		{/if}
	</NavUl>
</Navbar>

{#if data.flash}
  <Flash flash={data.flash} />
{/if}

{@render children()}
