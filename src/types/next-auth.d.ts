import type { DefaultSession, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id?: string;
      role?: 'owner' | 'admin' | 'user';
    } & DefaultSession['user'];
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * available in the `jwt` callback's `user` parameter.
   */
  interface User {
    role?: 'owner' | 'admin' | 'user';
  }
}

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    id?: string;
    role?: 'owner' | 'admin' | 'user';
  }
}
