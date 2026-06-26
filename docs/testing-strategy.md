# Testing

We are still in the process of developing a useful testing strategy. The below captures the current status.

## Framework

For running tests, we rely on [vitest](https://vitest.dev/) because it is integrated with our build tool [vite](https://vite.dev/).

## Strategy

For now, we aim to build test coverage up as we go to achieve a reasonable balance of flexibility and robustness that provides enough security to prevent bigger problems whilst still allowing us to implement improvements to our code at pace.

Currently, this means that we gradually implement unit tests for server-side functions. Integration and UI tests will follow as soon as reasonable.

## Practice

Test files currently live next to their target. For example, for testing conversation functionality, the test file lives directly next to [/src/routes/conversations/[conversationId]/+page.server.ts](/src/routes/conversations/[conversationId]/+page.server.ts).

To test a page and its functions, use Vitest like so:

```javascript

describe('page name, e.g. Conversation Page', () => {
    // Define mock objects for server-side SvelteKit objects
    let mockLocals; // locals contain the database object the current user
    let mockRequest; // request object, e.g. from forms
    let mockParams; // URL params, e.g. user id

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();

        const currentUserId = 'user123';

        // Mock the PocketBase client
        mockLocals = {
            pb: {
                authStore: {
                    record: { id: currentUserId }
                },
                collection: vi.fn((collectionName) => ({
                    create: vi.fn(),
                    getOne: vi.fn()
                }))
            },
            user: { id: currentUserId }
        };

        mockParams = {
            conversationId: 'conv456'
        };
    });

    // For each function, describe what you expect it to do
    describe('actions.sendMessage', () => {
        it('should have a sendMessage action', () => {
            expect(actions).toHaveProperty('sendMessage');
        });

        it('should create a message with correct data', async () => {
            // Mock form data
            const formData = new FormData();
            formData.append('messageContent', 'Hello, World!');

            mockRequest = {
                formData: vi.fn().mockResolvedValue(formData)
            };

            // Mock successful database creation
            const mockCreate = vi.fn().mockResolvedValue({ id: 'msg123' });
            mockLocals.pb.collection = vi.fn(() => ({
                create: mockCreate
            }));

            // Call the action
            await actions.sendMessage({
                locals: mockLocals,
                request: mockRequest,
                params: mockParams
            });

            // Verify the collection was called with correct name
            expect(mockLocals.pb.collection).toHaveBeenCalledWith('messages');

            // Verify create was called with correct data
            expect(mockCreate).toHaveBeenCalledWith({
                messageContent: 'Hello, World!',
                from: 'user123',
                to: 'user456'
            });
        });
```

## Local test data (seeding)

For manual testing and PR review you can populate a running PocketBase with deterministic
data using the seed runner in [`scripts/seed.js`](/scripts/seed.js). Data is organised into
named **scenarios** (one file per feature) under [`scripts/seed/scenarios/`](/scripts/seed/scenarios/),
with shared connection/teardown/factory helpers in [`scripts/seed/lib.js`](/scripts/seed/lib.js).

It is safe to run: it authenticates as a PocketBase **superuser** and only ever touches its
own records — every seed user is created on the `@seed.test` email domain, and re-running
first tears down the previous seed data (so it's idempotent). It never affects production.

### Prerequisites
- A running PocketBase instance (default `http://127.0.0.1:8090`).
- A superuser. On a fresh DB create one with
  `./pocketbase superuser create admin@example.com <password>` (in the `allerleih-backend` repo).

### Usage

```powershell
# PowerShell — set credentials for the current session, then run a scenario
$env:PB_SUPERUSER_EMAIL = "admin@example.com"
$env:PB_SUPERUSER_PASSWORD = "<password>"
npm run seed -- account-deletion
```

```bash
# Git Bash / macOS / Linux
PB_SUPERUSER_EMAIL=admin@example.com PB_SUPERUSER_PASSWORD=secret npm run seed -- account-deletion
```

- `npm run seed` with no argument **lists** the available scenarios.
- Optional env var `PB_URL` overrides the PocketBase URL.
- Seed users all share the password `password123` (the runner prints the logins + a
  walkthrough on success).

### Adding a scenario

Create `scripts/seed/scenarios/<your-feature>.js` exporting:
- `description` — a one-line summary (shown by the runner),
- `async run(pb)` — builds the data via the factories from `../lib.js`
  (`createUser`, `createItem`, `createMessage`, `createConversation`, `setTrust`) and
  optionally returns a summary string to print.

The runner discovers the file automatically; no registration needed. Run scenarios one at a
time — `teardown()` clears all `@seed.test` data before the chosen scenario runs.

## CI Integration

Tests run automatically on every pull request to `main` via GitHub Actions (`.github/workflows/vitest.yaml`). Coverage is reported as a PR comment via `davelosert/vitest-coverage-report-action` (json + lcov artifacts are also uploaded for download). The build step (`npm run build`) runs in the same workflow, catching TypeScript and Svelte compilation errors before merging.

## Testing over HTTPS locally (secure-context features)

Some browser APIs only work in a **secure context** — HTTPS or `localhost`. The most common
case is the native share sheet (`navigator.share`, used by
[`ShareButton.svelte`](/src/lib/components/ShareButton.svelte)): on a phone reaching the dev
server over a plain `http://192.168.x.x` LAN address, `navigator.share` and
`navigator.clipboard` are undefined, so the share button silently falls back to copying the
link. To exercise the real native-share behaviour you need to serve the dev server over HTTPS.

We use [`vite-plugin-mkcert`](https://github.com/liuweiGL/vite-plugin-mkcert) for this. It is
already wired into [`vite.config.ts`](/vite.config.ts):

```ts
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), mkcert()],
	server: { host: true } // expose on the LAN so a phone can reach it
});
```

### Usage

1. `npm run dev` — on first run mkcert generates and installs a local CA, then the dev server
   restarts and serves over `https://`.
2. Note the **Network** URL Vite prints (e.g. `https://192.168.1.42:5173`) and open it on the
   phone (same Wi-Fi). Accept the certificate warning — the device doesn't trust the local CA,
   which is fine for manual testing.
3. With a secure context, `navigator.share` is now defined, so the share button opens the
   real native share sheet instead of the copy-link fallback.

### Required workaround: `__BUNDLED_DEV__` define

Vite 8.0.x has a bug ([vitejs/vite#22419](https://github.com/vitejs/vite/issues/22419)) where
a dev-server restart — exactly what mkcert triggers to install its cert — causes Vite to serve
`/@vite/client` with two build-time constants left **unreplaced**. The browser then throws:

```
Uncaught (in promise) ReferenceError: __BUNDLED_DEV__ is not defined
```

This aborts the Vite client before any app code hydrates, so the whole page goes dead (no
interactivity at all — not just the share button). The fix is already applied in
[`vite.config.ts`](/vite.config.ts): we define the leaked constants explicitly.

```ts
define: {
	__BUNDLED_DEV__: 'false',
	__SERVER_FORWARD_CONSOLE__: 'false'
},
```

Both default to `false` in normal dev, and the identifiers are Vite-internal (they never
appear in app code), so this is safe for the production build too. **Remove this block once
Vite ships a fix and we bump the dependency past it.**

### Troubleshooting

- **Still seeing `__BUNDLED_DEV__ is not defined`** after the fix is present: restart
  `npm run dev` and hard-reload the page so the stale `/@vite/client` isn't served from cache.
- **Page still dead on the phone**: this is a PWA with a service worker
  ([`src/service-worker.ts`](/src/service-worker.ts)) that can cache the old client. Clear the
  site's data / unregister the service worker on the device, then reload.
