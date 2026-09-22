import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around the browser's Web Speech API (webkitSpeechRecognition).
 *
 * Fixes over earlier versions:
 *  - `continuous: true` — the previous `continuous: false` made Chrome
 *    auto-stop listening on the very first pause it detected, which is
 *    often BEFORE the user finishes their first word (browsers frequently
 *    fire a `no-speech` timeout within ~1-2s of silence at the start,
 *    e.g. the brief gap between clicking the mic and actually speaking).
 *    That looked exactly like "I click, I talk, nothing happens" even
 *    though recognition technically ran — it just gave up too early and
 *    the error was being silently swallowed. With `continuous: true` the
 *    mic stays open across pauses until the user clicks it off (or a long
 *    real silence/network hiccup ends it), which matches a push-to-talk
 *    dictation button people actually expect.
 *  - `activeRef` guards against calling `.start()` while a recognition
 *    session is already active, which throws
 *    `InvalidStateError: recognition has already started` in Chrome and
 *    silently breaks the mic button on a fast double click.
 *  - Real, actionable errors are surfaced via `error` (mic permission
 *    denied, no mic device, no network reachable to Google's speech
 *    service — desktop Chrome's recognizer is NOT on-device and needs
 *    internet access). `no-speech` is now surfaced too (as a gentle
 *    "didn't catch that" rather than a hard error) instead of being
 *    swallowed with zero feedback, since silently doing nothing is
 *    indistinguishable from "broken" from the user's side.
 *  - Gracefully reports `supported: false` on browsers without the API
 *    (e.g. Firefox) instead of throwing, so the mic button can hide itself.
 */
export function useSpeechRecognition({ onResult } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const manualStopRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => console.log("[voice] recognition started");
    recognition.onaudiostart = () => console.log("[voice] audio capture started (mic is live)");
    recognition.onspeechstart = () => console.log("[voice] speech detected");
    recognition.onspeechend = () => console.log("[voice] speech ended");
    recognition.onaudioend = () => console.log("[voice] audio capture ended");

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        console.log(
          `[voice] result[${i}] isFinal=${result.isFinal} confidence=${alt.confidence?.toFixed?.(2) ?? "n/a"} text="${alt.transcript}"`
        );
        if (result.isFinal) finalText += alt.transcript;
        else interim += alt.transcript;
      }
      if (finalText.trim()) {
        console.log(`[voice] FINAL transcript -> appending to input: "${finalText.trim()}"`);
        onResultRef.current?.(finalText.trim());
        setInterimTranscript("");
      } else {
        console.log(`[voice] interim (not yet final): "${interim}"`);
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      activeRef.current = false;
      setIsListening(false);
      setInterimTranscript("");
      console.log(
        `[voice] recognition ended (manualStop=${manualStopRef.current})`
      );
      if (meterCleanupRef.current) {
        meterCleanupRef.current();
        meterCleanupRef.current = null;
      }
      // Chrome ends the session on a long real silence even in continuous
      // mode. Only surface that as a (soft) message if the user didn't
      // click stop themselves.
      if (!manualStopRef.current) {
        setError((prev) => prev ?? "no-speech");
      }
      manualStopRef.current = false;
    };

    recognition.onerror = (event) => {
      activeRef.current = false;
      setIsListening(false);
      setInterimTranscript("");
      console.log(
        `[voice] recognition error: code="${event.error}" message="${event.message || "(none)"}"`
      );
      // "aborted" fires on our own .stop() call — expected, not an error.
      if (event.error !== "aborted") {
        setError(event.error);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // ignore — recognizer may not have been started
      }
      recognitionRef.current = null;
      activeRef.current = false;
    };
  }, []);

  // Independent of Chrome's speech engine: measures raw mic input volume so
  // we can tell, from the console, whether audio is reaching the browser at
  // all (hardware/OS mic selection issue) vs. reaching it but Chrome's
  // speech service just not transcribing it (network/service issue).
  const meterCleanupRef = useRef(null);
  const startVolumeMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let peak = 0;
      const intervalId = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        peak = Math.max(peak, rms);
        const bar = "#".repeat(Math.round(rms * 60));
        console.log(`[voice][mic-level] rms=${rms.toFixed(3)} peak=${peak.toFixed(3)} ${bar}`);
      }, 400);
      meterCleanupRef.current = () => {
        clearInterval(intervalId);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        console.log(`[voice][mic-level] stopped — peak level this session was ${peak.toFixed(3)} (>0.02 means real audio was captured; near 0 means the browser never received sound from your mic)`);
      };
    } catch (e) {
      console.log(`[voice][mic-level] could not open mic for level metering: ${e.message}`);
    }
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || activeRef.current) return;
    setError(null);
    setInterimTranscript("");
    manualStopRef.current = false;
    activeRef.current = true;
    setIsListening(true);
    startVolumeMeter();
    try {
      recognitionRef.current.start();
    } catch {
      // Most commonly InvalidStateError from a stray double-invoke — reset
      // state rather than leaving the button stuck in "listening".
      activeRef.current = false;
      setIsListening(false);
    }
  }, [startVolumeMeter]);

  const stop = useCallback(() => {
    if (!recognitionRef.current || !activeRef.current) return;
    manualStopRef.current = true;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    if (meterCleanupRef.current) {
      meterCleanupRef.current();
      meterCleanupRef.current = null;
    }
  }, []);

  return { supported, isListening, interimTranscript, error, start, stop };
}
