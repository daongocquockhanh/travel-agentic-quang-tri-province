// screens.jsx — Quang Tri Travel · screens
const { useState: useS, useEffect: useE, useRef: useR } = React;

// ── Sample data ──────────────────────────────────────────────
const SITES = [
  { slug: "vinh-moc",    vi: "Địa đạo Vĩnh Mốc",    en: "Vinh Moc Tunnels",      km: 27, hours: "7:00–16:30", track: "war",      gradient: "linear-gradient(135deg,#5C6B5A,#1F2428)" },
  { slug: "hien-luong",  vi: "Cầu Hiền Lương",       en: "Hien Luong Bridge",     km: 22, hours: "Open 24h",   track: "war",      gradient: "linear-gradient(135deg,#F2A73A,#0F4C5C)" },
  { slug: "khe-sanh",    vi: "Khe Sanh",             en: "Khe Sanh Combat Base",  km: 64, hours: "7:00–17:00", track: "war",      gradient: "linear-gradient(135deg,#8B6F47,#3A2E20)" },
  { slug: "la-vang",     vi: "Vương cung La Vang",   en: "La Vang Basilica",      km: 58, hours: "5:00–20:00", track: "foreign",  gradient: "linear-gradient(135deg,#E5D5B7,#B89A6E)" },
  { slug: "cua-tung",    vi: "Bãi tắm Cửa Tùng",    en: "Cua Tung Beach",        km: 35, hours: "5:00–19:00", track: "domestic", gradient: "linear-gradient(135deg,#6FA0AE,#0A3641)" },
  { slug: "thach-han",   vi: "Sông Thạch Hãn",       en: "Thach Han River",       km: 6,  hours: "Open 24h",   track: "foreign",  gradient: "linear-gradient(135deg,#3F6B3A,#0F4C5C)" },
];

// ── Track Picker (onboarding) ────────────────────────────────
const TrackPicker = ({ onPick }) => {
  return (
    <div style={{ background: "var(--paper)", height: "100%", padding: "60px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-60)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Quảng Trị · Vietnam</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.1, color: "var(--ink)", marginTop: 6, letterSpacing: "-0.01em" }}>Pick where you want to start.</div>
        <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 16, color: "var(--ink-60)", marginTop: 4 }}>Chọn cách bạn muốn khám phá</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {["war","foreign","domestic"].map(t => (
          <button key={t} onClick={() => onPick(t)} style={{
            display: "flex", alignItems: "stretch", padding: 0, background: "var(--paper-card)",
            border: "1px solid var(--ink-12)", borderRadius: 14, overflow: "hidden", cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ width: 6, background: TRACK_COLOR[t] }}/>
            <div style={{ padding: 16, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: TRACK_COLOR[t] }}>
                <TrackIcon track={t} size={18}/>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>{TRACK_LABEL_EN[t]}</div>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink)", marginTop: 4, lineHeight: 1.2 }}>
                {t === "war" && "Walk the DMZ. Solemn, with sources."}
                {t === "foreign" && "One day, three places worth slowing down for."}
                {t === "domestic" && "Logistics, giờ mở cửa, bãi tắm vắng."}
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-60)", marginTop: 6 }}>
                {t === "war" && "Vĩnh Mốc · Hiền Lương · Khe Sanh · Trường Sơn"}
                {t === "foreign" && "Bilingual VI/EN · curated overview"}
                {t === "domestic" && "Tiếng Việt · gia đình · đường ven biển"}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-40)", textAlign: "center", marginTop: 14 }}>You can switch tracks anytime.</div>
    </div>
  );
};

// ── Map background ───────────────────────────────────────────
const MapBg = () => (
  <div style={{ position: "absolute", inset: 0, background:
    "radial-gradient(ellipse at 30% 40%, #5C7F8A 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, #9A7E5B 0%, transparent 55%), linear-gradient(160deg, #4A6B6F 0%, #2F4549 100%)" }}>
    {/* contour lines */}
    <svg viewBox="0 0 400 800" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }}>
      {[0,1,2,3,4,5,6].map(i => (
        <path key={i} d={`M0,${100 + i*100} Q120,${80 + i*100} 240,${110 + i*100} T400,${90 + i*100}`} stroke="#F7F4EE" strokeWidth="0.7" fill="none"/>
      ))}
    </svg>
    {/* river */}
    <svg viewBox="0 0 400 800" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}>
      <path d="M-20,420 Q80,400 180,440 T400,460" stroke="#0A3641" strokeWidth="14" fill="none" strokeLinecap="round"/>
    </svg>
  </div>
);

const MapPin = ({ x, y, color = "#0F4C5C", size = 14, label, active }) => (
  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)", zIndex: active ? 5 : 2 }}>
    <div style={{ width: size, height: size, borderRadius: 999, background: color,
      boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(31,36,40,.3)",
      transform: active ? "scale(1.4)" : "scale(1)", transition: "transform 240ms cubic-bezier(.32,.72,0,1)",
    }}/>
    {label && active && (
      <div style={{ position: "absolute", left: "50%", top: -28, transform: "translateX(-50%)",
        whiteSpace: "nowrap", background: "rgba(247,244,238,0.94)", backdropFilter: "blur(10px)",
        padding: "3px 8px", borderRadius: 6, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink)",
        boxShadow: "var(--shadow-soft)",
      }}>{label}</div>
    )}
  </div>
);

