<script>
	import { Button, Input, Label } from 'flowbite-svelte';
	import { Register, Section } from 'flowbite-svelte-blocks';
	import { texts } from '$lib/texts';
</script>

<div class="mx-auto text-center">
	<h2
		class="mb-4 text-4xl tracking-tight font-extrabold text-tinte-900 dark:text-white"
	>
		AllerLeih News
	</h2>
	<p class="font-light text-tinte-500 lg:mb-2 sm:text-xl dark:text-tinte-400">
		Vielen Dank für dein Interesse an AllerLeih! Trage unten deine E-Mail ein,
		um regelmäßige Infos und Neuigkeiten von uns zu bekommen.
	</p>
</div>
<Section name="login">
	<Register class="w-full">
		<div class="space-y-4 p-4">
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
				<input
					aria-hidden="true"
					autocomplete="off"
					name="h[url]"
					style="display: none"
				/>
				<Button
					type="submit"
					class="
						me-2 mt-3 w-full min-button bg-primary cursor-pointer">{texts.buttons.newsletter}</Button
				>
			</form>
			<div class="text-xs">
				Wir senden keinen Spam und schicken maximal 1x pro Monat eine Mail.
				Deine Daten liegen sicher auf europäischen Servern bei unserem
				open-source Newsletter-Anbieter <a
					href="https://www.keila.io/de"
					class="text-primary-500 underline">keila.io</a
				>. Wenn du dich abmelden willst, schicke uns einfach eine Mail an
				<a
					href="mailto:{texts.names
						.mainContactMail}?subject=Newsletter%20Abmeldung&body=Bitte%20nehmt%20mich%20aus%20dem%20Newsletter!"
					class="text-primary-500 underline">{texts.names.mainContactMail}</a
				>.
			</div>
		</div>
	</Register>
</Section>
