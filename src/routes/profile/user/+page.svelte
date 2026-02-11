<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	import { Button } from 'flowbite-svelte';

	import CustomAlert from '$lib/components/CustomAlert.svelte';

	let { data, form } = $props();

	// function formattedDate(): string {
	// 	const date = new Date(data.user.created);
	// 	return date.toLocaleDateString('de-DE', {
	// 		day: '2-digit',
	// 		month: 'long',
	// 		year: 'numeric',
	// 	});
	// }
</script>

<main class="bg-white dark:bg-gray-900 min-h-screen">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
		<!-- Page Header -->
		<h1 class="text-3xl font-semibold text-gray-900 dark:text-white mb-8">
			{texts.ui.profileTitle}
		</h1>

		<!-- Profile Form Section -->
		<div
			class="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 p-6 sm:p-8"
		>
			{#if form}
				<div class="mb-6">
					<CustomAlert
						type={form.success ? 'success' : 'error'}
						message={form.message}
					/>
				</div>
			{/if}

			<form method="POST" action="?/saveProfile" class="space-y-6">
				<!-- Editable Fields Section -->
				<legend class="sr-only">Bearbeitbare Profilinformationen</legend>

				<!-- Username Field -->
				<div>
					<label
						for="username"
						class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
					>
						{texts.ui.username}
					</label>
					<input
						type="text"
						name="username"
						id="username"
						value={data.user.username}
						class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
						required
					/>
				</div>

				<!-- Location Field -->
				<div>
					<label
						for="city"
						class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
					>
						{texts.ui.location}
					</label>
					<input
						type="text"
						name="city"
						id="city"
						value={data.user.city}
						class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
						autocomplete="off"
					/>
				</div>
				<legend class="sr-only">Profilinformationen (schreibgeschützt)</legend>
				<!-- Email Field -->
				<div>
					<label
						for="email"
						class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
					>
						{texts.ui.emailAddress}
						<span
							class="rounded-lg text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
						>
							{data.user.email}
						</span>
						<span class="text-sm text-gray-600 dark:text-gray-400">
							(<a
								href={resolve('/updatemail')}
								class="font-medium primary-text hover:underline">ändern</a
							>).
						</span>
					</label>
				</div>

				<!-- Submit Button -->
				<div class="pt-4 justify-end flex">
					<Button class="min-button" type="submit">
						{texts.buttons.save}
					</Button>
				</div>
			</form>
		</div>
	</div>
</main>
