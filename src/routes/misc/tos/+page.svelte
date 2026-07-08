<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	const { data } = $props();
</script>

<SeoHead title={data.doc.title} />

<h1 class="mb-2 text-2xl font-bold">{data.doc.title}</h1>
<p class="mb-6 text-sm text-gray-500">Stand: {data.doc.effectiveDate} · Version {data.doc.version}</p>

<!-- Operator-managed legal text from the legal_documents collection — the exact
     same body is snapshotted into user_legal_acceptances on consent (display == record). -->
<div class="legal-prose max-w-none">
	<!-- Trusted, server-managed legal text (no user input). -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.doc.body}
</div>
