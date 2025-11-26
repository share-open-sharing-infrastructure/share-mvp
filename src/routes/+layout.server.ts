export const load = (event) => {
    const flashCookie = event.cookies.get('flash');
    let flash = null;

    throw new Error('Test Sentry Error from layout.server.ts');

    if (flashCookie) {
        try {
            flash = JSON.parse(flashCookie);
        } catch {}
        event.cookies.delete('flash', { path: '/' });
    }

    // PocketBase auth state: if logged in, authStore.record holds the user
    const currentUser = event.locals.pb?.authStore?.isValid
        ? event.locals.pb.authStore.record
        : null;

    return { flash, currentUser };
};