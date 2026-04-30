<script lang="ts">
	import { browser } from '$app/environment';
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
	import { BellOutline, ChevronDownOutline, ChevronRightOutline, GlobeOutline, UserCircleOutline } from 'flowbite-svelte-icons';
	import FeedbackButton from './FeedbackButton.svelte';

	let { loggedIn, currentUser, unreadCount = 0 } = $props<{
		loggedIn: boolean;
		currentUser: unknown;
		unreadCount?: number;
	}>();

	let activeUrl = $derived(page.url.pathname);
	let showTranslate = $derived(browser && !navigator.language.startsWith('de'));
	let deeplUrl = $derived(
		`https://www.deepl.com/translator#de/${browser ? navigator.language.split('-')[0] : 'en'}/`
	);

	async function logout(): Promise<void> {
		await fetch('/auth/logout', {
			method: 'POST',
		});

		await goto(resolve('/'));
		await invalidateAll();
	}
</script>

<Navbar class="bg-secondary-200 shadow-sm">
	<div class="flex items-center">
		<NavBrand href={resolve('/')}>
			<div class="relative flex flex-col items-center">
				<img src="/AllerLeih_logo.svg" alt={texts.names.app} class="h-16" />
				<span
						class="absolute top-5 text-[9px] font-bold tracking-widest uppercase border-2 border-red-500 text-red-500 rounded px-1 opacity-80 leading-tight pointer-events-none"
					>
						Beta
					</span>

			</div>
		</NavBrand>

		<FeedbackButton class="ml-5" />
	</div>
	{#if showTranslate}
		<button
			id="translate-btn"
			class="ml-auto mr-2 flex items-center gap-1 text-sm text-gray-500 hover:text-accent cursor-pointer"
		>
			<GlobeOutline class="h-4 w-4" />
			{texts.nav.translate}
		</button>
	{/if}
	<NavHamburger />
	<NavUl
		{activeUrl}
		classes={{
			active: 'text-accent! color-accent bg-transparent font-bold',
			nonActive: 'text-black hover:text-accent! bg-transparent',
		}}
	>
		<NavLi href={resolve('/search')}>{texts.nav.search}</NavLi>
		{#if !loggedIn}
			<NavLi href={resolve('/auth/login')}>{texts.nav.login}</NavLi>
			<NavLi href={resolve('/auth/register')}>{texts.nav.register}</NavLi>
		{/if}
		{#if loggedIn}
			<NavLi href={resolve('/conversations')}>{texts.nav.requests}</NavLi>
			<NavLi href={resolve('/social')}>{texts.nav.social}</NavLi>

			<NavLi href={resolve('/notifications')} class="relative">
				<span class="relative inline-flex items-center gap-1">
					<BellOutline class="h-5 w-5" />
					{#if unreadCount > 0}
						<span
							class="absolute -top-2 -right-3 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none"
						>
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					{/if}
				</span>
			</NavLi>
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
					onclick={logout}
					class="hover:text-danger hover:bg-transparent hover:cursor-pointer"
					>{texts.nav.logout}</DropdownItem
				>
			</Dropdown>
		{/if}
	</NavUl>

	{#if showTranslate}
		<Popover
			triggeredBy="#translate-btn"
			class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
			placement="bottom-end"
		>
			<div class="space-y-2 p-3">
				<h3 class="font-semibold text-gray-900 dark:text-white">
					{texts.nav.translateTitle}
				</h3>
				{texts.nav.translateBrowser}
				<a
					href={deeplUrl}
					target="_blank"
					rel="external noopener"
					class="text-accent hover:underline flex items-center font-medium mt-1"
				>
					{texts.nav.translateDeepL}
					<ChevronRightOutline class="text-accent h-4 w-4" />
				</a>
			</div>
		</Popover>
	{/if}
</Navbar>
