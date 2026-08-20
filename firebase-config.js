// firebase-config.js - Configuração e Inicialização do Firebase (Auth & Firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciais do Firebase. Substitua pelos valores do seu projeto no Console do Firebase (Project Settings -> SDK setup)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Inicializa o Firebase (Com tratamento para credenciais pendentes)
let app, auth, db, googleProvider;
let firebaseInitialized = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    firebaseInitialized = true;
    console.log("🔥 Firebase inicializado com sucesso!");
  } else {
    console.warn("⚠️ Firebase não configurado. Insira suas credenciais em firebase-config.js");
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
}

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  firebaseInitialized, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
};
