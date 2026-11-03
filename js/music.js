const audio = new Audio();
audio.preload = "metadata";
let tracks = [];
let currentIndex = -1;
let shuffle = false;
let repeat = false;
let progressTimer = null;
let audioContext = null;
let analyser = null;
let frequencyData = null;

const current = () => tracks[currentIndex] || null;

async function prepareAudioAnalysis() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;
  if (!audioContext) {
    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") await audioContext.resume();
  return true;
}

export function getMusicState() {
  if (analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
  return { tracks: tracks.map((track) => ({ name: track.name, local: track.local })), currentIndex, playing: !audio.paused, shuffle, repeat, volume: audio.volume, duration: audio.duration || 0, currentTime: audio.currentTime || 0, frequencies: frequencyData ? [...frequencyData] : [] };
}

export function addMusicFiles(files) {
  const accepted = [...files].filter((file) => file.type.startsWith("audio/"));
  accepted.forEach((file) => tracks.push({ name: file.name, url: URL.createObjectURL(file), local: true }));
  if (currentIndex < 0 && tracks.length) currentIndex = 0;
  return { added: accepted.length, rejected: files.length - accepted.length };
}

export function selectTrack(index) {
  if (!Number.isInteger(index) || index < 0 || index >= tracks.length) return false;
  currentIndex = index;
  audio.src = current().url;
  audio.load();
  return true;
}

export async function togglePlayback() {
  if (!current()) return false;
  if (!audio.src) audio.src = current().url;
  if (audio.paused) { await prepareAudioAnalysis(); await audio.play(); return true; }
  audio.pause();
  return false;
}

export function seekMusic(time) {
  if (Number.isFinite(time) && audio.duration) audio.currentTime = Math.min(audio.duration, Math.max(0, time));
}
export function setMusicVolume(value) { audio.volume = Math.min(1, Math.max(0, Number(value))); }
export function toggleShuffle() { shuffle = !shuffle; return shuffle; }
export function toggleRepeat() { repeat = !repeat; audio.loop = repeat; return repeat; }
export async function nextTrack(backwards = false) {
  if (!tracks.length) return false;
  if (shuffle && tracks.length > 1) {
    let next = currentIndex;
    while (next === currentIndex) next = Math.floor(Math.random() * tracks.length);
    currentIndex = next;
  } else currentIndex = (currentIndex + (backwards ? tracks.length - 1 : 1)) % tracks.length;
  selectTrack(currentIndex);
  await prepareAudioAnalysis();
  await audio.play();
  return true;
}

export function bindMusicUpdates(onUpdate) {
  const update = () => onUpdate(getMusicState());
  ["play", "pause", "ended", "loadedmetadata", "timeupdate", "volumechange"].forEach((event) => audio.addEventListener(event, update));
  const onEnded = () => {
    if (!repeat) nextTrack().catch((error) => window.dispatchEvent(new CustomEvent("jarvis-music-error", { detail: { message: error.message } })));
  };
  audio.addEventListener("ended", onEnded);
  progressTimer = window.setInterval(update, 500);
  return () => {
    ["play", "pause", "ended", "loadedmetadata", "timeupdate", "volumechange"].forEach((event) => audio.removeEventListener(event, update));
    audio.removeEventListener("ended", onEnded);
    if (progressTimer) window.clearInterval(progressTimer);
    progressTimer = null;
  };
}

export function releaseMusic() {
  audio.pause();
  tracks.forEach((track) => { if (track.local) URL.revokeObjectURL(track.url); });
  tracks = [];
  currentIndex = -1;
  audio.removeAttribute("src");
}
