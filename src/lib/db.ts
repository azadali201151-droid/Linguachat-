import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type SubscriptionStatus = 'free_trial' | 'active' | 'expired';

export interface UserProfile {
  uid: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  trialUsedSeconds: number;
  planEndTimestamp: number | null;
  planType: 'weekly' | 'monthly' | null;
  region: 'pakistan' | 'other' | null;
}

export const getUserProfile = async (uid: string, email: string): Promise<UserProfile> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  } else {
    const newUser: UserProfile = {
      uid,
      email,
      subscriptionStatus: 'free_trial',
      trialUsedSeconds: 0,
      planEndTimestamp: null,
      planType: null,
      region: null,
    };
    await setDoc(userRef, newUser);
    return newUser;
  }
};

export const updateTrialSeconds = async (uid: string, seconds: number) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { trialUsedSeconds: seconds });
};

export const activateSubscription = async (uid: string, planType: 'weekly' | 'monthly', region: 'pakistan' | 'other') => {
  const userRef = doc(db, 'users', uid);
  const days = planType === 'weekly' ? 7 : 30;
  // Set end timestamp based on Pakistan time? We can just use UTC + 5 roughly or just current Date
  const now = new Date();
  now.setDate(now.getDate() + days);
  
  await updateDoc(userRef, {
    subscriptionStatus: 'active',
    planEndTimestamp: now.getTime(),
    planType,
    region,
    trialUsedSeconds: 60 // Max out trial so they don't get free trial again
  });
};
