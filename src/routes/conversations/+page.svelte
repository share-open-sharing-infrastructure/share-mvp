<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
</script>

<div class="mx-auto max-w-screen-sm p-4 text-sm">
	<p>
		{texts.ui.chooseFromList}
		Gegenstandes abzusprechen.
	</p>
	<br />
	<p>
		{texts.ui.noRequestsYet}
		<a href={resolve('/search')} class="text-primary-700 hover:underline"
			>Suche</a
		>, um Gegenstände in deiner Umgebung zu finden und eine neue Unterhaltung zu
		starten.
	</p>
</div>
