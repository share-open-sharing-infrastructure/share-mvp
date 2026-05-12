<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import {
		Footer,
		FooterBrand,
		FooterCopyright,
		FooterLink,
		FooterLinkGroup,
	} from 'flowbite-svelte';
</script>

<Footer footerType="socialmedia" class="mt-5">
	<div class="mx-auto max-w-7xl">
		<div class="md:flex md:justify-between">
			<div class="mb-6 mr-4 md:mb-0">
				<FooterBrand
					href={resolve('/')}
					alt="AllerLeih Logo"
					name=""
					aClass="flex items-center"
				>
					<img src="/AllerLeih.png" class="mr-3 h-12" alt={texts.names.app} />
					<p class="max-w-xs text-sm text-light">
						Ein gemeinnütziger Verleih-Marktplatz.<br/>
						Open-Source. Für Alle.
					</p>
				</FooterBrand>
			</div>
			<div class="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-6">
				<div>
					<h2
						class="mb-4 text-sm font-semibold uppercase text-gray-900 dark:text-white"
					>
						AllerLeih
					</h2>
					<FooterLinkGroup>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/guide')}
							>{texts.nav.guide}</FooterLink
						>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/newsletter')}
							>{texts.nav.newsletter}</FooterLink
						>
					</FooterLinkGroup>
				</div>
				<div>
					<h2
						class="mb-4 text-sm font-semibold uppercase text-gray-900 dark:text-white"
					>
						Über
					</h2>
					<FooterLinkGroup>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/about')}
							>{texts.nav.about}</FooterLink
						>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/contact')}
							>{texts.nav.contact}</FooterLink
						>
					</FooterLinkGroup>
				</div>
				<div>
					<h2
						class="mb-4 text-sm font-semibold uppercase text-gray-900 dark:text-white"
					>
						Social Media
					</h2>
					<FooterLinkGroup>
						<FooterLink
							classes={{ link: "hover:no-underline" }}
							class="mb-2 hover:text-accent"
							href="/api/redirect?to=https%3A%2F%2Fpixelfed.de%2FAllerLeih&source=footer"
							target="_blank"
							rel="noopener noreferrer"
							aria-label={texts.footer.pixelfed}
						>
							<span class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="50 150 900 900"
									fill="currentColor"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<path
										d="M500 176q-115 0 -215 58q-96 57 -152 153q-58 99 -58 214.5t58 214.5q56 96 152 152q100 58 215 58t215 -58q96 -56 152 -152q58 -99 58 -214.5t-58 -214.5q-56 -96 -152 -153q-100 -58 -215 -58zM432 435h112q36 0 66.5 17.5t48.5 47t18 65t-18 65t-48.5 47t-66.5 17.5h-78l-111 106v-290q0 -31 22.5 -53t54.5 -22z"
									/>
								</svg>
								<span>Pixelfed</span>
							</span>
						</FooterLink>
						<FooterLink
							classes={{ link: "hover:no-underline" }}
							class="mb-2 hover:text-accent"
							href="/api/redirect?to=https%3A%2F%2Fnorden.social%2F%40AllerLeih&source=footer"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="{texts.footer.mastodon}}"
						>
							<span class="flex items-center gap-2">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-5 w-5"
								aria-hidden="true"
							>
								<path
									d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"
								/>
							</svg>
							<span>Mastodon</span>
							</span>
						</FooterLink>
						<FooterLink
							classes={{ link: "hover:no-underline" }}
							class="mb-2 hover:text-accent"
							href="/api/redirect?to=https%3A%2F%2Fwww.instagram.com%2Faller.leih%2F&source=footer"
							target="_blank"
							rel="noopener noreferrer"
							aria-label={texts.footer.instagram}
						>
							<span class="flex items-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="h-5 w-5"
									aria-hidden="true"
								>
									<path
										d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
									/>
								</svg>
								<span>Instagram</span>
							</span>
						</FooterLink>
					</FooterLinkGroup>
				</div>
				<div>
					<h2
						class="mb-4 text-sm font-semibold uppercase text-gray-900 dark:text-white"
					>
						Rechtliches
					</h2>
					<FooterLinkGroup>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/imprint')}
							>{texts.nav.imprint}</FooterLink
						>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/privacy')}
							>{texts.nav.privacy}</FooterLink
						>
						<FooterLink classes={{ link: "hover:no-underline" }} class="mb-2 hover:text-accent" href={resolve('/misc/tos')}
							>{texts.nav.tos}</FooterLink
						>
					</FooterLinkGroup>
				</div>
			</div>
		</div>
	</div>
	 <hr class="my-6 border-gray-200 sm:mx-auto lg:my-8 dark:border-gray-700" />
	 <div class="flex justify-center space-x-4">
		<FooterCopyright href="/" by="AllerLeih" copyrightMessage=""/>
		<FooterCopyright href="/" by="openrouteservice by HeiGIT" copyrightMessage=" | Data from OpenStreetMap"/>
	 </div>
</Footer>
