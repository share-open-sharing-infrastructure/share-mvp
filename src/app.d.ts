// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			pb: import('pocketbase').default;
			user: import('pocketbase').Record | null;
		}
		// interface Error {}
		interface PageData {
			currentUser: import('pocketbase').Record | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
