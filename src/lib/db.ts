import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  uid: string;
  email: string;
  subscriptionStatus: 'free_trial' | 'active' | 'expired';
  trialUsedSeconds: number;
  planId?: string;
  planRegion?: string;
  planEndTimestamp?: number;
}

export const getUserProfile = async (uid: string, email: string): Promise<UserProfile> => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  } else {
    const newProfile: UserProfile = {
      uid,
      email,
      subscriptionStatus: 'free_trial',
      trialUsedSeconds: 0,
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  }
};

export const updateTrialSeconds = async (uid: string, seconds: number) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    trialUsedSeconds: seconds
  });
};

export const activateSubscription = async (uid: string, planId: string, planRegion: string) => {
  const userRef = doc(db, 'users', uid);
  const now = Date.now();
  const durationMs = planId === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  
  await updateDoc(userRef, {
    subscriptionStatus: 'active',
    planId,
    planRegion,
    planEndTimestamp: now + durationMs
  });
};
