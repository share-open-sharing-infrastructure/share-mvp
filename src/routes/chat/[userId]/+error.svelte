<script lang="ts">
	import { page } from '$app/state';
</script>

<span>{page.error.message}</span>
<span>Something went wrong. Did you try to reach someone you can't reach?</span>