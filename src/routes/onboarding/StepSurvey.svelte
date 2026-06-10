<script lang="ts">
    import { texts } from '$lib/texts';
    import OnboardingButton from './OnboardingButton.svelte';

    interface Props {
        onNext: () => void;
    }

    let { onNext }: Props = $props();

    const tallyEmbedUrl = 'https://tally.so/widgets/embed.js';

    function getTally() {
        return (globalThis as typeof globalThis & { Tally?: { loadEmbeds: () => void } }).Tally;
    }

    function loadTallyEmbeds() {
        const tally = getTally();
        if (tally) {
            tally.loadEmbeds();
            return;
        }
        document.querySelectorAll<HTMLIFrameElement>('iframe[data-tally-src]:not([src])').forEach((el) => {
            el.src = el.dataset.tallySrc ?? '';
        });
    }

    function handleTallyMessage(event: MessageEvent) {
        if (typeof event.data !== 'string' || !event.data.includes('Tally.FormSubmitted')) return;
        onNext();
    }

    $effect(() => {
        if (getTally()) {
            loadTallyEmbeds();
        } else if (document.querySelector(`script[src="${tallyEmbedUrl}"]`) == null) {
            const script = document.createElement('script');
            script.src = tallyEmbedUrl;
            script.onload = loadTallyEmbeds;
            script.onerror = loadTallyEmbeds;
            document.body.appendChild(script);
        }

        window.addEventListener('message', handleTallyMessage);
        return () => window.removeEventListener('message', handleTallyMessage);
    });
</script>

<div>
    <h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.survey.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
		{texts.onboarding.survey.explanation}
	</p>

    <iframe
        data-tally-src="https://tally.so/embed/Pdropd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1"
        loading="eager"
        width="100%"
        height="0"
        frameborder="0"
        marginheight="0"
        marginwidth="0"
        title="AllerLeih Onboarding Questionnare"
    ></iframe>
</div>
<div class="flex flex-col gap-2 pt-1">
    <OnboardingButton type="button" variant="ghost" onclick={onNext}>
        {texts.onboarding.buttons.skip}
    </OnboardingButton>
</div>

