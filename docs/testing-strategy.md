# Testing

We are still in the process of developing a useful testing strategy. The below captures the current status.

## Framework

For running tests, we rely on [vitest](https://vitest.dev/) because it is integrated with our build tool [vite](https://vite.dev/).

## Strategy

For now, we aim to build test coverage up as we go to achieve a reasonable balance of flexibility and robustness that provides enough security to prevent bigger problems whilst still allowing us to implement improvements to our code at pace.

Currently, this means that we gradually implement unit tests for server-side functions. Integration and UI tests will follow as soon as reasonable.

## Practice

Test files currently live next to their target. For example, for testing chat functionality, the test file [/src/routes/chat/[userId]/page.server.test.js](/src/routes/chat/[userId]/page.server.test.js) lives directly next to [/src/routes/chat/[userId]/+page.server.ts](/src/routes/chat/[userId]/+page.server.ts).

To test a page and its functions, use Vitest like so:

```javascript

describe('page name, e.g. Chat Page', () => {
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
            userId: 'user456'
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
