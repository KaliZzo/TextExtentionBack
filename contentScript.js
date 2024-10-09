let audioContext;
let mediaStreamSource;
let scriptProcessor;

function startAudioCapture() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => {
      mediaStreamSource = audioContext.createMediaStreamSource(stream);
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      mediaStreamSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Convert Float32Array to Int16Array
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          int16Array[i] = Math.max(
            -32768,
            Math.min(32767, Math.floor(inputData[i] * 32768))
          );
        }

        chrome.runtime.sendMessage({
          action: "audioData",
          data: int16Array.buffer,
        });
      };
    })
    .catch((error) => console.error("Error accessing microphone:", error));
}

function stopAudioCapture() {
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

startAudioCapture();

window.addEventListener("message", (event) => {
  if (event.data.type === "STOP_CAPTURE") {
    stopAudioCapture();
  }
});
