
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/chat" | "/chat/[userId]" | "/login" | "/logout" | "/org" | "/org/about" | "/org/contact" | "/org/imprint" | "/profile" | "/register" | "/reset" | "/search" | "/social";
		RouteParams(): {
			"/chat/[userId]": { userId: string }
		};
		LayoutParams(): {
			"/": { userId?: string };
			"/chat": { userId?: string };
			"/chat/[userId]": { userId: string };
			"/login": Record<string, never>;
			"/logout": Record<string, never>;
			"/org": Record<string, never>;
			"/org/about": Record<string, never>;
			"/org/contact": Record<string, never>;
			"/org/imprint": Record<string, never>;
			"/profile": Record<string, never>;
			"/register": Record<string, never>;
			"/reset": Record<string, never>;
			"/search": Record<string, never>;
			"/social": Record<string, never>
		};
		Pathname(): "/" | "/chat" | "/chat/" | `/chat/${string}` & {} | `/chat/${string}/` & {} | "/login" | "/login/" | "/logout" | "/logout/" | "/org" | "/org/" | "/org/about" | "/org/about/" | "/org/contact" | "/org/contact/" | "/org/imprint" | "/org/imprint/" | "/profile" | "/profile/" | "/register" | "/register/" | "/reset" | "/reset/" | "/search" | "/search/" | "/social" | "/social/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}