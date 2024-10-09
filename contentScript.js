let audioContext;
let audioChunks = [];

function startAudioCapture() {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        audioChunks.push(new Float32Array(audioData));

        // Send audio data every second (adjust as needed)
        if (audioChunks.length >= 44) {
          // ~1 second of audio at 44.1kHz
          const audioBlob = exportWAV(audioChunks);
          audioBlob.arrayBuffer().then((buffer) => {
            chrome.runtime.sendMessage({
              action: "audioData",
              data: Array.from(new Uint8Array(buffer)),
            });
          });
          audioChunks = [];
        }
      };
    })
    .catch((error) => console.error("Error accessing microphone:", error));
}

function exportWAV(audioChunks) {
  const wavBuffer = createWavBuffer(audioChunks);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function createWavBuffer(audioChunks) {
  const numChannels = 1;
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  let numSamples = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    numSamples += audioChunks[i].length;
  }

  const wavBuffer = new ArrayBuffer(44 + numSamples * bytesPerSample);
  const view = new DataView(wavBuffer);

  // WAV Header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + numSamples * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, numSamples * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < audioChunks.length; i++) {
    for (let j = 0; j < audioChunks[i].length; j++) {
      const sample = Math.max(-1, Math.min(1, audioChunks[i][j]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return wavBuffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function stopAudioCapture() {
  if (audioContext) {
    audioContext.close();
  }
}

startAudioCapture();

window.addEventListener("message", (event) => {
  if (event.data.type === "STOP_CAPTURE") {
    stopAudioCapture();
  }
});
