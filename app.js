import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

 const firebaseConfig = {
    apiKey: "AIzaSyDW-Om3EpMFVK5H1BfHKkR2IFz5Qpj7IFI",
    authDomain: "diario-40d9e.firebaseapp.com",
    projectId: "diario-40d9e",
    storageBucket: "diario-40d9e.firebasestorage.app",
    messagingSenderId: "39169574766",
    appId: "1:39169574766:web:0ef47ca500c2d8d8dba37f",
    measurementId: "G-SLGTSXX5QN"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const loginBtn = document.getElementById("login");
const appEl = document.getElementById("app");

loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  loginBtn.hidden = true;
  appEl.hidden = false;
  init(result.user);
};

async function init(user) {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const dateId = `${year}-${month}-${day}`;
  document.getElementById("date").innerText =
    `${day}/${month}/${year}`;

  const textarea = document.getElementById("diary");

  // Carregar entrada do dia
  const ref = doc(db, "entries", `${user.uid}_${dateId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    textarea.value = snap.data().text || "";
  }

  // Autosave
  textarea.addEventListener("input", () =>
    saveEntry(user.uid, ref, day, month, year, textarea.value)
  );

  loadPastMemories(user.uid, day, month, year);
}

async function saveEntry(uid, ref, day, month, year, text) {
  await setDoc(ref, {
    userId: uid,
    day,
    month,
    year,
    text,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function loadPastMemories(uid, day, month, year) {
  const q = query(
    collection(db, "entries"),
    where("userId", "==", uid),
    where("day", "==", day),
    where("month", "==", month),
    where("year", "<", year),
    orderBy("year", "desc")
  );

  const snapshot = await getDocs(q);
  const past = document.getElementById("past");

  snapshot.forEach(doc => {
    const e = doc.data();
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${e.day}/${e.month}/${e.year}</strong>
      <p>${e.text}</p>
    `;
    past.appendChild(div);
  });
}

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /entries/{doc} {
      allow read, write: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
  }
}
