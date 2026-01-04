import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/* 🔥 CONFIG FIREBASE */
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

/* 🌍 ESTADO GLOBAL */
let currentUser = null;
let calendarMonth;
let calendarYear;
let calendarVisible = true;

/* 🎯 ELEMENTOS */
const loginBtn = document.getElementById("login");
const appEl = document.getElementById("app");
const datePicker = document.getElementById("datePicker");
const diaryText = document.getElementById("diaryText");
const saveBtn = document.getElementById("saveDiary");
const statusEl = document.getElementById("status");
const calendarEl = document.getElementById("calendar");
const calendarLabel = document.getElementById("calendarLabel");
const allEntriesEl = document.getElementById("allEntries");

/* 🔐 LOGIN */
loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  currentUser = result.user;

  const today = new Date();
  calendarMonth = today.getMonth();
  calendarYear = today.getFullYear();

  loginBtn.hidden = true;
  appEl.hidden = false;

  setupDatePicker();
  renderCalendar();
  loadAllEntries();
};

/* 📅 DATE PICKER */
function setupDatePicker() {
  const today = new Date().toISOString().split("T")[0];
  datePicker.max = today;
  datePicker.value = today;

  datePicker.onchange = () => loadEntryForDate(datePicker.value);
  loadEntryForDate(today);
}

/* 💾 SALVAR */
saveBtn.onclick = async () => {
  const date = datePicker.value;
  if (!date) return;

  saveBtn.disabled = true;
  statusEl.textContent = "Salvando...";

  const ref = doc(db, "entries", `${currentUser.uid}_${date}`);

  await setDoc(ref, {
    userId: currentUser.uid,
    date,
    text: diaryText.value,
    updatedAt: serverTimestamp()
  });

  statusEl.textContent = "✅ Diário salvo!";
  saveBtn.disabled = false;

  renderCalendar();
  loadAllEntries();
};

/* 📖 CARREGAR POR DATA */
async function loadEntryForDate(date) {
  diaryText.value = "";
  const ref = doc(db, "entries", `${currentUser.uid}_${date}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    diaryText.value = snap.data().text || "";
  }
}

/* 📆 CALENDÁRIO */
function renderCalendar() {
  calendarEl.innerHTML = "";

  const today = new Date();
  const year = calendarYear;
  const month = calendarMonth;

  updateCalendarLabel();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    calendarEl.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.textContent = day;

    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const cellDate = new Date(dateStr);

    if (cellDate > today) {
      cell.classList.add("disabled");
    } else {
      cell.onclick = () => {
        datePicker.value = dateStr;
        loadEntryForDate(dateStr);
      };
    }

    calendarEl.appendChild(cell);
  }

  markFilledDays(year, month);
}

async function markFilledDays(year, month) {
  const snapshot = await getDocs(collection(db, "entries"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (
      data.userId === currentUser.uid &&
      data.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
    ) {
      const day = parseInt(data.date.split("-")[2]);
      const index = new Date(year, month, day).getDay() + day - 1;
      const cell = calendarEl.children[index];
      if (cell) cell.classList.add("filled");
    }
  });
}

/* 🏷 LABEL */
function updateCalendarLabel() {
  const date = new Date(calendarYear, calendarMonth);
  calendarLabel.textContent = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
}

/* ◀ ▶ NAVEGAÇÃO */
document.getElementById("prevMonth").onclick = () => {
  calendarMonth--;
  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear--;
  }
  renderCalendar();
};

document.getElementById("nextMonth").onclick = () => {
  const next = new Date(calendarYear, calendarMonth + 1);
  const today = new Date();

  if (next > new Date(today.getFullYear(), today.getMonth())) return;

  calendarMonth++;
  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear++;
  }
  renderCalendar();
};

/* 👁 TOGGLE CALENDÁRIO */
document.getElementById("calendarTitle").onclick = () => {
  calendarVisible = !calendarVisible;
  calendarEl.style.display = calendarVisible ? "grid" : "none";
  document.getElementById("calendarControls").style.display =
    calendarVisible ? "flex" : "none";
};

/* 📚 TODAS MEMÓRIAS */
async function loadAllEntries() {
  allEntriesEl.innerHTML = "";

  const snapshot = await getDocs(collection(db, "entries"));

  snapshot.forEach(docSnap => {
    const e = docSnap.data();
    if (e.userId !== currentUser.uid) return;

    const div = document.createElement("div");
    div.className = "entry";
    div.innerHTML = `<strong>${e.date}</strong><p>${e.text}</p>`;
    allEntriesEl.appendChild(div);
  });
}
