<script lang="ts">
    import { texts } from '$lib/texts';
    import Button from '$lib/components/ui/Button.svelte';
    import type { InstanceSurvey } from '$lib/instanceResolvers';

    // Configurable is the HOST (share-mvp#631, `$lib/instance.ts`'s `onboardingSurvey`), not the
    // PROTOCOL — this component stays Tally-specific (`Tally.FormSubmitted`, `data-tally-src`,
    // `Tally.loadEmbeds()`). A non-Tally onboarding survey provider is a bigger rewrite than a
    // configurable URL, so the function names below intentionally keep the `Tally`/`tally` prefix.
    //
    // `survey` instead of importing `$lib/instance` directly: the parent (`+page.svelte`) already
    // needs `instance.onboardingSurvey` to decide whether the `survey` step exists in the
    // sequence at all, and passing it down keeps this component testable without an env mock.
    // Bundled as the `InstanceSurvey` `$lib/instanceResolvers` already exports (`url`/`scriptUrl`/
    // `origin`), rather than three parallel string props.
    interface Props {
        onNext: () => void;
        survey: InstanceSurvey;
    }

    let { onNext, survey }: Props = $props();

    // Set only from `script.onerror` below (e.g. an ad-blocker, offline, or — the normal case for
    // a self-hoster on a non-Tally provider — a 404 on the derived `/widgets/embed.js`). Without
    // this, the iframe ships `height="0"` and relies entirely on Tally's `dynamicHeight` JS to
    // grow it; if that script never loads, the frame stays permanently 0px tall with nothing
    // telling a sighted or screen-reader user the embed failed.
    let surveyFailed = $state(false);

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
        // Possible only now that the survey origin is configured (share-mvp#631) — previously
        // ANY window could postMessage a fake "Tally.FormSubmitted" to skip this onboarding step.
        if (survey.origin && event.origin !== survey.origin) return;
        if (typeof event.data !== 'string' || !event.data.includes('Tally.FormSubmitted')) return;
        onNext();
    }

    $effect(() => {
        if (!survey.url) return;

        if (getTally()) {
            loadTallyEmbeds();
        } else if (![...document.scripts].some((s) => s.src === survey.scriptUrl)) {
            // A CSS-selector lookup (`document.querySelector('script[src="${scriptUrl}"]')`)
            // would build a selector out of an operator-controlled value — `EXTERNAL_FORM_URL_PATTERN`
            // already forbids quote characters, but there's no reason to construct a selector
            // out of it at all when a plain array scan does the same job.
            const script = document.createElement('script');
            script.src = survey.scriptUrl;
            script.onload = loadTallyEmbeds;
            script.onerror = () => {
                surveyFailed = true;
            };
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

    <!-- `surveyFailed` flips asynchronously from `script.onerror` AFTER this step has already
         rendered, so the message is a status message (WCAG 4.1.3), not initial paint — it needs a
         live region to reach a screen-reader user who isn't focused here. Same `aria-live="polite"`
         pattern as `src/routes/users/[id]/ItemsSection.svelte`. -->
    {#if surveyFailed}
        <p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed" role="status" aria-live="polite">
            {texts.onboarding.survey.loadFailed}
        </p>
    {:else}
        <iframe
            data-tally-src={survey.url}
            loading="eager"
            width="100%"
            height="0"
            frameborder="0"
            marginheight="0"
            marginwidth="0"
            title={texts.onboarding.survey.iframeTitle}
        ></iframe>
    {/if}
</div>
<div class="flex flex-col gap-2 pt-1">
    <Button variant="ghost" fullWidth onclick={onNext}>
        {texts.onboarding.buttons.skip}
    </Button>
</div>
