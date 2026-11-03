import { getSettings } from "./settings.js";

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let resultHandler = null;
let stateHandler = null;
let listening = false;
let voices = [];

export function voiceSupported() { return Boolean(Recognition); }
export function getAvailableVoices() {
  if ("speechSynthesis" in window) voices = window.speechSynthesis.getVoices();
  return [...voices];
}

export function startListening(onResult, onState = () => {}) {
  if (!Recognition) throw new Error("Voice recognition is not supported in this browser. You can still type commands.");
  if (listening) { stopListening(); return; }
  resultHandler = onResult;
  stateHandler = onState;
  recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => { listening = true; stateHandler?.("listening"); };
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();
    if (transcript) resultHandler?.(transcript);
  };
  recognition.onerror = (event) => {
    const message = event.error === "not-allowed" || event.error === "service-not-allowed"
      ? "Microphone permission was denied. Allow microphone access in your browser settings."
      : event.error === "no-speech" ? "I didn't hear anything. Try again when you're ready."
      : `Voice recognition error: ${event.error}.`;
    stateHandler?.("error", message);
  };
  recognition.onend = () => { listening = false; stateHandler?.("idle"); recognition = null; };
  try { recognition.start(); }
  catch (error) { recognition = null; listening = false; throw new Error(`Could not start voice recognition: ${error.message}`); }
}

export function stopListening() {
  if (recognition && listening) recognition.stop();
  listening = false;
}

export function speak(text, onState = () => {}) {
  const settings = getSettings();
  if (!settings.voiceOutput || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const preferred = getAvailableVoices().find((voice) => voice.voiceURI === settings.voiceURI);
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1;
  utterance.onstart = () => { stateHandler?.("speaking"); onState("speaking"); };
  utterance.onend = () => { stateHandler?.("idle"); onState("idle"); };
  utterance.onerror = () => { stateHandler?.("idle"); onState("idle"); };
  window.speechSynthesis.speak(utterance);
  return true;
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener?.("voiceschanged", () => { voices = window.speechSynthesis.getVoices(); });
}
