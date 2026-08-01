export function pcmToBase64(pcmData: Float32Array): string {
  // Convert 32-bit float PCM to 16-bit integer PCM
  const int16Data = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    // Math.max(-1, Math.min(1, x)) clamps the value between -1 and 1
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Convert Int16Array to binary string
  const uint8Data = new Uint8Array(int16Data.buffer);
  let binary = '';
  for (let i = 0; i < uint8Data.length; i++) {
    binary += String.fromCharCode(uint8Data[i]);
  }

  return btoa(binary);
}

export function base64ToPcm(base64: string): Int16Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}
