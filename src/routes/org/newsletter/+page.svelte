<script>
	import { MAIN_CONTACT_MAIL } from '$lib/names';
	import { Button, Input, Label } from 'flowbite-svelte';
	import { Register, Section } from 'flowbite-svelte-blocks';
</script>

<div class="mx-auto max-w-screen-sm text-center">
	<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
		AllerLeih News
	</h2>
	<p class="font-light text-gray-500 lg:mb-2 sm:text-xl dark:text-gray-400">
		Vielen Dank für dein Interesse an AllerLeih! Trage unten deine E-Mail ein, um regelmäßige Infos
		und Neuigkeiten von uns zu bekommen.
	</p>
</div>
<Section name="login">
	<Register class="w-md">
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form
				action="https://app.keila.io/forms/nfrm_b94Bj5RD"
				class="flex flex-col gap-2"
				method="post"
			>
				<Label for="contact_email">E-Mail</Label>
				<Input
					id="contact_email"
					name="contact[email]"
					type="email"
					placeholder="E-Mail"
					class="focus:border-primary-700 focus:ring-primary-700"
				/>
				<Label for="contact_first_name">Vorname</Label>
				<Input
					id="contact_first_name"
					name="contact[first_name]"
					placeholder="Vorname"
					type="text"
					class="focus:border-primary-700 focus:ring-primary-700"
					required
				/>
				<input aria-hidden="true" autocomplete="off" name="h[url]" style="display: none" />
				<Button
					type="submit"
					class="
						me-2 mb-2 w-full rounded-lg 
						min-button px-5 py-2.5 text-sm font-medium text-white 
						hover:bg-primary-500 focus:ring-4 focus:ring-primary-300 focus:outline-none 
						dark:border-primary-700 dark:bg-primary-700 
						dark:hover:bg-primary-800 dark:focus:ring-primary-700
						cursor-pointer
						">Für Newsletter registrieren</Button
				>
			</form>
			<div class="text-xs">
				Wir senden keinen Spam und schicken maximal 1x pro Monat eine Mail. Deine Daten liegen
				sicher auf europäischen Servern bei unserem open-source Newsletter-Anbieter <a
					href="https://www.keila.io/de"
					class="text-blue-500 underline">keila.io</a
				>. Wenn du dich abmelden willst, schicke uns einfach eine Mail an
				<a
					href="mailto:{MAIN_CONTACT_MAIL}?subject=Newsletter%20Abmeldung&body=Bitte%20nehmt%20mich%20aus%20dem%20Newsletter!"
					class="text-blue-500 underline">{MAIN_CONTACT_MAIL}</a
				>.
			</div>
		</div>
	</Register>
</Section>