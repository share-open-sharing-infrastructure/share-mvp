<script lang="ts">
	import { Alert, Button } from 'flowbite-svelte';
	import UserItemCard from './UserItemCard.svelte';
	import ItemModal from './ItemModal.svelte';
	import type { Item } from '$lib/types/models';
	import AddButton from './AddButton.svelte';
	import SuccessAlert from '$lib/SuccessAlert.svelte';
	import ErrorAlert from '$lib/ErrorAlert.svelte';

	let { data, form } = $props();

	let showAddModal = $state(false);

	function getItemImageUrl(item: Item, baseUrl: string): string {
		return `${baseUrl}api/files/${item?.collectionId}/${item?.id}/${item?.image}`;
	}

	function formattedDate() {
		const date = new Date(data.user.created);
		return date.toLocaleDateString('de-DE', {
			day: '2-digit',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<section class="bg-white dark:bg-gray-900">
	<div class="max-w-7xl mx-auto">
		<div class="grid grid-cols-1 px-4 pt-6 xl:grid-cols-2 xl:gap-4 dark:bg-gray-900">
			<div class="mb-4 col-span-full xl:mb-2">
				<h1 class="text-xl font-semibold text-gray-900 sm:text-2xl">Dein Profil</h1>
			</div>
			<div class="col-span-full">
				<div
					class="p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow-sm 2xl:col-span-2 dark:border-gray-700 sm:p-6 dark:bg-gray-800"
				>
					<form method="POST" action="?/saveProfile">
						<div class="grid grid-cols-6 gap-6">
							<div class="col-span-6 sm:col-span-3">
								<label for="username" class="block mb-2 text-sm font-medium text-gray-900"
									>Nutzername:</label
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
								<label for="location" class="block mb-2 text-sm font-medium text-gray-900"
									>Standort/Postleitzahl:</label
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
								<label for="country" class="block mb-2 text-sm font-medium text-gray-900"
									>Registriert seit:</label
								>
								<div class="mt-2"><span class="italic text-lg">{formattedDate()}</span></div>
							</div>
							<div class="col-span-6 sm:col-span-3">
								<label for="mail" class="block mb-2 text-sm font-medium text-gray-900"
									>Mailadresse:</label
								>
								<div class="mt-2"><span class="italic text-lg">{data.user.email}</span></div>
								<p id="helper-text-explanation" class="mt-2.5 text-sm text-body">
									Deine Mailadresse kannst du <a
										href="/updatemail"
										class="font-medium primary-text hover:underline">hier</a
									> ändern.
								</p>
							</div>

							<div class="col-span-6 sm:col-full">
								<Button class="min-button" type="submit">Speichern</Button>
							</div>
						</div>
					</form>
					{#if form?.success}
						<SuccessAlert/>
					{:else if form?.error}
						<ErrorAlert errorMessage={form?.message} />
					{/if}
				</div>

				<div class="col-span-2">
					{#if form?.fail}
						<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
							<Alert>
								<span class="font-medium">
									{form.message}
								</span>
							</Alert>
						</div>
					{/if}

					<div class="mb-4 col-span-full xl:mb-2">
						<h1 class="text-xl font-semibold text-gray-900 sm:text-2xl mt-20 mb-6">
							Du verleihst
							{#if data?.user?.expand?.items_via_owner?.length}
								<span class="primary-text">{data.user.expand.items_via_owner.length}</span> Ding(e)...
							{:else}
								noch keine Ding(e)...
							{/if}
						</h1>
					</div>
					<div class="grid gap-8 mb-2 lg:mb-16 md:grid-cols-2 grid-cols-1">
						{#if data?.user?.expand?.items_via_owner?.length}
							{#each data.user.expand.items_via_owner as item}
								<UserItemCard {item} {data} imgUrl={getItemImageUrl(item, data.PB_URL)} />
							{/each}
							<AddButton
								onclick={() => {
									showAddModal = true;
								}}
								floating={true}
							/>
						{:else}
							<div class="flex flex-col items-center text-center text-gray-500">
								<p>Bisher verleihst du noch keine Gegenstände.</p>
								<AddButton
									onclick={() => {
										showAddModal = true;
									}}
									floating={false}
								/>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" />
