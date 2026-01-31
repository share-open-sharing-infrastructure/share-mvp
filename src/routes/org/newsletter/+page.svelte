<script>
	import { MAIN_CONTACT_MAIL } from '$lib/names';
</script>

<form action="https://app.keila.io/forms/nfrm_b94Bj5RD" class="flex flex-col gap-2" method="post">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="mb-4 text-4xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			AllerLeih News
		</h2>
		<p class="font-light text-gray-500 lg:mb-2 sm:text-xl dark:text-gray-400">
			Vielen Dank für dein Interesse an AllerLeih! Trage unten deine E-Mail ein, um regelmäßige
			Infos und Neuigkeiten von uns zu bekommen.
		</p>
	</div>
	<div class=""></div>
	<div class="flex flex-col">
		<label for="contact_email">E-Mail</label>
		<input id="contact_email" name="contact[email]" type="email" />
	</div>
	<div class="flex flex-col">
		<label for="contact_first_name">Vorname (optional)</label>
		<input id="contact_first_name" name="contact[first_name]" type="text" />
	</div>
	<input aria-hidden="true" autocomplete="off" name="h[url]" style="display: none" />
	<div class="flex justify-start">
		<button class="min-button p-2 w-full" type="submit"
			>Für den AllerLeih-Newsletter registrieren</button
		>
	</div>
	<div class="text-xs">
		Wir senden keinen Spam und schicken maximal 1x pro Monat eine Mail. Deine Daten liegen sicher
		auf europäischen Servern bei unserem open-source Newsletter-Anbieter <a
			href="https://www.keila.io/de"
			class="text-blue-500 underline">keila.io</a
		>. Wenn du dich abmelden willst, schicke uns einfach eine Mail an
		<a
			href="mailto:{MAIN_CONTACT_MAIL}?subject=Newsletter%20Abmeldung&body=Bitte%20nehmt%20mich%20aus%20dem%20Newsletter!"
			class="text-blue-500 underline">{MAIN_CONTACT_MAIL}</a
		>.
	</div>
</form>
