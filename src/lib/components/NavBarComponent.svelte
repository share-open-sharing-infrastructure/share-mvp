<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import {
		Navbar,
		NavBrand,
		NavLi,
		NavUl,
		NavHamburger,
		Dropdown,
		DropdownItem,
		DropdownDivider,
	} from 'flowbite-svelte';

	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { page } from '$app/state';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';

	let { loggedIn } = $props();

	let activeUrl = $derived(page.url.pathname);

	async function logout(): Promise<void> {
		await fetch('/auth/logout', {
			method: 'POST',
		});

		await invalidateAll();

		goto(resolve('/'));
	}
</script>

<Navbar>
	<NavBrand href={resolve('/')}>
		<!-- <img src="/images/flowbite-svelte-icon-logo.svg" class="me-3 h-6 sm:h-9" alt="Flowbite Logo" /> -->
		<span
			class="text-accent self-center text-xl font-semibold whitespace-nowrap logo"
			>{texts.names.app}</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl
		{activeUrl}
		classes={{
			active: 'text-accent color-accent bg-transparent',
			nonActive: 'text-black hover:text-accent bg-transparent',
		}}
	>
		<NavLi href={resolve('/search')}>{texts.nav.search}</NavLi>
		{#if !loggedIn}
			<NavLi href={resolve('/auth/login')}>{texts.nav.login}</NavLi>
			<NavLi href={resolve('/auth/register')}>{texts.nav.register}</NavLi>
		{/if}
		{#if loggedIn}
			<NavLi href={resolve('/conversations')}>{texts.nav.requests}</NavLi>
			<NavLi class="cursor-pointer"
				>Soziales<ChevronDownOutline
					class="text-primary-800 inline h-6 w-6 dark:text-white"
				/></NavLi
			>
			<Dropdown simple class="w-44">
				<DropdownItem href={resolve('/social')}>{texts.nav.social}</DropdownItem
				>
				<!-- <DropdownItem href={resolve('/groups')}>Gruppen</DropdownItem> -->
				<!-- <DropdownItem href={resolve('/users')}>Personen</DropdownItem> -->
			</Dropdown>
			<NavLi class="cursor-pointer"
				>Profil<ChevronDownOutline
					class="text-primary-800 inline h-6 w-6 dark:text-white"
				/></NavLi
			>
			<Dropdown simple class="w-44">
				<DropdownItem href={resolve('/user/items')}
					>{texts.nav.myItems}</DropdownItem
				>
				<DropdownItem href={resolve('/user/profile')}
					>{texts.nav.myProfile}</DropdownItem
				>
				<DropdownDivider />
				<DropdownItem href={resolve('/auth/logout')} onclick={logout}
					>{texts.nav.logout}</DropdownItem
				>
			</Dropdown>
		{/if}
	</NavUl>
</Navbar>
