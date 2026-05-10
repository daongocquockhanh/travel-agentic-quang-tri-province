// components.jsx — Quang Tri Travel · core UI components
// Loaded after React + Babel. All visual primitives live here.

// (no hooks needed in this file; screens.jsx + index.html handle state)

// ── Icon helper ──────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const paths = {
    mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>,
    send: <><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7Z"/></>,
    pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    arrow: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    back: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.42.86.74"/></>,
    play: <polygon points="6 4 20 12 6 20 6 4"/>,
    book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

// ── Track icons (custom) ─────────────────────────────────────
const TrackIcon = ({ track, size = 24 }) => {
  if (track === "war") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="13" x2="21" y2="13"/><line x1="12" y1="5" x2="12" y2="21"/>
    </svg>
  );
  if (track === "foreign") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 L12 5 L21 12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
};

const TRACK_COLOR = { war: "#B07A2A", foreign: "#0F4C5C", domestic: "#3F6B3A" };
const TRACK_LABEL_VI = { war: "Lịch sử chiến tranh", foreign: "Khách quốc tế", domestic: "Khách trong nước" };
const TRACK_LABEL_EN = { war: "War history", foreign: "Foreign tourist", domestic: "Domestic traveller" };

// ── Track chip ───────────────────────────────────────────────
const TrackChip = ({ track, lang = "en", solid = false, onClick, glass = false }) => {
  const color = TRACK_COLOR[track];
  const label = lang === "vi" ? TRACK_LABEL_VI[track] : TRACK_LABEL_EN[track];
  const bg = glass ? "rgba(247,244,238,0.86)" : (solid ? color : `color-mix(in oklch, ${color} 8%, #F7F4EE)`);
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 999,
      border: `2px solid ${color}`,
      background: bg,
      color: solid ? "#F7F4EE" : "#1F2428",
      fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
      cursor: "pointer", backdropFilter: glass ? "blur(12px)" : "none",
      WebkitBackdropFilter: glass ? "blur(12px)" : "none",
    }}>
      <span style={{ color, display: "inline-flex" }}><TrackIcon track={track} size={14}/></span>
      {label}
    </button>
  );
};

// ── Button ───────────────────────────────────────────────────
const Btn = ({ kind = "primary", size = "md", children, onClick, style = {}, disabled }) => {
  const styles = {
    primary:   { background: "var(--teal-700)", color: "#fff", borderRadius: 999, border: "1px solid transparent" },
    secondary: { background: "var(--paper-card)", color: "var(--ink)", borderRadius: 10, border: "1px solid var(--ink-12)" },
    ghost:     { background: "transparent", color: "var(--teal-700)", borderRadius: 999, border: "1px solid transparent" },
    accent:    { background: "var(--yellow-500)", color: "var(--ink)", borderRadius: 999, border: "1px solid transparent" },
  }[kind];
  const sz = size === "sm" ? { padding: "8px 14px", fontSize: 13 } : { padding: "12px 20px", fontSize: 15 };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles, ...sz, fontFamily: "var(--font-body)", fontWeight: 500, cursor: "pointer",
      transition: "background 180ms cubic-bezier(.32,.72,0,1), transform 180ms cubic-bezier(.32,.72,0,1)",
      opacity: disabled ? 0.4 : 1, ...style,
    }}>{children}</button>
  );
};

// ── Bilingual title ──────────────────────────────────────────
const Bilingual = ({ vi, en, size = 20 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: size, lineHeight: 1.15, letterSpacing: "-0.005em", color: "var(--ink)" }}>{vi}</div>
    <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: size * 0.65, color: "var(--ink-60)", lineHeight: 1.2 }}>{en}</div>
  </div>
);

// ── Voice button ─────────────────────────────────────────────
const VoiceButton = ({ state = "idle", onClick }) => {
  const styles = {
    idle: { bg: "var(--teal-700)", color: "#F7F4EE", anim: "qt-breathe 1.6s cubic-bezier(.32,.72,0,1) infinite" },
    recording: { bg: "var(--yellow-500)", color: "var(--ink)" },
    transcribing: { bg: "var(--paper-card)", color: "var(--teal-700)", border: "1px solid var(--ink-12)" },
    speaking: { bg: "var(--teal-500)", color: "#F7F4EE" },
    error: { bg: "var(--paper-card)", color: "var(--danger)", border: "1px solid var(--danger)" },
  }[state];
  return (
    <button onClick={onClick} style={{
      width: 64, height: 64, borderRadius: 999, border: styles.border || "none",
      background: styles.bg, color: styles.color, display: "grid", placeItems: "center",
      boxShadow: "var(--shadow-lift)", cursor: "pointer", animation: styles.anim,
    }}>
      {state === "idle" && <Icon name="mic" size={26}/>}
      {state === "recording" && <div style={{ width: 18, height: 18, background: "currentColor", borderRadius: 2 }}/>}
      {state === "speaking" && (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="6" y1="9" x2="6" y2="15"/><line x1="10" y1="6" x2="10" y2="18"/>
          <line x1="14" y1="9" x2="14" y2="15"/><line x1="18" y1="11" x2="18" y2="13"/>
        </svg>
      )}
      {state === "transcribing" && <div style={{ width: 22, height: 22, border: "2.5px solid currentColor", borderRightColor: "transparent", borderRadius: 999, animation: "qt-spin 0.8s linear infinite" }}/>}
      {state === "error" && <Icon name="x" size={26}/>}
    </button>
  );
};

