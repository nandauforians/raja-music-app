import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google/generative-ai', () => {
  const MockGenAI = vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { 
          text: () => JSON.stringify({
            intent: 'PLAY_SONG',
            filters: { title: 'Thenpaandi Seemaiyile' },
            speech_response: 'Playing Thenpaandi Seemaiyile'
          })
        }
      })
    })
  }));
  return {
    GoogleGenerativeAI: MockGenAI,
    default: MockGenAI
  };
});

import * as lambda from '../lambda_functions';
import { setMockClient } from '../utils/db'; // Import the db util directly

// Set up env vars needed for tests
process.env.MONGODB_URI = 'mongodb://mockdb';
process.env.GEMINI_API_KEY = 'mockgeminikey';

// We still mock mongodb for ObjectId
vi.mock('mongodb', () => {
  return {
    ObjectId: vi.fn().mockImplementation((id) => id),
    MongoClient: vi.fn()
  };
});

// Helper to easily inject mock db using our backdoor
function mockDbCollections(overrides = {}) {
  const mockDb = {
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ id: 'song1', title: 'Test Song' }),
      updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      aggregate: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([{ id: 'song1', title: 'Test Song' }])
      }),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([])
      }),
      insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
      ...overrides
    })
  };
  setMockClient(mockDb);
}

describe('Lambda Functions Unit Tests', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbCollections();
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
      mockDbCollections({ findOne: vi.fn().mockResolvedValue({ userId: 'u1', totalPoints: 50 }) });

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
      mockDbCollections({ 
         findOne: vi.fn().mockResolvedValue({ userId: 'u1', totalPoints: 50 }),
         updateOne: vi.fn().mockResolvedValue({}),
         insertOne: vi.fn().mockResolvedValue({})
      });

      const event = {
        requestContext: { authorizer: { claims: { sub: 'u1' } } },
        body: JSON.stringify({ amount: 10, mobileNumber: '9999999999' })
      };
      
      const response = await lambda.requestIncentive(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Incentive requested successfully');
    });
  });

  describe('rateSong', () => {
    it('returns 400 for invalid rating', async () => {
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({ songId: 's1', rating: 11 }) // > 10 is invalid
      };
      const response = await lambda.rateSong(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Invalid rating data');
    });

    it('returns 200 and calculates avg rating', async () => {
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({ songId: 's1', rating: 4 })
      };
      
      mockDbCollections({ 
        updateOne: vi.fn().mockResolvedValue({}),
        insertOne: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ averageRating: 4 }]) })
      });

      const response = await lambda.rateSong(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('User Preferences API', () => {
    it('should save user preferences within max length', async () => {
      mockDbCollections({ updateOne: vi.fn().mockResolvedValue({ acknowledged: true }) });
      
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({
          userId: 'u1',
          songId: 's1',
          karaoke_snippet_start: 0,
          karaoke_snippet_end: 60000
        })
      };
      const response = await lambda.saveUserPreferences(event);
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });

    it('should reject user preferences exceeding 120s', async () => {
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({
          userId: 'u1',
          songId: 's1',
          karaoke_snippet_start: 0,
          karaoke_snippet_end: 200000 // exceeds 120000
        })
      };
      const response = await lambda.saveUserPreferences(event);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Song Suggestions API', () => {
    it('should allow user to suggest a song', async () => {
      mockDbCollections({ findOne: vi.fn().mockResolvedValue(null) });

      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({
          userId: 'u1',
          spotifyId: 'spotify_id_123',
          title: 'Pudhu Vellai Mazhai',
          movie: 'Roja'
        })
      };
      const response = await lambda.suggestSong(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.suggestion.status).toBe('pending');
    });

    it('should reject suggestion if song already in catalog', async () => {
      mockDbCollections({ findOne: vi.fn().mockResolvedValue({ _id: 'existing_song' }) });
      
      const event = {
        headers: { 'x-user-id': 'u1' },
        body: JSON.stringify({
          userId: 'u1',
          spotifyId: 'spotify_id_123',
          title: 'Pudhu Vellai Mazhai',
          movie: 'Roja'
        })
      };
      const response = await lambda.suggestSong(event);
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message || body.error).toContain('already exists');
    });
  });

  describe('voiceCommand', () => {
    it('returns 400 when transcript is missing', async () => {
      const event = { body: JSON.stringify({}) };
      const response = await lambda.voiceCommand(event);
      expect(response.statusCode).toBe(400);
    });

    it('processes transcript using Gemini and returns response', async () => {
      const event = { body: JSON.stringify({ transcript: 'Play Thenpaandi Seemaiyile' }) };
      const response = await lambda.voiceCommand(event);
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});
