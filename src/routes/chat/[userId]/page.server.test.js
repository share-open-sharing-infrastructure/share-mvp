import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions, load } from './+page.server';

describe('Chat page', () => {
    let mockLocals;
    let mockRequest;
    let mockParams;

    beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();

        // Mock the PocketBase client
        mockLocals = {
            pb: {
                authStore: {
                    record: { id: 'user123' }
                },
                collection: vi.fn((collectionName) => ({
                    create: vi.fn(),
                    getOne: vi.fn()
                }))
            }
        };

        mockParams = {
            userId: 'user456'
        };
    });

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

        it('should return normal fail response on database error when status code is given', async () => {
            const formData = new FormData();
            formData.append('messageContent', 'Test message');

            mockRequest = {
                formData: vi.fn().mockResolvedValue(formData)
            };

            const statusCode = 400;
            // Mock database error
            const mockError = {
                status: statusCode,
                data: { message: 'Database error' }
            };
            
            mockLocals.pb.collection = vi.fn(() => ({
                create: vi.fn().mockRejectedValue(mockError)
            }));

            // Call the action
            const result = await actions.sendMessage({ 
                locals: mockLocals,
                request: mockRequest,
                params: mockParams
            });

            // Verify it returns a fail response
            expect(result).toEqual({
                data: {
                    fail: true,
                    message: "Database error",
                },
                status: statusCode,
            });
        });

        it('should return 500 fail response on database error when error is undefined', async () => {
            const formData = new FormData();
            formData.append('messageContent', 'Test message');

            mockRequest = {
                formData: vi.fn().mockResolvedValue(formData)
            };

            const statusCode = null;
            // Mock database error
            const mockError = {
                status: statusCode,
                data: { message: 'Database error' }
            };
            
            mockLocals.pb.collection = vi.fn(() => ({
                create: vi.fn().mockRejectedValue(mockError)
            }));

            // Call the action
            const result = await actions.sendMessage({ 
                locals: mockLocals,
                request: mockRequest,
                params: mockParams
            });

            // Verify it returns a fail response
            expect(result).toEqual({
                data: {
                    fail: true,
                    message: "Database error",
                },
                status: 500,
            });
        });

        it('should handle missing message content', async () => {
            const formData = new FormData();
 
            mockRequest = {
                formData: vi.fn().mockResolvedValue(formData)
            };

            const mockCreate = vi.fn().mockResolvedValue({ id: 'msg123' });
            mockLocals.pb.collection = vi.fn(() => ({
                create: mockCreate
            }));

            await actions.sendMessage({ 
                locals: mockLocals, 
                request: mockRequest, 
                params: mockParams 
            });

            // Verify create was called with null messageContent
            // TODO: Consider if this is the desired behavior, or this should e.g. just do nothing
            expect(mockCreate).toHaveBeenCalledWith({
                messageContent: null,
                from: 'user123',
                to: 'user456'
            });
        });
    });

    describe('load function', () => {
        it('should filter and sort messages for current chat partner', async () => {
            const mockMessages = [
                { id: '1', from: 'user456', to: 'user123', created: '2024-01-02T10:00:00Z' },
                { id: '2', from: 'user123', to: 'user456', created: '2024-01-01T10:00:00Z' },
                { id: '3', from: 'user789', to: 'user123', created: '2024-01-03T10:00:00Z' }
            ];

            const mockParent = vi.fn().mockResolvedValue({
                allMessages: mockMessages
            });

            const mockGetOne = vi.fn().mockResolvedValue({
                id: 'user456',
                username: 'testuser',
                email: 'test@example.com'
            });

            mockLocals.pb.collection = vi.fn(() => ({
                getOne: mockGetOne
            }));

            const result = await load({
                locals: mockLocals,
                params: mockParams,
                parent: mockParent
            });

            // Should only include messages between user123 and user456
            expect(result.currentMessages).toHaveLength(2);
            
            // Should be sorted oldest to newest
            expect(result.currentMessages[0].id).toBe('2');
            expect(result.currentMessages[1].id).toBe('1');

            // Should have current chat partner info
            expect(result.currentChatPartner.username).toBe('testuser');
        });

        it('should handle user not found error', async () => {
            const mockParent = vi.fn().mockResolvedValue({
                allMessages: []
            });

            mockLocals.pb.collection = vi.fn(() => ({
                getOne: vi.fn().mockRejectedValue({
                    status: 404,
                    message: 'User not found'
                })
            }));

            // The load function should throw an error
            // TODO: Make more specific potentially
            await expect(
                load({
                    locals: mockLocals,
                    params: mockParams,
                    parent: mockParent
                })
            ).rejects.toThrow();
        });
    });
});