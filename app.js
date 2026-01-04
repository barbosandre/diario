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
  const datePicker = document.getElementById("datePicker");
  const textarea = document.getElementById("diary");

  const today = new Date().toISOString().split("T")[0];
  datePicker.max = today;
  datePicker.value = today;

  await loadEntryForDate(user, today);

  renderCalendar(user, new Date().getFullYear(), new Date().getMonth() + 1);

  datePicker.addEventListener("change", async () => {
    await loadEntryForDate(user, datePicker.value);
  });

  textarea.addEventListener("input", async () => {
    await saveEntryForDate(user, datePicker.value, textarea.value);
  });
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

async function loadEntryForDate(user, dateStr) {
  const textarea = document.getElementById("diary");
  textarea.value = "";

  const [year, month, day] = dateStr.split("-").map(Number);

  document.getElementById("date").innerText =
    `${day}/${month}/${year}`;

  const ref = doc(db, "entries", `${user.uid}_${dateStr}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    textarea.value = snap.data().text || "";
  }

  document.getElementById("past").innerHTML =
    "<h2>Neste dia em outros anos</h2>";

  loadPastMemories(user.uid, day, month, year);
}

async function saveEntryForDate(user, dateStr, text) {
  const [year, month, day] = dateStr.split("-").map(Number);

  const ref = doc(db, "entries", `${user.uid}_${dateStr}`);

  await setDoc(ref, {
    userId: user.uid,
    day,
    month,
    year,
    text,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

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
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const btn = document.createElement("button");
    btn.textContent = day;

    if (filled[day]) btn.classList.add("filled");
    if (dateStr > today) btn.disabled = true;

    btn.onclick = () => {
      document.getElementById("datePicker").value = dateStr;
      loadEntryForDate(user, dateStr);
    };

    cal.appendChild(btn);
  }
}
