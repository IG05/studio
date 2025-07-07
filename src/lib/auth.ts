
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { auth as adminAuth } from './firebase'; // Use our firebase admin instance
import type { DecodedIdToken } from 'firebase-admin/auth';
import { connectToDatabase, fromMongo } from './mongodb';

// Helper function to create or update user in MongoDB
const getOrCreateUser = async (decodedToken: DecodedIdToken) => {
    try {
        const { uid, email, name, picture } = decodedToken;
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        
        const isOwnerByEmail = email === 'admin@jfl.com';

        let userDoc = await usersCollection.findOne({ uid: uid });

        if (userDoc) {
            // If the user is the designated owner but their role is not OWNER, update it.
            if (isOwnerByEmail && userDoc.role !== 'OWNER') {
                const result = await usersCollection.findOneAndUpdate(
                    { uid: uid },
                    { $set: { role: 'OWNER' } },
                    { returnDocument: 'after' }
                );
                userDoc = result;
            }
            return fromMongo(userDoc);
        }
        
        // New user, determine role
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

    } catch (error) {
        console.error("Database error in getOrCreateUser:", error);
        // Return null to indicate failure, which will prevent login
        return null;
    }
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
            return null;
          }

          const userData = await getOrCreateUser(decodedToken);
          
          if (userData) {
            return {
              id: userData.id, // Use the MongoDB document ID
              uid: userData.uid, // Keep firebase UID for reference
              email: userData.email,
              name: userData.name,
              image: userData.image,
              role: userData.role.toLowerCase(),
            };
          }
          return null;

        } catch (e) {
          console.error("Firebase ID token verification failed:", e);
          return null;
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
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
