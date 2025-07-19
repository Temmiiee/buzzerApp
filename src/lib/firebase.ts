// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// TODO: Add your own Firebase configuration here
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY', // Remplacer par votre clé API
  authDomain: 'YOUR_AUTH_DOMAIN', // Remplacer par votre domaine d'authentification
  databaseURL: 'YOUR_DATABASE_URL', // IMPORTANT: Remplacer par l'URL de votre Realtime Database
  projectId: 'YOUR_PROJECT_ID', // Remplacer par votre ID de projet
  storageBucket: 'YOUR_STORAGE_BUCKET', // Remplacer par votre bucket de stockage
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID', // Remplacer par votre ID d'expéditeur
  appId: 'YOUR_APP_ID', // Remplacer par votre ID d'application
};

// Check if all placeholder values have been replaced
export const isFirebaseConfigured = () => {
  return Object.values(firebaseConfig).every(value => !value.startsWith('YOUR_'));
};


// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database = isFirebaseConfigured() ? getDatabase(app) : null;

export { database, app };
