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
		Popover,
	} from 'flowbite-svelte';

	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { page } from '$app/state';
	import { BellOutline, ChevronDownOutline, ChevronRightOutline, UserCircleOutline } from 'flowbite-svelte-icons';

	let { loggedIn, currentUser, unreadCount = 0 } = $props<{
		loggedIn: boolean;
		currentUser: unknown;
		unreadCount?: number;
	}>();

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
		<div id="beta" class="relative flex flex-col items-center">
			<span class="absolute -top-2 -right-5 rotate-35 text-[9px] font-bold tracking-widest uppercase border-2 border-red-500 text-red-500 rounded px-1 opacity-80 leading-tight pointer-events-none">
				Beta
			</span>
			<div
				class="text-accent self-center text-xl font-semibold whitespace-nowrap logo leading-none"
				>{texts.names.app}</div>
			<div class="text-xs leading-none">Lüneburg</div>
		</div>
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
			<NavLi href={resolve('/notifications')} class="relative">
				<span class="relative inline-flex items-center gap-1">
					<BellOutline class="h-5 w-5" />
					{#if unreadCount > 0}
						<span class="absolute -top-2 -right-3 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					{/if}
				</span>
			</NavLi>
			<NavLi class="cursor-pointer"
				>Soziales<ChevronDownOutline
					class="text-primary-800 inline h-6 w-6 dark:text-white"
				/></NavLi
			>
			<Dropdown class="w-44 ">
				<DropdownItem href={resolve('/social')} class="hover:text-accent hover:bg-transparent"
					>{texts.nav.social}</DropdownItem
				>
				<!-- <DropdownItem href={resolve('/groups')}>Gruppen</DropdownItem> -->
				<!-- <DropdownItem href={resolve('/users')}>Personen</DropdownItem> -->
			</Dropdown>
			<NavLi class="cursor-pointer">
				<UserCircleOutline class="h-6 w-6 inline mr-1" />
				{currentUser?.username}
				<ChevronDownOutline
					class="text-primary-800 inline h-6 w-6 dark:text-white"
				/>
			</NavLi>
			<Dropdown simple class="w-44">
				<DropdownItem
					href={resolve('/user/items')}
					class="hover:text-accent hover:bg-transparent"
					>{texts.nav.myItems}</DropdownItem
				>
				<DropdownItem
					href={resolve('/user/profile')}
					class="hover:text-accent hover:bg-transparent"
					>{texts.nav.myProfile}</DropdownItem
				>
				<DropdownDivider />
				<DropdownItem
					href={resolve('/auth/logout')}
					onclick={logout}
					class="hover:text-danger hover:bg-transparent"
					>{texts.nav.logout}</DropdownItem
				>
			</Dropdown>
		{/if}
	</NavUl>
	
	<Popover
		triggeredBy="#beta"
		class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
		placement="bottom-start"
	>
		<div class="space-y-2 p-3">
			<h3 class="font-semibold text-gray-900 dark:text-white">
				Beta-Zugang
			</h3>
			Wir testen AllerLeih gerade in Lüneburg! Die Plattform kann noch Fehler haben und wird beständig verbessert. 
			Wenn du uns dabei unterstützen magst, frag uns gerne nach einem Zugang, nutze die Plattform und teile uns dein Feedback mit!
			<a
				href="mailto:allerleih@posteo.de?subject=Beta-Zugang%20AllerLeih&body=Hallo%20AllerLeih-Team%2C%0A%0Aich%20möchte%20gerne%20einen%20Beta-Zugang%20für%20AllerLeih%20beantragen."
				class="text-accent hover:underline flex items-center font-medium mt-1"
			>
				E-Mail an allerleih@posteo.de
				<ChevronRightOutline class="text-accent h-4 w-4" />
			</a>
		</div>
	</Popover>
</Navbar>