// ── Site card ────────────────────────────────────────────────
const SiteCard = ({ site, onClick }) => (
  <button onClick={onClick} style={{
    display: "flex", gap: 12, padding: 12, background: "var(--paper-card)",
    border: "1px solid var(--ink-12)", borderRadius: 10,
    width: "100%", textAlign: "left", cursor: "pointer",
    transition: "background 180ms cubic-bezier(.32,.72,0,1)",
  }}>
    <div style={{ width: 72, height: 72, borderRadius: 6, flexShrink: 0,
      background: site.gradient || "linear-gradient(135deg, #6FA0AE, #0F4C5C)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(31,36,40,.4), transparent 60%)" }}/>
    </div>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <Bilingual vi={site.vi} en={site.en} size={17}/>
      <div style={{ display: "flex", gap: 12, marginTop: 4, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-60)" }}>
        <span>{site.km} km</span>
        <span>{site.hours}</span>
      </div>
    </div>
    <div style={{ alignSelf: "center", color: TRACK_COLOR[site.track] }}>
      <Icon name="arrow" size={18}/>
    </div>
  </button>
);

// ── Citation chip ────────────────────────────────────────────
const Citation = ({ source, track = "war" }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 10px", borderRadius: 999, background: "var(--paper-sunk)",
    border: "1px solid var(--ink-12)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-80)",
  }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: TRACK_COLOR[track] }}/>
    {source}<span style={{ color: "var(--ink-60)" }}>↗</span>
  </span>
);

// ── Chat bubble ──────────────────────────────────────────────
const Bubble = ({ role, children }) => {
  const base = {
    padding: "10px 14px", borderRadius: 16, maxWidth: "82%",
    fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.45,
  };
  if (role === "user") return <div style={{ ...base, background: "var(--teal-700)", color: "#F7F4EE", alignSelf: "flex-end", borderBottomRightRadius: 4 }}>{children}</div>;
  if (role === "tool") return <div style={{ background: "var(--paper-sunk)", color: "var(--ink-60)", alignSelf: "flex-start", fontFamily: "var(--font-mono)", fontSize: 11, padding: "5px 10px", borderRadius: 6 }}>{children}</div>;
  return <div style={{ ...base, background: "var(--paper-card)", color: "var(--ink)", border: "1px solid var(--ink-12)", alignSelf: "flex-start", borderBottomLeftRadius: 4 }}>{children}</div>;
};

// ── Quick reply pill ─────────────────────────────────────────
const Pill = ({ children, onClick }) => (
  <button onClick={onClick} style={{
    padding: "7px 13px", borderRadius: 999, border: "1px solid var(--ink-12)",
    background: "var(--paper)", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink)",
    cursor: "pointer", whiteSpace: "nowrap",
  }}>{children}</button>
);

// ── Geofence banner ──────────────────────────────────────────
const GeofenceBanner = ({ vi, en, track = "war", onPlay, onRead, onDismiss }) => (
  <div style={{
    background: "rgba(247, 244, 238, 0.9)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(31,36,40,.08)", borderLeft: `3px solid ${TRACK_COLOR[track]}`,
    borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
    boxShadow: "var(--shadow-lift)",
  }}>
    <div style={{ width: 36, height: 36, borderRadius: 999, background: TRACK_COLOR[track], color: "#F7F4EE",
      display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon name="pin" size={18}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-60)", letterSpacing: "0.05em", textTransform: "uppercase" }}>You are here</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)", lineHeight: 1.2, marginTop: 1 }}>{vi} · <span style={{ fontStyle: "italic", color: "var(--ink-60)" }}>{en}</span></div>
    </div>
    <button onClick={onPlay} style={{ background: TRACK_COLOR[track], color: "#F7F4EE", border: "none", borderRadius: 999, padding: "7px 12px", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Play</button>
  </div>
);

// ── Animations keyframes ─────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("qt-anim")) {
  const s = document.createElement("style");
  s.id = "qt-anim";
  s.textContent = `
    @keyframes qt-breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.72; } }
    @keyframes qt-spin { to { transform: rotate(360deg); } }
    @keyframes qt-slide-up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes qt-fade-in { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  Icon, TrackIcon, TrackChip, Btn, Bilingual, VoiceButton, SiteCard, Citation, Bubble, Pill, GeofenceBanner,
  TRACK_COLOR, TRACK_LABEL_VI, TRACK_LABEL_EN,
});
