<script lang="ts">
	import { texts } from '$lib/texts';
	import { instance } from '$lib/instance';
	import { GithubSolid, LinkedinSolid, EnvelopeOutline } from 'flowbite-svelte-icons';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const members = instance.team;
</script>

<SeoHead
	title={texts.seo.about.title}
	description={texts.seo.about.description}
	canonical
/>

<!-- Mission -->
<section class="px-4 py-8">
	<div class="mx-auto max-w-2xl">
		<h2 class="mb-4 text-2xl font-bold text-tinte-900 text-center">
			{texts.pages.about.missionHeading}
		</h2>
		<p class="leading-relaxed text-tinte-500 text-center">
			{texts.pages.about.missionBody}
		</p>
	</div>
</section>

<!-- Team -->
<section class="px-4 py-8">
	<div class="mx-auto max-w-4xl">
		<h2 class="mb-10 text-center text-2xl font-bold text-tinte-900">
			{members.length > 0 ? texts.pages.about.teamHeading : texts.pages.about.joinTeamHeading}
		</h2>
		<div class="flex flex-wrap justify-center gap-10">
			{#each members as member (member.id)}
				<div class="flex max-w-45 flex-col items-center gap-2 text-center">
					<img
						src={member.src}
						alt={member.alt}
						class="h-36 w-36 rounded-full object-cover"
					/>
					<div>
						<p class="font-semibold text-tinte-900">{member.name}</p>
						<p class="text-sm text-tinte-500">{member.jobTitle}</p>
					</div>
					<p class="text-sm italic text-tinte-400">„{member.description}"</p>
					<div class="mt-1 flex gap-3">
						<a
							href={member.linkedIn}
							target="_blank"
							rel="external noopener noreferrer"
							class="text-tinte-400 hover:text-accent"
							aria-label={texts.pages.about.linkedInAriaLabel}
						>
							<LinkedinSolid class="h-5 w-5" />
						</a>
						{#if member.gitHub}
							<a
								href={member.gitHub}
								target="_blank"
								rel="external noopener noreferrer"
								class="text-tinte-400 hover:text-accent"
								aria-label={texts.pages.about.gitHubAriaLabel}
							>
								<GithubSolid class="h-5 w-5" />
							</a>
						{/if}
					</div>
				</div>
			{/each}
			<div class="flex max-w-45 flex-col items-center gap-2 text-center">
				<div class="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-primary-300 bg-primary-50">
					<EnvelopeOutline class="h-8 w-8 text-primary-400" />
				</div>
				<div>
					<p class="font-semibold text-tinte-900">{texts.pages.about.joinCardName}</p>
					<p class="text-sm text-tinte-500">{texts.pages.about.joinCardPrompt}</p>
				</div>
				<p class="text-sm italic text-tinte-400">„{texts.pages.about.joinCardTagline}"</p>
				<a
					href={`mailto:${texts.names.mainContactMail}?subject=${encodeURIComponent(texts.pages.about.joinMailSubject)}`}
					rel="external"
					class="mt-1 text-tinte-400 hover:text-accent"
					aria-label={texts.pages.about.contactAriaLabel}
				>
					<EnvelopeOutline class="h-5 w-5" />
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Open-Source -->
<section class="px-4 py-8">
	<div class="mx-auto max-w-2xl">
		<div class="rounded-2xl border border-gray-200 bg-white p-8 text-center">
			<GithubSolid class="mx-auto mb-4 h-10 w-10 text-tinte-900" />
			<h2 class="mb-3 text-2xl font-bold text-tinte-900">
				{texts.pages.about.openSourceHeading}
			</h2>
			<p class="mb-6 text-tinte-500">
				{texts.pages.about.openSourceBody}
			</p>
			<Button
				href={instance.links.github}
				target="_blank"
				rel="noopener noreferrer"
			>
				<GithubSolid class="h-5 w-5" />
				{texts.pages.about.viewOnGithubButton}
			</Button>
		</div>
	</div>
</section>
