<script>
	import { Button, Input, Label } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
</script>

<svelte:head>
	<title>{texts.seo.newsletter.title}</title>
	<meta name="description" content={texts.seo.newsletter.description} />
	<meta property="og:title" content={texts.seo.newsletter.title} />
	<meta property="og:description" content={texts.seo.newsletter.description} />
	<meta property="og:type" content="website" />
	<link rel="canonical" href="https://allerleih.org/misc/newsletter" />
</svelte:head>

<div class="mx-auto max-w-md">
	<div class="rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
		<div class="mb-6 flex justify-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-primary-600 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
				</svg>
			</div>
		</div>

		<h2 class="mb-2 text-center text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
			AllerLeih News
		</h2>
		<p class="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
			Neuigkeiten und Community-Geschichten — maximal einmal pro Monat, kein Spam.
		</p>

		<form
			action="https://app.keila.io/forms/nfrm_b94Bj5RD"
			class="flex flex-col gap-4"
			method="post"
		>
			<div>
				<Label for="contact_email" class="mb-1">E-Mail</Label>
				<Input
					id="contact_email"
					name="contact[email]"
					type="email"
					placeholder="deine@mail.de"
					class="focus:border-primary-700 focus:ring-primary-700"
					required
				/>
			</div>
			<div>
				<Label for="contact_first_name" class="mb-1">Vorname</Label>
				<Input
					id="contact_first_name"
					name="contact[first_name]"
					placeholder="Vorname"
					type="text"
					class="focus:border-primary-700 focus:ring-primary-700"
					required
				/>
			</div>
			<!-- Keila bot-detection honeypot — must stay hidden and empty -->
			<input aria-hidden="true" autocomplete="off" name="h[url]" style="display: none" />
			<Button type="submit" class="mt-1 w-full min-button bg-primary-200 hover:bg-primary cursor-pointer">
				{texts.buttons.newsletter}
			</Button>
		</form>

		<p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
			Deine Daten liegen sicher auf europäischen Servern bei
			<a href="https://www.keila.io/de" class="underline hover:text-gray-600 dark:hover:text-gray-300">keila.io</a>.
			Abmelden jederzeit per Mail an
			<a
				href="mailto:{texts.names.mainContactMail}?subject=Newsletter%20Abmeldung&body=Bitte%20nehmt%20mich%20aus%20dem%20Newsletter!"
				class="underline hover:text-gray-600 dark:hover:text-gray-300"
			>{texts.names.mainContactMail}</a>.
		</p>
	</div>
</div>
