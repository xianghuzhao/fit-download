const STREAM_URL_PATTERN = /\/api\/v1\/pgworkout\/(\d+)\/stream\//;

const workoutIdEl = document.getElementById("workoutId");
const statusEl = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");

function downloadFit(workoutId, data) {
  // We need the converter — use a simplified inline version for the popup
  const fitData = convertToFit(data);
  const blob = new Blob([fitData], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workout_${workoutId}.fit`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadStreamData(workoutId) {
  return new Promise((resolve) => {
    chrome.storage.session.get(`stream_${workoutId}`, (result) => {
      resolve(result[`stream_${workoutId}`] || null);
    });
  });
}

async function fetchStreamData(workoutId) {
  const resp = await fetch(
    `https://www.imxingzhe.com/api/v1/pgworkout/${workoutId}/stream/`
  );
  if (!resp.ok) return null;
  return await resp.json();
}

async function init() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.url) {
    statusEl.textContent = "Not on a workout page.";
    return;
  }

  const match = tab.url.match(/\/workouts\/(\d+)/);
  if (!match) {
    statusEl.textContent = "Not on a workout page.";
    return;
  }

  const workoutId = match[1];
  workoutIdEl.textContent = `Workout: ${workoutId}`;

  // Try loading from session storage first
  let data = await loadStreamData(workoutId);

  if (data) {
    statusEl.textContent = "Data ready.";
    downloadBtn.disabled = false;
  } else {
    statusEl.textContent = "Fetching data…";
    data = await fetchStreamData(workoutId);
    if (data) {
      chrome.storage.session.set({ [`stream_${workoutId}`]: data });
      statusEl.textContent = "Data ready.";
      downloadBtn.disabled = false;
    } else {
      statusEl.textContent = "Failed to fetch data. Try reloading the page.";
    }
  }

  downloadBtn.addEventListener("click", async () => {
    if (!data) {
      data = await loadStreamData(workoutId);
      if (!data) data = await fetchStreamData(workoutId);
    }
    if (data) {
      downloadFit(workoutId, data);
    }
  });
}

init();
