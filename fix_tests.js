const fs = require('fs');

const testFile = 'backend/__tests__/lambda_functions.test.js';
let content = fs.readFileSync(testFile, 'utf8');

// 1. Add vi.mock('../utils/db')
const dbMock = `
vi.mock('../utils/db', () => ({
  getDb: vi.fn().mockResolvedValue({
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
      }),
      insertOne: vi.fn().mockResolvedValue({})
    })
  })
}));
`;
content = content.replace(/vi\.mock\('mongodb', \(\) => \{/, dbMock + "\nvi.mock('mongodb', () => {");

// 2. Replace MongoClient.mockImplementationOnce with getDb.mockResolvedValueOnce
content = content.replace(/const \{ MongoClient \} = await import\('mongodb'\);/g, "const { getDb } = await import('../utils/db');");

content = content.replace(/MongoClient\.mockImplementationOnce\(\(\) => \(\{[\s\S]*?connect: vi\.fn\(\)\.mockResolvedValue\(\),[\s\S]*?db: vi\.fn\(\)\.mockReturnValue\(\{([\s\S]*?)\}\),[\s\S]*?close: vi\.fn\(\)[\s\S]*?\}\)\);/g, 
  "getDb.mockResolvedValueOnce({$1});");

fs.writeFileSync(testFile, content);
console.log("Fixed test file");
