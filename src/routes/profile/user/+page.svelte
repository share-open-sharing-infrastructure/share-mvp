<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	import { Button } from 'flowbite-svelte';
	
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import { enhance } from '$app/forms';


	let { data, form } = $props();

	function formattedDate(): string {
		const date = new Date(data.user.created);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: 'long',
			year: 'numeric',
		});
	}
</script>

<section class="bg-white dark:bg-gray-900">
	<div class="max-w-7xl mx-auto">
		<div
			class="grid grid-cols-1 px-4 pt-6 xl:grid-cols-2 xl:gap-4 dark:bg-gray-900"
		>
			<!-- HEADLINE -->
			<div class="mb-4 col-span-full xl:mb-2">
				<h1 class="text-xl font-semibold text-gray-900 sm:text-2xl">
					{texts.ui.profileTitle}
				</h1>
			</div>

			<!-- BODY -->
			<div class="col-span-full">
				<!-- PROFILE DATA -->
				<div
				class="p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow-sm 2xl:col-span-2 dark:border-gray-700 sm:p-6 dark:bg-gray-800"
				>
					{#if form}
						<CustomAlert type={form.success ? 'success' : 'error'} message={form.message} />
					{/if}
					<form method="POST" action="?/saveProfile" use:enhance>
						<div class="grid grid-cols-6 gap-6">
							<div class="col-span-6 sm:col-span-3">
								<label
									for="username"
									class="block mb-2 text-sm font-medium text-gray-900"
									>{texts.ui.username}</label
								>
								<input
									type="text"
									name="username"
									id="username"
									class="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
									value={data.user.username}
								/>
							</div>
							<div class="col-span-6 sm:col-span-3">
								<label
									for="location"
									class="block mb-2 text-sm font-medium text-gray-900"
									>{texts.ui.location}</label
								>
								<input
									type="text"
									name="city"
									id="city"
									class="shadow-sm bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
									placeholder={data.user.city}
									autocomplete="off"
								/>
							</div>
							<div class="col-span-6 sm:col-span-3">
								<label
									for="country"
									class="block mb-2 text-sm font-medium text-gray-900"
									>{texts.ui.registeredSince}</label
								>
								<div class="mt-2">
									<span class="italic text-lg">{formattedDate()}</span>
								</div>
							</div>
							<div class="col-span-6 sm:col-span-3">
								<label
									for="mail"
									class="block mb-2 text-sm font-medium text-gray-900"
									>{texts.ui.emailAddress}</label
								>
								<div class="mt-2">
									<span class="italic text-lg">{data.user.email}</span>
								</div>
								<p
									id="helper-text-explanation"
									class="mt-2.5 text-sm text-body"
								>
									Deine Mailadresse kannst du <a
										href={resolve('/updatemail')}
										class="font-medium primary-text hover:underline">hier</a
									> ändern.
								</p>
							</div>

							<div class="col-span-6 sm:col-full">
								<Button class="min-button" type="submit"
									>{texts.buttons.save}</Button
								>
							</div>
						</div>
					</form>
				</div>

			</div>
		</div>
	</div>
</section>

