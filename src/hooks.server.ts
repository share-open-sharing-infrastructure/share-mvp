import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private'
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';


export const PB_URL = env.PB_URL;
const unprotectedPrefix = ['/login', '/register', '/reset']; // TODO: Check if this can be done by route grouping

export const authentication: Handle = async ({ event, resolve }) => {

    event.locals.pb = new PocketBase(env.PB_URL);

    event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

    try {
        event.locals.pb.authStore.isValid && await event.locals.pb.collection('users').authRefresh(); // Not entirely clear
    } catch (_) {
        event.locals.pb.authStore.clear();
    }

    const response = await resolve(event);

    response.headers.append('set-cookie', event.locals.pb.authStore.exportToCookie());
    return response;
};

export const authorization: Handle = async ({ event, resolve }) => {
    if (!unprotectedPrefix.some((path) => event.url.pathname.startsWith(path)) && event.url.pathname !== '/') {
        const loggedIn = await event.locals.pb.authStore.isValid;
        if (!loggedIn) {
            throw redirect(303, '/login');
        }
    }
    const result = await resolve(event);
    return result;
};

export const handle = sequence(authentication, authorization)
