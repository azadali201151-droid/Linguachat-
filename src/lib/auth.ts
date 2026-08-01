export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

let currentUser: User | null = null;
const listeners: ((user: User | null) => void)[] = [];

export const auth = {
  get currentUser() {
    return currentUser;
  },
};

export const onAuthStateChanged = (authObj: any, callback: (user: User | null) => void) => {
  listeners.push(callback);
  
  const storedUser = localStorage.getItem('linguachat_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
    } catch(e) {}
  }
  
  callback(currentUser);
  
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l(currentUser));
};

export const signIn = async (email: string, code: string) => {
  const usersStr = localStorage.getItem('linguachat_users_db');
  const users = usersStr ? JSON.parse(usersStr) : {};
  
  if (!users[email]) {
    throw new Error('User not found. Please register first.');
  }
  
  if (users[email].password !== code) {
    throw new Error('Invalid code/password');
  }
  
  currentUser = {
    uid: users[email].uid,
    email: users[email].email,
    displayName: users[email].displayName || null,
    photoURL: null,
  };
  
  localStorage.setItem('linguachat_user', JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
};

export const register = async (email: string, code: string, name?: string) => {
  const usersStr = localStorage.getItem('linguachat_users_db');
  const users = usersStr ? JSON.parse(usersStr) : {};
  
  if (users[email]) {
    throw new Error('User already exists. Please log in.');
  }
  
  const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  users[email] = {
    uid,
    email,
    password: code,
    displayName: name || email.split('@')[0],
  };
  
  localStorage.setItem('linguachat_users_db', JSON.stringify(users));
  
  return true;
};

export const deleteUserAccount = async (email: string) => {
  const usersStr = localStorage.getItem('linguachat_users_db');
  const users = usersStr ? JSON.parse(usersStr) : {};
  
  if (users[email]) {
    delete users[email];
    localStorage.setItem('linguachat_users_db', JSON.stringify(users));
  }
};

export const logout = async () => {
  currentUser = null;
  localStorage.removeItem('linguachat_user');
  notifyListeners();
};
