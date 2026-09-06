import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as lambda from '../lambda_functions';

// Set up env vars needed for tests
process.env.MONGODB_URI = 'mongodb://mockdb';
process.env.GEMINI_API_KEY = 'mockgeminikey';

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'Mock Gemini Trivia' }
        })
      })
    }))
  };
});

// Mock dependencies
vi.mock('mongodb', () => {
  return {
    ObjectId: vi.fn().mockImplementation((id) => id),
    MongoClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(),
      db: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          findOne: vi.fn().mockResolvedValue({ id: 'song1', title: 'Test Song' }),
          updateOne: vi.fn().mockResolvedValue({}),
          aggregate: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([{ id: 'song1', title: 'Test Song' }])
          }),
          find: vi.fn().mockReturnValue({
            sort: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue([])
          })
        })
      }),
      close: vi.fn()
    }))
  };
});

describe('Lambda Functions Unit Tests', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('health', () => {
    it('returns 200 OK', async () => {
      const response = await lambda.health({});
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
    });
  });

  describe('getSongOfDay', () => {
    it('returns a song from the database', async () => {
      const response = await lambda.getSongOfDay({});
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.song).toBeDefined();
      expect(body.song.title).toBe('Test Song');
    });
  });

  describe('requestIncentive', () => {
    it('returns 400 if amount exceeds 50% of total points', async () => {
      // Mock findOne to return a user with 50 points
      const mockFindOne = vi.fn().mockResolvedValue({ userId: 'u1', totalPoints: 50 });
      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            findOne: mockFindOne
          })
        }),
        close: vi.fn()
      }));

      const event = {
        requestContext: { authorizer: { claims: { sub: 'u1' } } },
        body: JSON.stringify({ amount: 30, mobileNumber: '9999999999' })
      };
      
      const response = await lambda.requestIncentive(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('up to 50%');
    });

    it('returns 200 and deducts points if amount is valid', async () => {
      const mockUpdateOne = vi.fn().mockResolvedValue({});
      const mockInsertOne = vi.fn().mockResolvedValue({});
      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({
            findOne: vi.fn().mockResolvedValue({ userId: 'u1', name: 'Test', totalPoints: 100 }),
            updateOne: mockUpdateOne,
            insertOne: mockInsertOne
          })
        }),
        close: vi.fn()
      }));

      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({ amount: 20, mobileNumber: '9999999999' })
      };
      
      const response = await lambda.requestIncentive(event);
      expect(response.statusCode).toBe(200);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { userId: 'u1' },
        { $inc: { totalPoints: -20 } }
      );
      expect(mockInsertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          amount: 20,
          mobileNumber: '9999999999',
          status: 'pending'
        })
      );
    });
  });

  describe('rateSong', () => {
    it('returns 400 for invalid rating', async () => {
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({ songId: 's1', rating: 15 })
      };
      const response = await lambda.rateSong(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Invalid rating data');
    });

    it('returns 200 and calculates avg rating', async () => {
      const mockUpdateOne = vi.fn().mockResolvedValue({});
      const mockInsertOne = vi.fn().mockResolvedValue({});
      const mockFindOne = vi.fn().mockResolvedValue(null); // No existing activity
      const mockToArray = vi.fn().mockResolvedValue([{ rating: 8 }, { rating: 10 }]);

      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockImplementation((col) => {
            if (col === 'ratings') {
              return { updateOne: mockUpdateOne, find: vi.fn().mockReturnValue({ toArray: mockToArray }) };
            }
            if (col === 'songs') return { updateOne: mockUpdateOne };
            if (col === 'activities') return { findOne: mockFindOne, insertOne: mockInsertOne };
            if (col === 'users') return { updateOne: mockUpdateOne };
            return {};
          })
        }),
        close: vi.fn()
      }));

      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({ songId: 's1', rating: 10 })
      };
      const response = await lambda.rateSong(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.avgRating).toBe(9); // (8+10)/2
      expect(body.pointsAwarded).toBe(125);
    });
  });

  describe('User Preferences API', () => {
    it('should save user preferences within max length', async () => {
      const mockUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });
      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({ updateOne: mockUpdateOne })
        }),
        close: vi.fn()
      }));

      const event = {
        body: JSON.stringify({ userId: 'u1', songId: 's1', karaoke_snippet_start: 10000, karaoke_snippet_end: 120000 })
      };
      const response = await lambda.saveUserPreferences(event);
      expect(response.statusCode).toBe(200);
    });

    it('should reject user preferences exceeding 120s', async () => {
      const event = {
        body: JSON.stringify({ userId: 'u1', songId: 's1', karaoke_snippet_start: 0, karaoke_snippet_end: 120001 })
      };
      const response = await lambda.saveUserPreferences(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('cannot exceed 120 seconds');
    });
  });

  describe('Song Suggestions API', () => {
    it('should allow user to suggest a song', async () => {
      const mockInsertOne = vi.fn().mockResolvedValue({ acknowledged: true });
      const mockFindOne = vi.fn().mockResolvedValue(null);
      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({ insertOne: mockInsertOne, findOne: mockFindOne })
        }),
        close: vi.fn()
      }));

      const event = {
        body: JSON.stringify({ userId: 'u1', spotifyId: 'sp1', title: 'Test Song' })
      };
      const response = await lambda.suggestSong(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.suggestion.status).toBe('pending');
    });

    it('should reject suggestion if song already in catalog', async () => {
      const mockFindOne = vi.fn().mockResolvedValue({ _id: 'existing_song' });
      const { MongoClient } = await import('mongodb');
      MongoClient.mockImplementationOnce(() => ({
        connect: vi.fn().mockResolvedValue(),
        db: vi.fn().mockReturnValue({
          collection: vi.fn().mockReturnValue({ findOne: mockFindOne })
        }),
        close: vi.fn()
      }));

      const event = {
        body: JSON.stringify({ userId: 'u1', spotifyId: 'sp1', title: 'Test Song' })
      };
      const response = await lambda.suggestSong(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already exists in the catalog');
    });
  });
});

