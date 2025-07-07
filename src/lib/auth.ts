
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db, auth as adminAuth } from './firebase'; // Use our firebase admin instance
import type { DecodedIdToken } from 'firebase-admin/auth';

// Helper function to create or update user in Firestore
const getOrCreateUser = async (decodedToken: DecodedIdToken) => {
    const { uid, email, name, picture } = decodedToken;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    const isOwnerByEmail = email === 'admin@jfl.com';

    if (userDoc.exists) {
        const userData = userDoc.data()!;
        // If the user is the designated owner but their role is not OWNER, update it.
        // This corrects any previously incorrect role assignment.
        if (isOwnerByEmail && userData.role !== 'OWNER') {
            await userRef.update({ role: 'OWNER' });
            return { ...userData, role: 'OWNER' };
        }
        return userData;
    }
    
    // New user, determine role
    const newUser = {
        email: email,
        name: name || email?.split('@')[0],
        role: isOwnerByEmail ? 'OWNER' : 'USER',
        image: picture || '',
        createdAt: new Date().toISOString(),
    };
    await userRef.set(newUser);
    return newUser;
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
              id: decodedToken.uid,
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
            token.role = user.role;
        }
        return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
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
