<script lang="ts">
	import { texts } from '$lib/texts';
	import { GithubSolid, LinkedinSolid, EnvelopeOutline } from 'flowbite-svelte-icons';

	const members = [
		{
			id: 1,
			linkedIn: 'https://www.linkedin.com/in/matteo-ramin/',
			gitHub: 'https://github.com/MaRaMinden',
			src: 'https://avatars.githubusercontent.com/u/7858896?v=4',
			alt: 'Matteo Ramin',
			name: 'Matteo Ramin',
			jobTitle: 'Initiator & Koordinator',
			description: 'Macht irgendwie alles son bisschen!',
		},
		{
			id: 2,
			linkedIn: 'https://www.linkedin.com/in/timo-johner',
			gitHub: 'https://github.com/timojohlo',
			src: 'https://avatars.githubusercontent.com/u/32620814?v=4',
			alt: 'Timo Johner',
			name: 'Timo Johner',
			jobTitle: 'Initiator & Technik-Guru',
			description: 'Ohne den läuft hier kein Server.',
		},
	];
</script>

<svelte:head>
	<title>{texts.seo.about.title}</title>
	<meta name="description" content={texts.seo.about.description} />
	<meta property="og:title" content={texts.seo.about.title} />
	<meta property="og:description" content={texts.seo.about.description} />
	<meta property="og:type" content="website" />
	<link rel="canonical" href="https://allerleih.org/misc/about" />
</svelte:head>

<!-- Mission -->
<section class="px-4 py-8">
	<div class="mx-auto max-w-2xl">
		<h2 class="mb-4 text-2xl font-bold text-tinte-900 text-center">Was ist {texts.names.app}?</h2>
		<p class="leading-relaxed text-tinte-500 text-center">
			{texts.names.app} ermöglicht es Menschen und Organisationen, Gegenstände innerhalb ihrer Gemeinschaft zu teilen.
			Wir wollen das Teilen und Leihen so einfach machen, dass es selbstverständlich wird. 
			Dafür bauen wir diese Plattform, gründen eigene Leih-Orte und integrieren bestehende Verleihe. 
			Außerdem unterstützen wir andere dabei, eigene Leih-Orte zu gründen und AllerLeih in ihrer Region aufzubauen.
		</p>
	</div>
</section>

<!-- Team -->
<section class="px-4 py-8">
	<div class="mx-auto max-w-4xl">
		<h2 class="mb-10 text-center text-2xl font-bold text-tinte-900">Team</h2>
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
							aria-label="LinkedIn"
						>
							<LinkedinSolid class="h-5 w-5" />
						</a>
						{#if member.gitHub}
							<a
								href={member.gitHub}
								target="_blank"
								rel="external noopener noreferrer"
								class="text-tinte-400 hover:text-accent"
								aria-label="GitHub"
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
					<p class="font-semibold text-tinte-900">Du?</p>
					<p class="text-sm text-tinte-500">Hast du Lust?</p>
				</div>
				<p class="text-sm italic text-tinte-400">„Mach mit!"</p>
				<a
					href="mailto:kontakt@allerleih.org?subject=Interesse%20an%20Mitmachen%20Bei%20AllerLeih"
					rel="external"
					class="mt-1 text-tinte-400 hover:text-accent"
					aria-label="Kontakt aufnehmen"
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
			<h2 class="mb-3 text-2xl font-bold text-tinte-900">Open-Source</h2>
			<p class="mb-6 text-tinte-500">
				{texts.names.app} ist quelloffen. Das heißt, jeder kann den Quellcode einsehen, mitentwickeln und selber nutzen. Den Code findest du auf
				GitHub. Wir freuen uns über Beiträge, Feedback und Unterstützung!
			</p>
			<a
				href="https://github.com/share-open-sharing-infrastructure/share-mvp"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 rounded-lg bg-tinte-900 px-5 py-2.5 font-medium text-white hover:opacity-80"
			>
				<GithubSolid class="h-5 w-5" />
				Auf GitHub ansehen
			</a>
		</div>
	</div>
</section>
