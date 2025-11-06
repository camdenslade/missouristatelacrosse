// src/firebase/firebaseAuth.js
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

import { auth } from "./firebaseConfig";

// Login
export const login = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

// Signup
export const signup = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

// Logout
export const logout = async () => {
  await signOut(auth);
};
