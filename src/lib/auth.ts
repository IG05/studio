
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { auth as adminAuth } from './firebase'; // Use our firebase admin instance
import type { DecodedIdToken } from 'firebase-admin/auth';
import { connectToDatabase, fromMongo } from './mongodb';

// Helper function to create or update user in MongoDB.
// This function will now throw an error if database operations fail.
const getOrCreateUser = async (decodedToken: DecodedIdToken) => {
    const { uid, email, name, picture } = decodedToken;
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    
    let userDoc = await usersCollection.findOne({ uid: uid });

    if (userDoc) {
        return fromMongo(userDoc);
    }
    
    const isOwnerByEmail = email === 'admin@example.org';
    const newUser = {
        uid,
        email: email,
        name: name || email?.split('@')[0],
        role: isOwnerByEmail ? 'OWNER' : 'USER',
        image: picture || '',
        createdAt: new Date(),
    };
    const result = await usersCollection.insertOne(newUser);
    
    const createdUser = { ...newUser, _id: result.insertedId };
    return fromMongo(createdUser);
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Firebase',
      credentials: {
        idToken: { label: "Firebase ID Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) {
          return null;
        }

        try {
          const decodedToken = await adminAuth.verifyIdToken(credentials.idToken);
          if (!decodedToken || !decodedToken.uid) {
            return null; // Token is invalid or doesn't have a UID
          }

          // This block now includes detailed error handling.
          try {
            const userData = await getOrCreateUser(decodedToken);
            if (!userData) {
                // This case should ideally not be hit if getOrCreateUser throws, but as a safeguard:
                throw new Error("User data could not be retrieved from the database.");
            }
            
            return {
              id: userData.id,
              uid: userData.uid,
              email: userData.email,
              name: userData.name,
              image: userData.image,
              role: userData.role.toLowerCase(),
            };

          } catch (dbError: any) {
              console.error("Database operation failed during authorization:", dbError);
              // Re-throw the specific database error so NextAuth can pass it to the client.
              throw new Error(`Database Error: ${dbError.message}`);
          }

        } catch (error: any) {
          console.error("Authorization failed:", error);
          // This will catch the re-thrown DB error or any other error (e.g., Firebase token verification)
          // The message from this error is what will be displayed on the login page.
          throw new Error(error.message || 'An unknown authorization error occurred.');
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
        if (user) {
            token.id = user.id;
            token.uid = user.uid; 
            token.role = user.role;
        }
        return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.uid = token.uid as string;
        session.user.role = token.role as 'owner' | 'admin' | 'user';
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login', // Errors will redirect to the login page
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
