import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureUserDoc, getUser } from '../services/userService';
import {
  authErrors,
  loginUser,
  logoutUser,
  registerUser,
  resendVerification,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const fallbackName = fbUser.email
          ? fbUser.email.split('@')[0].replace(/[._-]/g, ' ')
          : 'Guest';
        try {
          const profile = await ensureUserDoc(fbUser.uid, fbUser.email, fallbackName);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            emailVerified: fbUser.emailVerified,
            ...profile,
          });
        } catch {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            emailVerified: fbUser.emailVerified,
            name: fallbackName,
            role: 'guest',
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refresh = async () => {
    if (!auth.currentUser) return;
    const profile = await getUser(auth.currentUser.uid);
    if (profile) {
      setUser((u) => ({
        ...u,
        ...profile,
        emailVerified: auth.currentUser.emailVerified,
      }));
    }
  };

  const login = async (email, password) => {
    try {
      await loginUser(email, password);
      return { user: true };
    } catch (err) {
      return { error: authErrors(err) };
    }
  };

  const register = async ({ firstName, lastName, email, password }) => {
    try {
      await registerUser({ firstName, lastName, email, password });
      return { ok: true };
    } catch (err) {
      return { error: authErrors(err) };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // ignore
    }
  };

  const sendVerificationEmail = async () => {
    try {
      await resendVerification();
      return { ok: true };
    } catch (err) {
      return { error: authErrors(err) };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, sendVerificationEmail }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
