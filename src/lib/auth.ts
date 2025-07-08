import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase, fromMongo } from './mongodb';
import { Client } from 'ldapts';

const getOrCreateUser = async (ldapEntry: any) => {
  const uid = ldapEntry.dn;
  const email = ldapEntry.mail;
  const name = ldapEntry.cn;

  if (!uid || !email || !name) {
    throw new Error('LDAP entry is missing required attributes.');
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  let userDoc = await usersCollection.findOne({ uid });
  if (userDoc) return fromMongo(userDoc);

  const userCount = await usersCollection.countDocuments();
  const isOwner = userCount === 0;

  const newUser = {
    uid,
    email,
    name,
    role: isOwner ? 'OWNER' : 'USER',
    image: '',
    createdAt: new Date(),
  };

  const result = await usersCollection.insertOne(newUser);
  return fromMongo({ ...newUser, _id: result.insertedId });
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'LDAP',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error("Email and password are required.");
        }

        const client = new Client({
          url: process.env.LDAP_URL!,
          timeout: 5000,
          connectTimeout: 10000,
        });

        try {
          // Step 1: Bind as admin
          await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);

          const { searchEntries } = await client.search(
            process.env.LDAP_SEARCH_BASE!,
            {
              scope: 'sub',
              filter: `(${process.env.LDAP_ATTR_EMAIL ?? 'mail'}=${credentials.email})`,
              attributes: ['dn', process.env.LDAP_ATTR_EMAIL ?? 'mail', process.env.LDAP_ATTR_NAME ?? 'cn'],
            }
          );

          if (!searchEntries || searchEntries.length === 0) {
            throw new Error("User not found in LDAP directory.");
          }

          if (searchEntries.length > 1) {
            throw new Error("Multiple users found with the same email.");
          }

          const entry = searchEntries[0];
          const userDn = entry.dn;

          // Step 2: Bind as the user to authenticate
          await client.bind(userDn, credentials.password);

          // Step 3: Get or create local DB user
          const userData = await getOrCreateUser({
            dn: userDn,
            mail: entry[process.env.LDAP_ATTR_EMAIL ?? 'mail'],
            cn: entry[process.env.LDAP_ATTR_NAME ?? 'cn'],
          });

          return {
            id: userData.id,
            uid: userData.uid,
            email: userData.email,
            name: userData.name,
            image: userData.image,
            role: userData.role.toLowerCase(),
          };
        } catch (err: any) {
          console.error("❌ LDAP Auth error:", err.message);
          throw new Error("Invalid email or password.");
        } finally {
          await client.unbind();
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
