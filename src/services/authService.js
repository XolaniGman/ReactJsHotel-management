import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUserDoc, isAdminAccount } from './userService';

export const authErrors = (err) => {
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/user-disabled': 'This account has been disabled. Contact hotel administration.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/operation-not-allowed': 'Email and password sign-in is disabled in Firebase Authentication.',
    'auth/api-key-not-valid': 'The Firebase API key is invalid for this application.',
    'auth/invalid-api-key': 'The Firebase API key is invalid for this application.',
    'auth/internal-error': 'Firebase could not complete sign-in. Check the Authentication configuration and try again.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return map[err?.code] || err?.message || 'Something went wrong. Please try again.';
};

export const registerUser = async ({ firstName, lastName, email, password }) => {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await createUserDoc(cred.user.uid, {
    name: `${firstName} ${lastName}`.trim(),
    email: email.trim(),
    role: isAdminAccount(email) ? 'admin' : 'guest',
  });
  await sendEmailVerification(cred.user);
  return cred.user;
};

export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);

export const logoutUser = () => signOut(auth);

export const resendVerification = () => {
  if (auth.currentUser) return sendEmailVerification(auth.currentUser);
  return Promise.reject(new Error('No signed-in user.'));
};
