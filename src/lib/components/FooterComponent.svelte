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
	<div class="mx-auto max-w-7xl text-center">
		<FooterBrand
			href="#"
			alt="AllerLeih Logo"
			name=""
			aClass="flex justify-center items-center text-md logo text-accent font-semibold "
		>
			{texts.names.app}
		</FooterBrand>
		<p class="my-6 text-light">
			Ein gemeinnütziger open-source Verleih-Marktplatz. Für alle.
		</p>
		<FooterLinkGroup
			class="mb-6 flex flex-wrap items-center justify-center text-light"
		>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline hover:text-accent md:mr-6' }}
				href={resolve('/misc/about')}>{texts.nav.about}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline hover:text-accent md:mr-6' }}
				href={resolve('/misc/imprint')}>{texts.nav.imprint}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline hover:text-accent md:mr-6' }}
				href={resolve('/misc/contact')}>{texts.nav.contact}</FooterLink
			>
			<FooterLink
				classes={{ link: 'mr-4 hover:underline hover:text-accent md:mr-6' }}
				href={resolve('/misc/newsletter')}>{texts.nav.newsletter}</FooterLink
			>
		</FooterLinkGroup>
		<span class="text-sm text-accent sm:text-center">
			© 2026 <a href={resolve('/')} class="hover:underline">{texts.names.app}</a
			>
		</span>
	</div>
</Footer>
