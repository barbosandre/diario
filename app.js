import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* 🔥 CONFIG FIREBASE */
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "XXXXX",
  appId: "XXXXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

/* 📌 ELEMENTOS */
const loginBtn = document.getElementById("login");
const appEl = document.getElementById("app");
const diary = document.getElementById("diary");
const datePicker = document.getElementById("datePicker");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const pastEl = document.getElementById("past");

let currentUser = null;
let currentDate = null;

/* 🔐 LOGIN */
loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  currentUser = result.user;

  loginBtn.hidden = true;
  appEl.hidden = false;

  setupDatePicker();
};

/* 📅 CONFIGURA CALENDÁRIO */
function setupDatePicker() {
  const today = new Date().toISOString().split("T")[0];
  datePicker.max = today;
  datePicker.value = today;

  loadEntryForDate(today);

  datePicker.onchange = () => {
    loadEntryForDate(datePicker.value);
  };
}

/* 📖 CARREGA ENTRADA */
async function loadEntryForDate(dateStr) {
  currentDate = dateStr;
  diary.value = "";
  pastEl.innerHTML = "";
  statusEl.textContent = "";

  const [year, month, day] = dateStr.split("-").map(Number);
  const id = `${currentUser.uid}_${dateStr}`;

  const ref = doc(db, "entries", id);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    diary.value = snap.data().text || "";
  }

  loadPastMemories(day, month, year);
}

/* 💾 SALVAR */
saveBtn.onclick = async () => {
  if (!currentDate) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";

  const [year, month, day] = currentDate.split("-").map(Number);
  const ref = doc(db, "entries", `${currentUser.uid}_${currentDate}`);

  await setDoc(ref, {
    userId: currentUser.uid,
    day,
    month,
    year,
    date: currentDate,
    text: diary.value,
    updatedAt: serverTimestamp()
  });

  saveBtn.disabled = false;
  saveBtn.textContent = "Salvar diário";
  statusEl.textContent = "✅ Diário salvo com sucesso!";
};

/* ⏪ MEMÓRIAS DO MESMO DIA EM OUTROS ANOS */
async function loadPastMemories(day, month, year) {
  const q = query(
    collection(db, "entries"),
    where("userId", "==", currentUser.uid),
    where("day", "==", day),
    where("month", "==", month),
    where("year", "<", year),
    orderBy("year", "desc")
  );

  const snap = await getDocs(q);

  snap.forEach(d => {
    const e = d.data();
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${e.day}/${e.month}/${e.year}</strong>
      <p>${e.text}</p>
    `;
    pastEl.appendChild(div);
  });
}
