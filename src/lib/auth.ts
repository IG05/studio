
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase, fromMongo } from './mongodb';
import ldap, { SearchEntry, EqualityFilter } from 'ldapjs';

// Helper function to create or update user in MongoDB based on LDAP details.
const getOrCreateUser = async (ldapEntry: SearchEntry) => {
    // The distinguishedName (dn) is a unique identifier for an LDAP entry.
    const uid = ldapEntry.dn;
    const email = ldapEntry.attributes.find(a => a.type === process.env.LDAP_ATTR_EMAIL)?.values[0];
    const name = ldapEntry.attributes.find(a => a.type === process.env.LDAP_ATTR_NAME)?.values[0];

    if (!uid || !email || !name) {
        throw new Error('LDAP entry is missing required attributes (dn, mail, or cn).');
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    
    let userDoc = await usersCollection.findOne({ uid: uid });

    if (userDoc) {
        return fromMongo(userDoc);
    }

    // Check if this is the first user being created to make them an owner.
    const userCount = await usersCollection.countDocuments();
    const isOwner = userCount === 0;
    
    const newUser = {
        uid, // Storing the LDAP DN as the unique ID
        email: email,
        name: name,
        role: isOwner ? 'OWNER' : 'USER',
        image: '', // LDAP photos can be complex, default to empty
        createdAt: new Date(),
    };
    const result = await usersCollection.insertOne(newUser);
    
    const createdUser = { ...newUser, _id: result.insertedId };
    return fromMongo(createdUser);
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
        
        const { email, password } = credentials;

        const searchClient = ldap.createClient({ url: [process.env.LDAP_URL!] });
        let authClient: ldap.Client | null = null;
        
        const unbindAll = () => {
            try { searchClient?.unbind(); } catch (e) { /* ignore */ }
            try { authClient?.unbind(); } catch (e) { /* ignore */ }
        };

        try {
            // Step 1: Bind with the service account to find the user's full DN.
            await new Promise<void>((resolve, reject) => {
                searchClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            
            const searchResults = await new Promise<SearchEntry[]>((resolve, reject) => {
                const entries: SearchEntry[] = [];
                const searchOptions = {
                    // FIX: Use a proper filter object to prevent injection and escaping issues.
                    filter: new EqualityFilter({
                        attribute: process.env.LDAP_ATTR_EMAIL!,
                        value: email
                    }),
                    scope: 'sub' as const,
                    attributes: ['dn', process.env.LDAP_ATTR_EMAIL!, process.env.LDAP_ATTR_NAME!]
                };

                searchClient.search(process.env.LDAP_SEARCH_BASE!, searchOptions, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    res.on('searchEntry', (entry) => {
                        entries.push(entry.pojo);
                    });
                    res.on('error', (err) => {
                        reject(err);
                    });
                    res.on('end', (result) => {
                        if (result?.status !== 0) {
                            return reject(new Error(`LDAP search failed with status ${result?.status}`));
                        }
                        resolve(entries);
                    });
                });
            });


            if (!searchResults || searchResults.length === 0) {
                throw new Error("User not found in LDAP directory.");
            }
            if (searchResults.length > 1) {
                throw new Error("Multiple users found with the same email address.");
            }

            const userEntry = searchResults[0];
            const userDn = userEntry.dn;
            
            searchClient.unbind(); // Unbind the service account connection.

            // Step 2: Now, bind as the user with their full DN and provided password to verify them.
            authClient = ldap.createClient({ url: [process.env.LDAP_URL!] });
            await new Promise<void>((resolve, reject) => {
                authClient!.bind(userDn, password, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Step 3: If authentication is successful, get/create the user in our local DB.
            const userData = await getOrCreateUser(userEntry);
             if (!userData) {
                throw new Error("User data could not be retrieved from the database.");
            }
            
            unbindAll();

            return {
              id: userData.id,
              uid: userData.uid,
              email: userData.email,
              name: userData.name,
              image: userData.image,
              role: userData.role.toLowerCase(),
            };

        } catch (error: any) {
            console.error("LDAP Authorization Error:", error.message);
            unbindAll();
            // Provide a generic error message to the user for security.
            throw new Error('Invalid email or password.');
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
