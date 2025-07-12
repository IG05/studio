import { Db, MongoClient, ObjectId } from "mongodb";


let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;


export async function connectToDatabase() {

  const MONGODB_USER = process.env.MONGODB_USER;
  const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
  const MONGODB_HOST = process.env.MONGODB_HOST;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
  const MONGODB_URI = process.env.MONGODB_URI as string;

  if (!MONGODB_USER || !MONGODB_PASSWORD || !MONGODB_HOST || !MONGODB_DB_NAME) {
    throw new Error(
      "Please define MONGODB_USER, MONGODB_PASSWORD, MONGODB_HOST, and MONGODB_DB_NAME environment variables inside .env"
    );
  }

  // Construct the URI, ensuring the password and user are properly encoded
  // const MONGODB_URI = `mongodb+srv://${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_HOST}/?retryWrites=true&w=majority&appName=Cluster0`;

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);

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
