
import admin from 'firebase-admin';

// This guard prevents re-initialization on hot reloads
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountString) {
      throw new Error('The FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. Please check your .env file.');
    }

    // Firebase expects a JSON object, so we parse the string from the env var.
    const serviceAccount = JSON.parse(serviceAccountString);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    console.log("Firebase Admin SDK initialized successfully for Authentication.");
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error.message);
    // In a real app, you might want to handle this more gracefully
    // For now, logging the error is crucial for debugging.
  }
}

export const auth = admin.auth();
