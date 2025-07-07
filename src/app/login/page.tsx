
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { auth } from '@/lib/firebase-client'; // New client-side firebase
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    type AuthError
} from "firebase/auth";


import { Button } from '@/components/ui/button';
import { S3BucketIcon } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
        let userCredential;
        try {
            // First, try to sign in the user
            userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        } catch (signInError) {
            const authError = signInError as AuthError;
            // If sign-in fails because the user doesn't exist, try to create a new account
            if (authError.code === 'auth/user-not-found') {
                 try {
                    userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
                 } catch (signUpError) {
                    throw new Error("Could not create account. Please try again.");
                 }
            } else if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
                throw new Error("Invalid password. Please try again.");
            }
            else {
                // If sign-in fails for another reason, re-throw the error
                throw new Error("Authentication failed. Please try again.");
            }
        }

      const user = userCredential.user;
      const idToken = await user.getIdToken();

      // Now, sign in to NextAuth using the Firebase ID token
      const res = await signIn('credentials', {
        redirect: false,
        idToken,
        callbackUrl,
      });

      if (res?.error) {
        setError('Login failed after authentication. Please contact support.');
      } else if (res?.ok) {
        router.push(callbackUrl);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <S3BucketIcon className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl font-bold tracking-tight text-foreground">S3 Commander</h1>
          <p className="mt-2 text-muted-foreground">Securely manage your S3 bucket access.</p>
        </div>

        <Card className="shadow-2xl shadow-primary/10">
          <CardHeader>
            <CardTitle>Sign In or Sign Up</CardTitle>
            <CardDescription>Enter your credentials to continue. An account will be created if you don't have one.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Authentication Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-semibold" size="lg" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Sign In / Sign Up
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Having trouble?{' '}
            <a href="#" className="font-medium text-primary hover:underline">
              Contact your administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
