let deepgramSocket = null;

const DEEPGRAM_API_KEY = "663b37adb682cef7e0e49dab4b42ced3f1e6e319";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startCapture") {
    startCapture().then(sendResponse);
    return true;
  } else if (request.action === "stopCapture") {
    stopCapture().then(sendResponse);
    return true;
  } else if (request.action === "audioData") {
    handleAudioData(request.data);
  }
});

async function startCapture() {
  console.log("Starting capture...");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["contentScript.js"],
    });
    setupDeepgramConnection();
    return { success: true };
  } catch (error) {
    console.error("Error in startCapture:", error);
    return { error: "Error in startCapture: " + error.message };
  }
}

async function setupDeepgramConnection() {
  const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=48000&channels=1`;

  deepgramSocket = new WebSocket(deepgramUrl);

  deepgramSocket.onopen = () => {
    console.log("Deepgram WebSocket connection opened");
    deepgramSocket.send(JSON.stringify({ authorization: DEEPGRAM_API_KEY }));
  };

  deepgramSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (
      data.channel &&
      data.channel.alternatives &&
      data.channel.alternatives[0]
    ) {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript) {
        chrome.runtime.sendMessage({
          action: "transcription",
          text: transcript,
        });
      }
    }
  };

  deepgramSocket.onerror = (error) => {
    console.error("Deepgram WebSocket error:", error);
  };

  deepgramSocket.onclose = () => {
    console.log("Deepgram WebSocket connection closed");
  };
}

function handleAudioData(audioData) {
  if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
    deepgramSocket.send(audioData);
  }
}

async function stopCapture() {
  if (deepgramSocket) {
    deepgramSocket.close();
    deepgramSocket = null;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => {
      window.postMessage({ type: "STOP_CAPTURE" }, "*");
    },
  });
  return { success: true };
}
