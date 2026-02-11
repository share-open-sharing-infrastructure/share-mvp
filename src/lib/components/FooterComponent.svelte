<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import {
		Footer,
		FooterBrand,
		FooterLink,
		FooterLinkGroup,
	} from 'flowbite-svelte';
</script>

<Footer footerType="socialmedia" class="">
	<div class="mx-auto my-10 max-w-screen-xl text-center">
		<FooterBrand
			href="#"
			alt="share Logo"
			name=""
			aClass="flex justify-center items-center text-md logo font-semibold text-gray-900 dark:text-white"
		>
			{texts.names.app}
		</FooterBrand>
		<p class="my-6 text-gray-500 dark:text-gray-400">
			Ein gemeinnütziger open-source Verleih-Marktplatz. Für alle.
		</p>
		<FooterLinkGroup
			class="mb-6 flex flex-wrap items-center justify-center text-gray-900 dark:text-white"
		>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline md:mr-6' }}
				href={resolve('/misc/about')}>{texts.nav.about}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline md:mr-6' }}
				href={resolve('/misc/imprint')}>{texts.nav.imprint}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline md:mr-6' }}
				href={resolve('/misc/contact')}>{texts.nav.contact}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline md:mr-6' }}
				href={resolve('/misc/newsletter')}>{texts.nav.newsletter}</FooterLink
			>
		</FooterLinkGroup>
		<span class="text-sm text-gray-500 sm:text-center dark:text-gray-400">
			© 2026 <a href={resolve('/')} class="hover:underline">{texts.names.app}</a>
		</span>
	</div>
</Footer>
