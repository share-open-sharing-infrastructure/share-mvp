import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private'
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';

export const PB_URL = env.PB_URL;

const unprotectedPrefix = ['/login', '/register', '/reset', '/items'];

export const authentication: Handle = async ({ event, resolve }) => {

    event.locals.pb = new PocketBase(env.PB_URL);

    event.locals.pb.authStore.loadFromCookie(
        event.request.headers.get('cookie') || ''
    );

    try {
        if (event.locals.pb.authStore.isValid) {
            await event.locals.pb.collection('users').authRefresh();
            event.locals.user = event.locals.pb.authStore.record;
        } else {
            event.locals.user = null;
        }
    } catch (_) {
        event.locals.pb.authStore.clear();
        event.locals.user = null;
    }

    const response = await resolve(event);

    response.headers.append(
        'set-cookie', 
        event.locals.pb.authStore.exportToCookie({
            httpOnly: false // required for SvelteKit to access the cookie on the client side, necessary for /chat
        }
    ));

    return response;
}


export const authorization: Handle = async ({ event, resolve }) => {
    if (!unprotectedPrefix.some((path) => event.url.pathname.startsWith(path)) && event.url.pathname !== '/') {
        const loggedIn = await event.locals.pb.authStore.isValid;
        if (!loggedIn) {
            redirect(308, '/login');
        }
    }
    const result = await resolve(event);
    return result;
};

export const handle = sequence(authentication, authorization)

export function handleError({ error, event }) {
    console.error('Error occurred during request processing:', {
        error,
        url: event.url.href,
        method: event.request.method
    });
};