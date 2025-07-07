import { Db, MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env");
}

if (!MONGODB_DB_NAME) {
    throw new Error("Please define the MONGODB_DB_NAME environment variable inside .env");
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI!);

  await client.connect();

  const db = client.db(MONGODB_DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// Helper to convert string ID to ObjectId, with validation
export const toObjectId = (id: string): ObjectId | null => {
    return ObjectId.isValid(id) ? new ObjectId(id) : null;
};

// Helper to format documents for API response
// Converts _id to id and Date objects to ISO strings
export const fromMongo = (doc: any) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    const result: any = { id: _id.toString() };
    for (const key in rest) {
        if (rest[key] instanceof Date) {
            result[key] = rest[key].toISOString();
        } else {
            result[key] = rest[key];
        }
    }
    return result;
};
