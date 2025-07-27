<script lang="ts">
	import '../app.css';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from "flowbite-svelte";


	let { children } = $props();
</script>

<Navbar>
  <NavBrand href="/">
    <img src="src/lib/images/share_logo.png" class="me-3 h-6 sm:h-9" alt="Logo" />
    <!-- <span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Flowbite</span> -->
  </NavBrand>
  <NavHamburger />
  <NavUl>
    <NavLi href="/items">Gegenstände</NavLi>
    <NavLi href="/community">Community</NavLi>
    <NavLi href="/search">Search</NavLi>
    <NavLi href="/chat">Chat</NavLi>
  </NavUl>
</Navbar>


{@render children()}



