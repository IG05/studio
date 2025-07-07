
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Using the configuration you provided directly to resolve the API key error.
const firebaseConfig = {
  apiKey: "AIzaSyAFU8irYZ-Y9mYN4vXp-foPLpYgZ-ncnYQ",
  authDomain: "s3-commander-6mgz9.firebaseapp.com",
  projectId: "s3-commander-6mgz9",
  storageBucket: "s3-commander-6mgz9.appspot.com",
  messagingSenderId: "66760537132",
  appId: "1:66760537132:web:04dd511c302ad4ee29cd89"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
