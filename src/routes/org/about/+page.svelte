<script lang="ts">
	import { APP_NAME } from '$lib/names';
	  import { Section, TeamWrapper, TeamHeader, TeamBody, TeamItem, Facebook, GitHub, Twitter } from "flowbite-svelte-blocks";

  let members = [
    {
      href: "/",
      src: "https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/bonnie-green.png",
      alt: "Bonnie Green",
      name: "Bonnie Green",
      jobTitle: "CEO & Web Developer",
      description: "Bonnie drives the technical strategy of the flowbite platform and brand."
    },
    {
      href: "/",
      src: "https://flowbite.s3.amazonaws.com/blocks/marketing-ui/avatars/jese-leos.png",
      alt: "Jese Leos",
      name: "Jese Leos",
      jobTitle: "CTO",
      description: "Jese drives the technical strategy of the flowbite platform and brand."
    }
  ];
</script>

<h1 class="mb-4 text-2xl font-bold">Über {APP_NAME}</h1>
<div>
	<p>
		{APP_NAME} ist eine gemeinnützige open-source Verleih-Plattform, die es Menschen ermöglicht, Gegenstände
		in ihrer Gemeinschaft zu teilen und zu verleihen.
	</p>
	<br />
	<p>
		Unser Ziel ist es, den Zugang zu Ressourcen zu erleichtern, die Umweltbelastung zu reduzieren
		und das Gemeinschaftsgefühl zu stärken.
	</p>
	<br />
	<p>
		{APP_NAME} ist quelloffen und lebt von der Gemeinschaft. Den Quellcode findest du auf
		<a href="https://github.com/share-open-sharing-infrastructure/share-mvp" class="underline"
			>GitHub</a
		>. Wir freuen uns über Beiträge, Feedback und Unterstützung!
	</p>
</div>

<Section name="team">
  <TeamWrapper>
    <TeamHeader>
      {#snippet label()}Our Team{/snippet}
      <p class="font-light text-gray-500 sm:text-xl lg:mb-16 dark:text-gray-400">Explore the whole collection of open-source web components and elements built with the utility classes from Tailwind</p>
    </TeamHeader>
    <TeamBody>
      {#each members as { href, src, alt, name, jobTitle, description }}
        <TeamItem {href} {src} {alt} {name} {jobTitle}>
          <p class="mt-3 mb-4 font-light text-gray-500 dark:text-gray-400">
            {description}
          </p>
          {#snippet social()}
            <Facebook href="/" />
            <GitHub href="/" />
            <Twitter href="/" />
          {/snippet}
        </TeamItem>
      {/each}
    </TeamBody>
  </TeamWrapper>
</Section>