// ── Map Home ─────────────────────────────────────────────────
const MapHome = ({ track, lang, onTrackChange, onLangChange, onSitePick, onChat, sheetState, setSheetState, showBanner, onBannerPlay, onBannerDismiss }) => {
  const heights = { peek: 110, half: 380, full: 720 };
  const sheetH = heights[sheetState];
  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "#2F4549" }}>
      <MapBg/>
      <MapPin x={28} y={52} color={TRACK_COLOR.war}     label="Hiền Lương" active={track==="war"}/>
      <MapPin x={42} y={42} color={TRACK_COLOR.war}     label="Vĩnh Mốc" active={track==="war"}/>
      <MapPin x={62} y={32} color={TRACK_COLOR.foreign} label="La Vang" active={track==="foreign"}/>
      <MapPin x={48} y={64} color={TRACK_COLOR.domestic} label="Cửa Tùng" active={track==="domestic"}/>

      {/* top chrome */}
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", justifyContent: "space-between", zIndex: 10, gap: 8 }}>
        <TrackChip track={track} lang={lang} glass onClick={onTrackChange}/>
        <button onClick={onLangChange} style={{
          background: "rgba(247,244,238,0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(31,36,40,0.08)", borderRadius: 999, padding: "6px 12px",
          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: "var(--ink)",
          display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        }}><Icon name="globe" size={14}/>{lang.toUpperCase()}</button>
      </div>

      {/* geofence banner */}
      {showBanner && (
        <div style={{ position: "absolute", left: 14, right: 14, top: 64, zIndex: 9, animation: "qt-slide-up 240ms cubic-bezier(.32,.72,0,1)" }}>
          <GeofenceBanner vi="Địa đạo Vĩnh Mốc" en="Vinh Moc Tunnels" track={track} onPlay={onBannerPlay} onDismiss={onBannerDismiss}/>
        </div>
      )}

      {/* bottom sheet */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: sheetH,
        background: "var(--paper)", borderTopLeftRadius: 24, borderTopRightRadius: 24,
        boxShadow: "0 -16px 40px -12px rgba(31,36,40,.18)",
        transition: "height 360ms cubic-bezier(.32,.72,0,1)", zIndex: 8,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <button onClick={() => setSheetState(sheetState === "full" ? "half" : sheetState === "half" ? "full" : "half")}
          style={{ background: "transparent", border: "none", padding: "10px 0 6px", cursor: "pointer" }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--ink-20)", margin: "0 auto" }}/>
        </button>

        {/* search input */}
        <div style={{ padding: "4px 16px 12px" }}>
          <div onClick={onChat} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "var(--paper-card)",
            border: "1px solid var(--ink-12)", borderRadius: 12, cursor: "pointer",
          }}>
            <Icon name="mic" size={18} color="var(--ink-60)"/>
            <span style={{ flex: 1, fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-60)" }}>
              Ask about a place, route, or history…
            </span>
            <Icon name="arrowUp" size={16} color="var(--ink-60)"/>
          </div>
        </div>

        {sheetState !== "peek" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-60)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Nearby · 6 places</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SITES.filter(s => track === "war" ? s.track === "war" : true).map(s => (
                <SiteCard key={s.slug} site={s} onClick={() => onSitePick(s)}/>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Site detail ──────────────────────────────────────────────
const SiteDetail = ({ site, onBack, onChat }) => (
  <div style={{ background: "var(--paper)", height: "100%", overflowY: "auto" }}>
    {/* hero */}
    <div style={{ position: "relative", height: 240, background: site.gradient }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(31,36,40,0.55), transparent 50%)" }}/>
      <button onClick={onBack} style={{
        position: "absolute", top: 56, left: 14, zIndex: 5,
        background: "rgba(247,244,238,0.86)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(31,36,40,.08)", borderRadius: 999, width: 36, height: 36,
        display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink)",
      }}><Icon name="back" size={18}/></button>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 18, color: "#F7F4EE" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "rgba(247,244,238,0.16)", backdropFilter: "blur(10px)", border: `1.5px solid ${TRACK_COLOR[site.track]}`, color: "#F7F4EE", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 500 }}>
          <span style={{ color: TRACK_COLOR[site.track], display: "inline-flex" }}><TrackIcon track={site.track} size={12}/></span>
          {TRACK_LABEL_EN[site.track]}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 500, marginTop: 8, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{site.vi}</div>
        <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 17, opacity: 0.85, marginTop: 2 }}>{site.en}</div>
      </div>
    </div>

    {/* quick facts */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 16 }}>
      <div style={{ background: "var(--paper-card)", border: "1px solid var(--ink-12)", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Hours</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 2 }}>{site.hours}</div>
      </div>
      <div style={{ background: "var(--paper-card)", border: "1px solid var(--ink-12)", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Ticket</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 2 }}>50.000₫</div>
      </div>
      <div style={{ background: "var(--paper-card)", border: "1px solid var(--ink-12)", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>From Đông Hà</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 2 }}>{site.km} km</div>
      </div>
      <div style={{ background: "var(--paper-card)", border: "1px solid var(--ink-12)", borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--ink-60)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Built</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, marginTop: 2 }}>1965–66</div>
      </div>
    </div>

    {/* tabs */}
    <div style={{ display: "flex", gap: 4, padding: "0 16px", borderBottom: "1px solid var(--ink-12)" }}>
      {["Overview","History","Visit tips","Culture"].map((t, i) => (
        <div key={t} style={{ padding: "10px 4px", marginRight: 14, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500,
          color: i === 1 ? "var(--ink)" : "var(--ink-60)", borderBottom: i === 1 ? "2px solid var(--teal-700)" : "2px solid transparent",
        }}>{t}</div>
      ))}
    </div>

    {/* body */}
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.55, color: "var(--ink)" }}>
        Construction began in 1965 and continued through 1966, with three levels of tunnels descending to roughly 23 metres below the surface. The complex sheltered approximately 600 villagers from sustained bombing of the coastal strip.
      </p>
      <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.55, color: "var(--ink)" }}>
        Seventeen children were born inside during the war years. The tunnels remained in use until 1972, when the threat of bombardment subsided.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <Citation source="Bảo tàng Quảng Trị · 2019" track={site.track}/>
        <Citation source="DMZ History Project" track={site.track}/>
      </div>
    </div>

    {/* floating ask */}
    <div style={{ position: "sticky", bottom: 14, padding: "0 16px", marginTop: 8, marginBottom: 30 }}>
      <button onClick={onChat} style={{
        width: "100%", background: "var(--teal-700)", color: "#F7F4EE",
        border: "none", borderRadius: 999, padding: "13px 18px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 500,
        boxShadow: "var(--shadow-lift)", cursor: "pointer",
      }}>
        <Icon name="mic" size={18}/>
        Ask about this place
      </button>
    </div>
  </div>
);

