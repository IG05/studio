
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { connectToDatabase, fromMongo } from './mongodb';
import ldap, { SearchEntry, EqualityFilter } from 'ldapjs';

// Helper function to create or update user in MongoDB based on LDAP details.
const getOrCreateUser = async (ldapEntry: SearchEntry) => {
    // The distinguishedName (dn) is a unique identifier for an LDAP entry.
    const uid = ldapEntry.dn.toString();
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
        console.log('--- Starting LDAP Authorization ---');
        if (!credentials?.email || !credentials.password) {
            console.error('Login failed: Email and password are required.');
            throw new Error("Email and password are required.");
        }
        
        const { email, password } = credentials;
        console.log(`Attempting login for email: ${email}`);

        const searchClient = ldap.createClient({ url: [process.env.LDAP_URL!] });
        let authClient: ldap.Client | null = null;
        
        const unbindAll = () => {
            try { searchClient?.unbind(); } catch (e) { console.error('Error unbinding search client:', e) }
            try { authClient?.unbind(); } catch (e) { console.error('Error unbinding auth client:', e) }
        };

        try {
            // Step 1: Bind with the service account to find the user's full DN.
            console.log(`Step 1: Binding with service account: ${process.env.LDAP_BIND_DN}`);
            await new Promise<void>((resolve, reject) => {
                searchClient.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!, (err) => {
                    if (err) {
                        console.error('❌ Service Account Bind FAILED:', err.message);
                        return reject(err);
                    }
                    console.log('✅ Service Account Bind SUCCESSFUL.');
                    resolve();
                });
            });
            
            const searchResults = await new Promise<SearchEntry[]>((resolve, reject) => {
                const entries: SearchEntry[] = [];
                const searchOptions = {
                    filter: new EqualityFilter({
                        attribute: 'mail',
                        value: email
                    }),
                    scope: 'sub' as const,
                    attributes: ['dn', process.env.LDAP_ATTR_EMAIL!, process.env.LDAP_ATTR_NAME!]
                };

                console.log(`Step 2: Searching for user with filter: (mail=${email}) in base: ${process.env.LDAP_SEARCH_BASE}`);
                searchClient.search(process.env.LDAP_SEARCH_BASE!, searchOptions, (err, res) => {
                    if (err) {
                        console.error('❌ LDAP Search INIT FAILED:', err.message);
                        return reject(err);
                    }
                    res.on('searchEntry', (entry) => {
                        console.log("... Found an LDAP entry:", entry.dn.toString());
                        entries.push(entry);
                    });
                    res.on('error', (err) => {
                        console.error('❌ LDAP Search Stream ERROR:', err.message);
                        reject(err);
                    });
                    res.on('end', (result) => {
                        if (result?.status !== 0) {
                            console.error(`LDAP search finished with non-zero status: ${result?.status}`);
                            return reject(new Error(`LDAP search failed with status ${result?.status}`));
                        }
                        console.log(`✅ LDAP Search SUCCESSFUL. Found ${entries.length} entries.`);
                        resolve(entries);
                    });
                });
            });


            if (!searchResults || searchResults.length === 0) {
                console.error('❌ Search returned no results. User not found.');
                throw new Error("User not found in LDAP directory.");
            }
            if (searchResults.length > 1) {
                console.error('❌ Search returned multiple results for the same email.');
                throw new Error("Multiple users found with the same email address.");
            }

            const userEntry = searchResults[0];
            const userDn = userEntry.dn.toString();
            console.log(`Step 3: Verifying password for user DN: ${userDn}`);

            // Unbind the service account connection before attempting to bind as the user.
            searchClient.unbind();

            // Step 2: Now, bind as the user with their full DN and provided password to verify them.
            authClient = ldap.createClient({ url: [process.env.LDAP_URL!] });
            await new Promise<void>((resolve, reject) => {
              authClient!.bind(userDn, password, (err) => {
                  if (err) {
                      console.error("❌ User Password Verification FAILED for:", userDn, "Reason:", err.message);
                      return reject(err);
                  }
                  console.log("✅ User Password Verification SUCCESSFUL for:", userDn);
                  resolve();
              });
            });

            // Step 3: If authentication is successful, get/create the user in our local DB.
            console.log('Step 4: Getting or creating user in local database.');
            const userData = await getOrCreateUser(userEntry);
             if (!userData) {
                throw new Error("User data could not be retrieved from the database.");
            }
            
            console.log('--- Authorization Successful ---');
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
            console.error("LDAP Authorization Flow Error:", error.message);
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
