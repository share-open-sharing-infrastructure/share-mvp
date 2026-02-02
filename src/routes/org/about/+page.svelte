<script lang="ts">
	import { APP_NAME } from '$lib/names';
	  import { Section, TeamWrapper, TeamHeader, TeamBody, TeamItem, GitHub } from "flowbite-svelte-blocks";

  let members = [
    {
      linkedIn: "https://www.linkedin.com/in/matteo-ramin/",
      gitHub: "https://github.com/MaRaMinden",
      src: "https://avatars.githubusercontent.com/u/7858896?v=4",
      alt: "Matteo Ramin",
      name: "Matteo Ramin",
      jobTitle: "Initiator & Projektleiter",
      description: "Macht halt einfach!"
    },
    {
      linkedIn: "https://www.linkedin.com/in/timo-johner",
      gitHub: "https://github.com/timojohlo",
      src: "https://avatars.githubusercontent.com/u/32620814?v=4",
      alt: "Timo Johner",
      name: "Timo Johner",
      jobTitle: "Initiator & Technik-Guru",
      description: "Ohne den läuft hier kein Server."
    }
  ];
</script>

<Section name="team">
  <h1 class="mb-4 text-2xl font-bold">Über AllerLeih</h1>
  <div class="font-light text-gray-500 sm:text-xl lg:mb-16 dark:text-gray-400">
    <p>
      {APP_NAME} ist eine gemeinnützige open-source Verleih-Plattform, die es Menschen ermöglicht, Gegenstände
      in ihrer Gemeinschaft zu teilen und zu verleihen.
    </p>
    <br />
    <p>
      Unser Ziele sind es, den Zugang zu Ressourcen zu erleichtern, Umweltbelastungen zu reduzieren
      und lokale Gemeinschaften zu stärken. Im Gegensatz zu anderen Plattformen steht bei uns diese Wirkung im Vordergrund.
    </p>
    <br />
    <p>
      {APP_NAME} ist quelloffen und lebt von der Gemeinschaft. Den Quellcode findest du auf
      <a href="https://github.com/share-open-sharing-infrastructure/share-mvp" class="underline" target="_blank"
        >GitHub</a
      >. Wir freuen uns über Beiträge, Feedback und Unterstützung!
    </p>
  </div>
  <TeamWrapper class="p-0 lg:p-0">
    <TeamHeader h2Class="text-2xl mt-8" >
      {#snippet label()}Das Team{/snippet}
      <p class="font-light text-xl font-bold"></p>
    </TeamHeader>
    <TeamBody>
      {#each members as { linkedIn, gitHub, src, alt, name, jobTitle, description }}
        <TeamItem href={linkedIn} {src} {alt} {name} {jobTitle} imgClass="rounded-lg aspect-square object-cover h-32">
          <p class="mt-3 mb-4 font-light text-gray-500 dark:text-gray-400">
            {description}
          </p>
          <!-- svelte-ignore block_empty -->
          {#snippet social()}
          {/snippet}
        </TeamItem>
      {/each}
    </TeamBody>
  </TeamWrapper>
</Section>