"use client";

import { useEffect, useState } from "react";

type Message = {
  role: "caller" | "ai" | "system";
  text: string;
};

const CONVERSATION: Message[] = [
  { role: "caller", text: "Hi, I need to book an appointment" },
  { role: "ai", text: "Of course! What day works best for you?" },
  { role: "caller", text: "Thursday morning if possible" },
  { role: "ai", text: "Thursday at 10am works great. Can I get your name?" },
  { role: "caller", text: "Sarah Johnson" },
  { role: "ai", text: "Perfect — booked for Sarah, Thursday 10am. See you then!" },
  { role: "system", text: "Appointment saved to dashboard" },
];

const STEP_DELAY = 900;
const TYPING_DURATION = 1000;

export default function DemoTranscript() {
  const [visible, setVisible] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [typingRole, setTypingRole] = useState<"caller" | "ai">("ai");

  useEffect(() => {
    let cancelled = false;
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      setVisible([]);
      setTyping(false);

      let offset = 600;

      CONVERSATION.forEach((msg, i) => {
        if (msg.role !== "system") {
          const t1 = setTimeout(() => {
            if (cancelled) return;
            setTypingRole(msg.role as "caller" | "ai");
            setTyping(true);
          }, offset);
          timeouts.push(t1);
          offset += TYPING_DURATION;
        }

        const t2 = setTimeout(() => {
          if (cancelled) return;
          setTyping(false);
          setVisible((prev) => [...prev, msg]);

          // restart loop after last message
          if (i === CONVERSATION.length - 1) {
            const restart = setTimeout(() => {
              if (!cancelled) run();
            }, 3500);
            timeouts.push(restart);
          }
        }, offset);
        timeouts.push(t2);

        offset += STEP_DELAY;
      });
    };

    run();
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div style={{
      background: "var(--color-bg-card)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-xl)",
      overflow: "hidden",
      boxShadow: "0 0 60px rgba(124, 111, 247, 0.12), var(--shadow-xl)",
    }}>
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
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
          }}>🦷</div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-text-primary)" }}>
              Sunshine Dental
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
              AI Receptionist · Voxzenn
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{
            width: "8px",
            height: "8px",
            borderRadius: "var(--radius-full)",
            background: "var(--color-success)",
            boxShadow: "0 0 6px var(--color-success)",
          }} />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>Live</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        padding: "var(--space-5)",
        minHeight: "300px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}>
        {visible.map((msg, i) => {
          if (msg.role === "system") {
            return (
              <div key={i} style={{
                textAlign: "center",
                padding: "var(--space-2) var(--space-4)",
                background: "rgba(52, 211, 153, 0.08)",
                border: "1px solid rgba(52, 211, 153, 0.2)",
                borderRadius: "var(--radius-full)",
                fontSize: "var(--text-xs)",
                color: "var(--color-success)",
                alignSelf: "center",
              }}>
                ✓ {msg.text}
              </div>
            );
          }

          const isAI = msg.role === "ai";
          return (
            <div key={i} style={{
              display: "flex",
              justifyContent: isAI ? "flex-start" : "flex-end",
              animation: "fadeSlideIn 0.2s ease",
            }}>
              <div style={{
                maxWidth: "78%",
                padding: "var(--space-2) var(--space-4)",
                borderRadius: isAI
                  ? "4px var(--radius-lg) var(--radius-lg) var(--radius-lg)"
                  : "var(--radius-lg) 4px var(--radius-lg) var(--radius-lg)",
                background: isAI ? "var(--color-bg-subtle)" : "var(--color-brand)",
                color: isAI ? "var(--color-text-primary)" : "#ffffff",
                fontSize: "var(--text-sm)",
                lineHeight: 1.5,
                border: isAI ? "1px solid var(--color-border)" : "none",
                boxShadow: isAI ? "none" : "0 0 12px rgba(124, 111, 247, 0.3)",
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}

        {typing && (
          <div style={{
            display: "flex",
            justifyContent: typingRole === "ai" ? "flex-start" : "flex-end",
          }}>
            <div style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-lg)",
              background: typingRole === "ai" ? "var(--color-bg-subtle)" : "var(--color-brand)",
              border: typingRole === "ai" ? "1px solid var(--color-border)" : "none",
              display: "flex",
              gap: "4px",
              alignItems: "center",
              height: "34px",
            }}>
              {[0, 1, 2].map((dot) => (
                <div key={dot} style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: typingRole === "ai" ? "var(--color-text-muted)" : "rgba(255,255,255,0.7)",
                  animation: `typingDot 1.2s ${dot * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
