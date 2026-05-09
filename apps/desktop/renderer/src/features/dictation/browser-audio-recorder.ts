export interface BrowserAudioRecorder {
  readonly stop: () => Promise<{ readonly wavBytes: Uint8Array; readonly durationMs: number }>;
}

export const startBrowserAudioRecorder = async (
  microphoneDeviceId: string | null,
): Promise<BrowserAudioRecorder> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true,
  });
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { readonly webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const mutedOutput = audioContext.createGain();
  const chunks: Float32Array[] = [];

  mutedOutput.gain.value = 0;
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(mutedOutput);
  mutedOutput.connect(audioContext.destination);

  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      mutedOutput.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();

      const samples = mergeChunks(chunks);
      const durationMs = Math.round((samples.length / audioContext.sampleRate) * 1000);

      return {
        wavBytes: encodeWav(samples, audioContext.sampleRate),
        durationMs,
      };
    },
  };
};

const mergeChunks = (chunks: readonly Float32Array[]): Float32Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  return samples;
};

const encodeWav = (samples: Float32Array, sampleRate: number): Uint8Array => {
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(
      44 + index * bytesPerSample,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }

  return new Uint8Array(buffer);
};

const writeAscii = (view: DataView, offset: number, value: string) => {
  for (let index = 0; index < value.length; index++) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
};