// ── Chat ─────────────────────────────────────────────────────
const Chat = ({ track, lang, onBack }) => {
  const [voice, setVoice] = useS("idle");
  const [msgs, setMsgs] = useS([
    { role: "assistant", text: "I can take you through the history of this place. Ask me anything." },
  ]);
  const [input, setInput] = useS("");

  const send = (txt) => {
    const t = (txt ?? input).trim(); if (!t) return;
    const user = { role: "user", text: t };
    setMsgs(m => [...m, user, { role: "tool", text: "→ search_curated · vinh-moc · history · " + lang }]);
    setInput("");
    setTimeout(() => {
      setMsgs(m => [...m, { role: "assistant", text: "In 1966 the tunnels were extended to a third level, about 23 metres deep, to shelter villagers from sustained bombing of the coastal strip.", citations: ["Bảo tàng Quảng Trị · 2019"] }]);
    }, 700);
  };

  return (
    <div style={{ background: "var(--paper)", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* header */}
      <div style={{ padding: "56px 14px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--ink-12)" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", color: "var(--ink)" }}><Icon name="back" size={20}/></button>
        <TrackChip track={track} lang={lang}/>
        <div style={{ flex: 1 }}/>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-60)" }}>{lang.toUpperCase()}</span>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <React.Fragment key={i}>
            <Bubble role={m.role}>{m.text}</Bubble>
            {m.citations && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignSelf: "flex-start" }}>
                {m.citations.map(c => <Citation key={c} source={c} track={track}/>)}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* quick replies */}
      <div style={{ padding: "8px 14px 4px", display: "flex", gap: 6, overflowX: "auto" }}>
        <Pill onClick={() => send("Plan tomorrow")}>Plan tomorrow</Pill>
        <Pill onClick={() => send("Find food nearby")}>Find food nearby</Pill>
        <Pill onClick={() => send("Tell me about the war here")}>Tell me about the war here</Pill>
      </div>

      {/* input */}
      <div style={{ padding: "8px 14px 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "10px 14px", background: "var(--paper-card)", border: "1px solid var(--ink-12)", borderRadius: 12 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask anything…"
            style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)" }}/>
          <button onClick={() => send()} style={{ background: "transparent", border: "none", color: "var(--teal-700)", cursor: "pointer", padding: 0 }}>
            <Icon name="send" size={18}/>
          </button>
        </div>
        <div onClick={() => {
          setVoice("recording");
          setTimeout(() => setVoice("transcribing"), 1200);
          setTimeout(() => { setVoice("speaking"); send("What happened here in 1966?"); }, 2200);
          setTimeout(() => setVoice("idle"), 4500);
        }}>
          <VoiceButton state={voice}/>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { TrackPicker, MapHome, SiteDetail, Chat, SITES });
