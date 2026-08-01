export interface UserProfile {
  uid: string;
  email: string;
  subscriptionStatus: 'free_trial' | 'active' | 'expired';
  trialUsedSeconds: number;
  planId?: string;
  planRegion?: string;
  planEndTimestamp?: number;
}

const getLocalData = () => {
  const data = localStorage.getItem('linguachat_db');
  return data ? JSON.parse(data) : { users: {} };
};

const saveLocalData = (data: any) => {
  localStorage.setItem('linguachat_db', JSON.stringify(data));
};

export const getUserProfile = async (uid: string, email: string): Promise<UserProfile> => {
  const db = getLocalData();
  if (db.users[uid]) {
    return db.users[uid] as UserProfile;
  } else {
    const newProfile: UserProfile = {
      uid,
      email,
      subscriptionStatus: 'free_trial',
      trialUsedSeconds: 0,
    };
    db.users[uid] = newProfile;
    saveLocalData(db);
    return newProfile;
  }
};

export const updateTrialSeconds = async (uid: string, seconds: number) => {
  const db = getLocalData();
  if (db.users[uid]) {
    db.users[uid].trialUsedSeconds = seconds;
    saveLocalData(db);
  }
};

export const activateSubscription = async (uid: string, planId: string, planRegion: string) => {
  const db = getLocalData();
  const now = Date.now();
  const durationMs = planId === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  
  if (db.users[uid]) {
    db.users[uid].subscriptionStatus = 'active';
    db.users[uid].planId = planId;
    db.users[uid].planRegion = planRegion;
    db.users[uid].planEndTimestamp = now + durationMs;
    saveLocalData(db);
  }
};
