<script>
	import { page } from '$app/state';
</script>
<p>Hupsi, da ist wohl was schiefgelaufen.</p>
<p>{page.status} {page.error.message}</p>