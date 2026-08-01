import { initializeApp, getApps } from "firebase/app";
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBK_S9EBvB_LhR9koiatRknNbL5A6Arp6k",
  authDomain: "leafy-creek-z8gvj.firebaseapp.com",
  projectId: "leafy-creek-z8gvj",
  storageBucket: "leafy-creek-z8gvj.firebasestorage.app",
  messagingSenderId: "442765262051",
  appId: "1:442765262051:web:49f39bc7a4e02eb15259d6",
  firestoreDatabaseId: "ai-studio-3b8cf2d3-5ce1-45ad-9e86-9ec62ae351c8"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
      console.error("Error signing in with Google", error);
    }
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
