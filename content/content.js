(function () {
  const STREAM_URL_PATTERN = /\/api\/v1\/pgworkout\/(\d+)\/stream\//;

  function getWorkoutIdFromUrl() {
    const match = window.location.pathname.match(/\/workouts\/(\d+)/);
    return match ? match[1] : null;
  }

  function downloadFit(workoutId, data) {
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

  async function fetchStreamData(workoutId) {
    const resp = await fetch(`/api/v1/pgworkout/${workoutId}/stream/`);
    if (!resp.ok) return null;
    return await resp.json();
  }

  function storeStreamData(workoutId, data) {
    chrome.storage.session.set({ [`stream_${workoutId}`]: data });
  }

  async function loadStreamData(workoutId) {
    return new Promise((resolve) => {
      chrome.storage.session.get(`stream_${workoutId}`, (result) => {
        resolve(result[`stream_${workoutId}`] || null);
      });
    });
  }

  // Monkey-patch fetch to intercept stream API responses
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    const match = url?.match(STREAM_URL_PATTERN);
    if (match) {
      const workoutId = match[1];
      const cloned = response.clone();
      try {
        const data = await cloned.json();
        storeStreamData(workoutId, data);
      } catch (e) {
        // ignore parse errors
      }
    }

    return response;
  };

  // Inject download button on page
  function injectButton() {
    if (document.getElementById("xingzhe-fit-download-btn")) return;

    const workoutId = getWorkoutIdFromUrl();
    if (!workoutId) return;

    // Find the first info_btn_box (点赞) to insert before it
    const firstBox = document.querySelector(".info_btn_box");
    if (!firstBox) return;

    // Build a matching info_btn_box from scratch
    const box = document.createElement("div");
    box.className = "flex-col flex-justify-b flex-align-c info_btn_box";
    box.id = "xingzhe-fit-download-btn";
    box.style.cursor = "pointer";
    box.innerHTML = `
      <div class="btn_img van-image" style="width: 1.2rem;">💾</div>
      <div>下载FIT</div>
    `;

    box.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      let data = await loadStreamData(workoutId);
      if (!data) {
        data = await fetchStreamData(workoutId);
        if (data) storeStreamData(workoutId, data);
      }

      if (data) {
        downloadFit(workoutId, data);
      } else {
        alert("No workout data available. Try reloading the page.");
      }
    });

    firstBox.parentNode.insertBefore(box, firstBox);
  }

  // Use MutationObserver since buttons load dynamically
  function waitForButtons() {
    if (document.querySelector(".info_btn_box")) {
      injectButton();
      return;
    }
    const observer = new MutationObserver((mutations, obs) => {
      if (document.querySelector(".info_btn_box")) {
        injectButton();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForButtons);
  } else {
    waitForButtons();
  }
})();
