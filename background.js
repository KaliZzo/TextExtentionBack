let whisperAPIKey = "secret";
let isRecording = false;

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
  isRecording = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { action: "startCapture" });
    return { success: true };
  } catch (error) {
    console.error("Error in startCapture:", error);
    return { error: "Error in startCapture: " + error.message };
  }
}

async function stopCapture() {
  console.log("Stopping capture...");
  isRecording = false;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id, { action: "stopCapture" });
    return { success: true };
  } catch (error) {
    console.error("Error in stopCapture:", error);
    return { error: "Error in stopCapture: " + error.message };
  }
}

function handleAudioData(audioData) {
  if (isRecording) {
    sendAudioToWhisper(audioData);
  }
}

async function sendAudioToWhisper(audioData) {
  console.log("Sending audio to Whisper API...");

  const audioBlob = new Blob([new Uint8Array(audioData)], {
    type: "audio/wav",
  });

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whisperAPIKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`
      );
    }

    const result = await response.json();
    console.log("Transcription result:", result);

    if (result.text) {
      chrome.runtime.sendMessage({
        action: "transcription",
        text: result.text,
      });
    }
  } catch (error) {
    console.error("Error sending audio to Whisper:", error);
  }
}

console.log("Background script loaded");
