"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Phone, PhoneOff } from "lucide-react";

type CallStatus = "idle" | "connecting" | "connected" | "processing" | "ai-speaking" | "ended";
type TranscriptEntry = { role: "user" | "assistant"; text: string; id: number };

const SPEECH_THRESHOLD = 10;   // low threshold captures consonant onsets ("n" in "no") before the vowel
const BARGE_IN_THRESHOLD = 35;
const BARGE_IN_FRAMES = 3;
const SILENCE_MS = 800;
const MAX_MS = 8000;

export default function CallInterface({
  clientId = "sunshine_dental",
  businessName = "AI Receptionist",
}: {
  clientId?: string;
  businessName?: string;
}) {
  const WS_URL = `${process.env.NEXT_PUBLIC_WS_URL}/ws/${clientId}`;

  const [status, setStatus] = useState<CallStatus>("idle");
  const [statusText, setStatusText] = useState("Click to start a call");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [callDuration, setCallDuration] = useState(0);

  // Core refs
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // State refs (avoid stale closures)
  const isCallActiveRef = useRef(false);
  const isAISpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const pendingEndCallRef = useRef(false);
  const isRecordingRef = useRef(false);
  const userEndedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const transcriptIdRef = useRef(0);

  // Audio queue for sentence-by-sentence playback
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // VAD
  const bargeFramesRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Waveform draw loop
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const freqData = freqDataRef.current;
    if (!canvas || !analyser || !freqData) {
      animFrameRef.current = requestAnimationFrame(drawWaveform);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== W * devicePixelRatio) {
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    ctx.clearRect(0, 0, W, H);
    analyser.getByteFrequencyData(freqData);

    const barCount = 48;
    const barW = (W / barCount) * 0.55;
    const gap = (W / barCount) * 0.45;
    const centerY = H / 2;

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * freqData.length * 0.6);
      const v = freqData[idx] / 255;
      const h = Math.max(3, v * H * 0.85);
      const x = i * (barW + gap);

      if (isAISpeakingRef.current) {
        ctx.fillStyle = `rgba(124, 111, 247, ${0.4 + v * 0.6})`;
      } else if (isRecordingRef.current) {
        ctx.fillStyle = `rgba(52, 211, 153, ${0.4 + v * 0.6})`;
      } else if (isCallActiveRef.current) {
        ctx.fillStyle = "rgba(80, 80, 106, 0.5)";
      } else {
        ctx.fillStyle = "rgba(40, 40, 56, 0.8)";
      }

      ctx.fillRect(x, centerY - h / 2, barW, h);
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const addTranscript = useCallback((role: "user" | "assistant", text: string) => {
    const id = ++transcriptIdRef.current;
    setTranscript((prev) => {
      // If last entry is same role, replace it (handles sentence streaming)
      if (prev.length > 0 && prev[prev.length - 1].role === role && role === "assistant") {
        return [...prev.slice(0, -1), { role, text, id: prev[prev.length - 1].id }];
      }
      return [...prev, { role, text, id }];
    });
  }, []);

  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (!pendingEndCallRef.current) {
        isAISpeakingRef.current = false;
        setStatus("connected");
        setStatusText("Listening...");
      }
      return;
    }

    isPlayingRef.current = true;
    isAISpeakingRef.current = true;

    const data = audioQueueRef.current.shift()!;
    const blob = new Blob([data], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      if (pendingEndCallRef.current && audioQueueRef.current.length === 0) {
        pendingEndCallRef.current = false;
        endCall();
        return;
      }
      playNextInQueue();
    };

    audio.play().catch(() => {
      isPlayingRef.current = false;
      playNextInQueue();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetUI = useCallback(() => {
    isCallActiveRef.current = false;
    isAISpeakingRef.current = false;
    isProcessingRef.current = false;
    pendingEndCallRef.current = false;
    isRecordingRef.current = false;
    isPlayingRef.current = false;
    audioQueueRef.current = [];
    mediaRecorderRef.current = null;
    wsRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    cancelAnimationFrame(animFrameRef.current);
    setStatus("idle");
    setStatusText("Click to start a call");
    setCallDuration(0);
  }, []);

  const endCall = useCallback(() => {
    userEndedRef.current = true;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isAISpeakingRef.current = false;
    isPlayingRef.current = false;
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    freqDataRef.current = null;
    resetUI();
  }, [resetUI]);

  const stopAI = useCallback((gracePeriodMs = 500) => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    bargeFramesRef.current = 0;
    const audio = currentAudioRef.current;
    currentAudioRef.current = null;
    if (audio) {
      if (audio.readyState >= 2) audio.pause();
      else audio.addEventListener("canplay", () => audio.pause(), { once: true });
    }
    setTimeout(() => {
      isAISpeakingRef.current = false;
      setStatus("connected");
      setStatusText("Listening...");
    }, gracePeriodMs);
  }, []);

  const startMic = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const freqData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    analyserRef.current = analyser;
    freqDataRef.current = freqData;
    drawWaveform();

    const getVolume = () => {
      analyser.getByteFrequencyData(freqData);
      return freqData.reduce((a, b) => a + b, 0) / freqData.length;
    };

    const stopRecording = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      silenceTimerRef.current = null;
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };

    const startRecording = () => {
      if (isRecordingRef.current || !isCallActiveRef.current || isAISpeakingRef.current) return;
      isRecordingRef.current = true;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        isRecordingRef.current = false;
        if (!isCallActiveRef.current || isAISpeakingRef.current || isProcessingRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 1024 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(blob);
        }
      };

      recorder.start();
      maxTimerRef.current = setTimeout(stopRecording, MAX_MS);
      setStatus("connected");
      setStatusText("Listening...");
    };

    const vadInterval = setInterval(() => {
      if (!isCallActiveRef.current || isProcessingRef.current) return;
      const volume = getVolume();

      if (isAISpeakingRef.current) {
        if (volume > BARGE_IN_THRESHOLD) {
          bargeFramesRef.current++;
          if (bargeFramesRef.current >= BARGE_IN_FRAMES) stopAI(300);
        } else {
          bargeFramesRef.current = 0;
        }
        return;
      }

      bargeFramesRef.current = 0;
      if (volume > SPEECH_THRESHOLD) {
        if (!isRecordingRef.current) startRecording();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(stopRecording, SILENCE_MS);
      }
    }, 100);

    const checkActive = setInterval(() => {
      if (!isCallActiveRef.current) {
        clearInterval(vadInterval);
        clearInterval(checkActive);
        audioCtx.close();
      }
    }, 500);
  }, [drawWaveform, stopAI]);

  const startCall = useCallback(async () => {
    userEndedRef.current = false;
    setStatus("connecting");
    setStatusText("Connecting...");
    setTranscript([]);
    setCallDuration(0);

    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = async () => {
      isCallActiveRef.current = true;
      reconnectAttemptsRef.current = 0;
      setStatus("connected");
      setStatusText("Connected...");

      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startMic(stream);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const msg = JSON.parse(event.data);

        if (msg.type === "transcript") {
          addTranscript(msg.role, msg.text);
          return;
        }
        if (msg.action === "end_call") {
          userEndedRef.current = true;
          if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
            // No audio in flight — end immediately
            endCall();
          } else {
            // Audio is playing — wait for it to finish, then end
            pendingEndCallRef.current = true;
          }
          return;
        }
        if (msg.status === "processing") {
          isProcessingRef.current = true;
          setStatus("processing");
          setStatusText("Processing...");
          return;
        }
        if (msg.status === "ready") {
          isProcessingRef.current = false;
          return;
        }
        return;
      }

      // Binary = audio chunk — push to queue and play
      isProcessingRef.current = false;
      setStatus("ai-speaking");
      setStatusText("AI speaking...");
      audioQueueRef.current.push(event.data as ArrayBuffer);
      if (!isPlayingRef.current) playNextInQueue();
    };

    ws.onerror = () => {
      setStatusText("Connection error — is the backend running?");
      setStatus("idle");
    };

    ws.onclose = () => {
      if (!isCallActiveRef.current) return;
      if (userEndedRef.current) {
        // Server closed after end_call — if no audio is queued/playing, reset UI now.
        // If audio is still playing, pendingEndCallRef will call endCall() when it finishes.
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          resetUI();
        }
      } else {
        // Unexpected disconnect — surface it so the user knows to retry.
        setStatusText("Call disconnected — please try again");
        resetUI();
      }
    };
  }, [WS_URL, startMic, addTranscript, playNextInQueue, resetUI]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleButtonClick = () => {
    if (status === "idle" || status === "ended") startCall();
    else endCall();
  };

  const isActive = status !== "idle" && status !== "ended";
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const statusColors: Record<CallStatus, string> = {
    idle: "var(--color-text-muted)",
    connecting: "var(--color-warning)",
    connected: "var(--color-success)",
    processing: "var(--color-warning)",
    "ai-speaking": "var(--color-brand)",
    ended: "var(--color-text-muted)",
  };

  return (
    <div className="card" style={{ width: "100%", maxWidth: "420px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "var(--space-4) var(--space-5)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-bg-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-full)", background: "var(--color-brand-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Phone size={16} color="var(--color-brand)" />
          </div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>
              {businessName}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              Powered by Voxzenn
            </div>
          </div>
        </div>
        {isActive && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-success)", boxShadow: "0 0 6px var(--color-success)" }} />
            {formatDuration(callDuration)}
          </div>
        )}
      </div>

      {/* Waveform */}
      <div style={{ padding: "var(--space-4) var(--space-5)", borderBottom: "1px solid var(--color-border)" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "56px", display: "block" }}
        />
      </div>

      {/* Transcript */}
      <div style={{
        height: "220px",
        overflowY: "auto",
        padding: "var(--space-4) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}>
        {transcript.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            {isActive ? "Conversation will appear here..." : "Start a call to begin"}
          </div>
        ) : (
          transcript.map((entry) => (
            <div key={entry.id} style={{ display: "flex", justifyContent: entry.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "82%",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: entry.role === "user"
                  ? "var(--radius-lg) 4px var(--radius-lg) var(--radius-lg)"
                  : "4px var(--radius-lg) var(--radius-lg) var(--radius-lg)",
                background: entry.role === "user" ? "var(--color-brand)" : "var(--color-bg-subtle)",
                border: entry.role === "user" ? "none" : "1px solid var(--color-border)",
                color: entry.role === "user" ? "#fff" : "var(--color-text-primary)",
                fontSize: "var(--text-sm)",
                lineHeight: 1.5,
                animation: "fadeSlideIn 0.2s ease",
              }}>
                {entry.text}
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Footer */}
      <div style={{
        padding: "var(--space-4) var(--space-5)",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-bg-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusColors[status] }} />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            {statusText}
          </span>
        </div>

        <button
          onClick={handleButtonClick}
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "var(--radius-full)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? "var(--color-danger)"
              : "linear-gradient(135deg, #7c6ff7, #6358e0)",
            boxShadow: isActive
              ? "0 0 16px rgba(248,113,113,0.4)"
              : "0 0 20px rgba(124,111,247,0.4)",
            transition: "all var(--transition-fast)",
          }}
        >
          {isActive
            ? <PhoneOff size={18} color="#fff" />
            : <Phone size={18} color="#fff" />
          }
        </button>
      </div>
    </div>
  );
}
