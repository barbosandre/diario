// ========================
// Firebase imports
// ========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
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

// ========================
// Firebase config
// ========================
const firebaseConfig = {
  apiKey: "AIzaSyDW-Om3EpMFVK5H1BfHKkR2IFz5Qpj7IFI",
  authDomain: "diario-40d9e.firebaseapp.com",
  projectId: "diario-40d9e",
  storageBucket: "diario-40d9e.firebasestorage.app",
  messagingSenderId: "39169574766",
  appId: "1:39169574766:web:0ef47ca500c2d8d8dba37f",
  measurementId: "G-SLGTSXX5QN"
};

// ========================
// Init Firebase
// ========================
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// ========================
// Elements
// ========================
const loginBtn = document.getElementById("login");
const appEl = document.getElementById("app");

// ========================
// Login
// ========================
loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  loginBtn.hidden = true;
  appEl.hidden = false;

  await init(result.user);
};

// ========================
// INIT
// ========================
async function init(user) {
  const datePicker = document.getElementById("datePicker");
  const textarea = document.getElementById("diary");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  const today = new Date().toISOString().split("T")[0];

  datePicker.max = today;
  datePicker.value = today;

  await loadEntryForDate(user, today);
  await renderCalendar(user, new Date().getFullYear(), new Date().getMonth() + 1);

  // Troca de data
  datePicker.addEventListener("change", async () => {
    await loadEntryForDate(user, datePicker.value);
  });

  // ========================
  // SALVAR DIÁRIO (UX COMPLETA)
  // ========================
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";
    status.textContent = "Salvando diário...";
    textarea.style.border = "";

    try {
      await saveEntryForDate(user, datePicker.value, textarea.value);

      // 🔁 Recarrega do Firestore (fonte da verdade)
      await loadEntryForDate(user, datePicker.value);

      // ✅ Feedback visual forte
      saveBtn.textContent = "Salvo ✔";
      status.textContent = "Diário salvo com sucesso ✔";
      textarea.style.border = "2px solid #4caf50";

      setTimeout(() => {
        saveBtn.textContent = "Salvar diário";
        status.textContent = "";
        textarea.style.border = "";
      }, 2500);

      const [year, month] = datePicker.value.split("-").map(Number);
      await renderCalendar(user, year, month);

    } catch (err) {
      console.error(err);
      status.textContent = "Erro ao salvar. Tente novamente.";
      saveBtn.textContent = "Salvar diário";
    } finally {
      saveBtn.disabled = false;
    }
  };
}

// ========================
// LOAD ENTRY FOR DATE
// ========================
async function loadEntryForDate(user, dateStr) {
  const textarea = document.getElementById("diary");
  const past = document.getElementById("past");

  // 🔴 RESET TOTAL DE ESTADO
  textarea.value = "";
  past.innerHTML = "<h2>Neste dia em outros anos</h2>";

  const [year, month, day] = dateStr.split("-").map(Number);

  document.getElementById("date").innerText =
    `${day}/${month}/${year}`;

  const ref = doc(db, "entries", `${user.uid}_${dateStr}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    textarea.value = snap.data().text || "";
  }

  await loadPastMemories(user.uid, day, month, year);
}

// ========================
// SAVE ENTRY
// ========================
async function saveEntryForDate(user, dateStr, text) {
  if (!text.trim()) return;

  const [year, month, day] = dateStr.split("-").map(Number);
  const ref = doc(db, "entries", `${user.uid}_${dateStr}`);

  await setDoc(ref, {
    userId: user.uid,
    day,
    month,
    year,
    text,
    updatedAt: serverTimestamp()
  });
}

// ========================
// PAST MEMORIES
// ========================
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

  snapshot.forEach(docSnap => {
    const e = docSnap.data();
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${e.day}/${e.month}/${e.year}</strong>
      <p>${e.text}</p>
    `;
    past.appendChild(div);
  });
}

// ========================
// CALENDAR
// ========================
async function renderCalendar(user, year, month) {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";

  const today = new Date().toISOString().split("T")[0];

  const q = query(
    collection(db, "entries"),
    where("userId", "==", user.uid),
    where("year", "==", year),
    where("month", "==", month)
  );

  const snap = await getDocs(q);
  const filled = {};

  snap.forEach(d => filled[d.data().day] = true);

  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const dateStr =
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const btn = document.createElement("button");
    btn.textContent = day;

    if (filled[day]) btn.classList.add("filled");
    if (dateStr > today) btn.disabled = true;

    btn.onclick = async () => {
      document.getElementById("datePicker").value = dateStr;
      await loadEntryForDate(user, dateStr);
    };

    cal.appendChild(btn);
  }
}
