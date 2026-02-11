<script lang="ts">
	let { img, number, headline, text } = $props();
</script>

<div
	class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
>
	<div class="grid gap-0 md:grid-cols-5">
		<!-- Image -->
		<img
			src={img}
			alt={headline}
			class="object-cover h-full md:col-span-2 items-center justify-center"
		/>

		<!-- Content -->
		<div class="p-6 md:col-span-3">
			<div class="flex items-start gap-3">
				<span
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white"
					>{number}</span
				>
				<div>
					<h3 class="text-lg font-semibold leading-snug">
						{headline}
					</h3>
					<div class="mt-3 space-y-2 text-sm leading-relaxed text-gray-600">
						{text}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
