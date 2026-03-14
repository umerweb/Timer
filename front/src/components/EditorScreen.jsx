import { useState, useEffect, useCallback } from "react";
import { API, apiFetch } from "../utils/api";
import {
  buildParams, defaultTarget, VISUAL_STYLES,
  TIMER_DEFAULTS, TIMER_TEMPLATES, TIMER_FONTS, TIMEZONES,
  Lbl, Field, Card, Chip, InfoBox, inputCls, CodeBox, UnsavedNudge,
  Header, NameModal,
} from "./timerUtils";

function timerGifUrl(id)   { return `${API}/t/${id}/gif`; }
function timerEmbedUrl(id) { return `${API}/t/${id}/embed`; }
function timerShareUrl(id) { return `${window.location.origin}/t/${id}`; }

function mergeCfg(incoming) {
  return { ...TIMER_DEFAULTS(), ...(incoming || {}) };
}

export default function EditorScreen({ user, serverOnline, initialTimer, onSaved, onBack, onLogout }) {

  const [tab,      setTab]      = useState("timer");
  const [target,   setTarget]   = useState(initialTimer?.target   || defaultTarget());
  const [timezone, setTimezone] = useState(initialTimer?.timezone || "UTC");
  const [mode,     setMode]     = useState(initialTimer?.mode     || "countdown");
  const [egHours,  setEgHours]  = useState(initialTimer?.egHours  || 48);
  const [cfg,      setCfg]      = useState(() => mergeCfg(initialTimer?.cfg));

  const [timerName,  setTimerName]  = useState(initialTimer?.name ?? "");
  const [savedId,    setSavedId]    = useState(initialTimer?.id   ?? null);
  const [saveRev,    setSaveRev]    = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveModal,  setSaveModal]  = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [copied,     setCopied]     = useState("");

  useEffect(() => {
    if (!initialTimer) return;
    setTarget(initialTimer.target    || defaultTarget());
    setTimezone(initialTimer.timezone || "UTC");
    setMode(initialTimer.mode        || "countdown");
    setEgHours(initialTimer.egHours  || 48);
    setCfg(mergeCfg(initialTimer.cfg));
    setTimerName(initialTimer.name   || "");
    setSavedId(initialTimer.id       ?? null);
  }, [initialTimer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sc = useCallback((k, v) => setCfg((c) => ({ ...c, [k]: v })), []);

  const previewParams   = buildParams(cfg, target, mode, egHours, timezone);
  const previewEmbedUrl = `${API}/api/timer/embed?${previewParams}`;

  const shortGifUrl   = savedId ? `${timerGifUrl(savedId)}?v=${saveRev}`   : null;
  const shortEmbedUrl = savedId ? `${timerEmbedUrl(savedId)}?v=${saveRev}` : null;
  const shareLink     = savedId ? timerShareUrl(savedId)                   : null;
  const cleanGifUrl   = savedId ? timerGifUrl(savedId)                     : null;
  const cleanEmbedUrl = savedId ? timerEmbedUrl(savedId)                   : null;

  const qrUrl = shareLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareLink)}&bgcolor=ffffff&color=${(cfg.accent||"#818cf8").replace("#","")}&qzone=2`
    : null;

  const imgTag = cleanGifUrl
    ? `<img src="${cleanGifUrl}"\n  width="600"\n  style="display:block;width:100%;max-width:600px;height:auto;border:0;"\n  alt="${cfg.title || "Countdown Timer"}">`
    : "";

  const emailBlock = cleanGifUrl ? `<!-- ${cfg.title || "Countdown Timer"} -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;">
  <tr>
    <td align="center" bgcolor="${cfg.bg}" style="padding:32px 24px;border-radius:${cfg.borderRadius}px;">
      <img src="${cleanGifUrl}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" alt="${cfg.title || "Countdown Timer"}">
    </td>
  </tr>
</table>` : "";

  const iframeTag = cleanEmbedUrl
    ? `<!-- Responsive countdown embed -->\n<div style="position:relative;width:100%;max-width:600px;padding-bottom:28%;height:0;overflow:hidden;">\n  <iframe src="${cleanEmbedUrl}"\n    style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;overflow:hidden;"\n    scrolling="no" title="${cfg.title || "Countdown Timer"}">\n  </iframe>\n</div>`
    : "";

  const copy = useCallback((text, id) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(""), 2200);
  }, []);

  const currentPayload = (name) => ({ name, target, mode, egHours, timezone, cfg });

  const handleSaveNew = async (name) => {
    setSaveModal(false); setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers`, { method: "POST", body: JSON.stringify(currentPayload(name)) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setSavedId(saved.id); setTimerName(saved.name); setSaveRev(r => r + 1);
      setSaveStatus("saved");
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch (err) {
      console.error("Save failed:", err); setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  const handleSaveNewFromTab = async (name) => {
    setSaveModal(false); setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers`, { method: "POST", body: JSON.stringify(currentPayload(name)) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setSavedId(saved.id); setTimerName(saved.name); setSaveRev(r => r + 1);
      setSaveStatus("saved");
      if (pendingTab) setTab(pendingTab);
      setPendingTab(null);
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch (err) {
      console.error("Save failed:", err); setSaveStatus("error"); setPendingTab(null);
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  const handleUpdate = async () => {
    if (!savedId) return;
    setSaveStatus("saving");
    try {
      const res = await apiFetch(`${API}/api/timers/${savedId}`, { method: "PUT", body: JSON.stringify(currentPayload(timerName)) });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setTimerName(saved.name); setSaveRev(r => r + 1);
      setSaveStatus("saved");
      setTimeout(() => { setSaveStatus(""); onSaved(saved); }, 1200);
    } catch (err) {
      console.error("Update failed:", err); setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 1200);
    }
  };

  const handleTabClick = (id) => {
    if (["email","embed","share"].includes(id) && !savedId) { setPendingTab(id); setSaveModal(true); }
    else setTab(id);
  };

  const isSaved      = !!savedId;
  const saveBtnLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved!" : saveStatus === "error" ? "✗ Error" : (!isSaved ? "Save Timer" : "Save Changes");
  const saveBtnBg    = saveStatus === "saved" ? "var(--color-green)" : saveStatus === "error" ? "var(--color-red)" : "var(--color-accent)";

  const TABS = [
    { id:"timer",  label:"⏱ Timer"  },
    { id:"design", label:"🎨 Design" },
    { id:"email",  label:"📧 Email"  },
    { id:"embed",  label:"🌐 Embed"  },
    { id:"share",  label:"🔗 Share"  },
  ];

  const timezones      = TIMEZONES();
  const timerTemplates = TIMER_TEMPLATES();
  const timerFonts     = TIMER_FONTS();   // [{ name, label, file }]

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-[var(--font-sans)] flex flex-col">
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        input[type=range]{accent-color:var(--color-accent);width:100%;cursor:pointer;}
        input[type=color]{cursor:pointer;}
        select,input,button,textarea{font-family:inherit;}
        input:focus,select:focus{outline:2px solid var(--color-accent);outline-offset:1px;border-radius:7px;}
        @media(max-width:800px){
          .editor-body{flex-direction:column!important;}
          .editor-preview{border-right:none!important;border-bottom:1px solid var(--color-border)!important;min-height:220px!important;}
          .editor-sidebar{width:100%!important;}
        }
      `}</style>

      <Header user={user} serverOnline={serverOnline} onLogout={onLogout}>
        <button onClick={onBack} className="bg-white text-[var(--color-mid)] border border-[var(--color-border)] rounded-lg px-3.5 py-[7px] text-xs font-semibold cursor-pointer font-[inherit] flex items-center gap-1.5">
          ← My Timers
        </button>
        <div className={`px-3 py-[5px] rounded-full text-[11px] font-bold border ${!isSaved ? "bg-[var(--color-purpleBg)] border-[var(--color-purpleBdr)] text-[var(--color-purple)]" : "bg-[var(--color-amberBg)] border-[var(--color-amberBdr)] text-[var(--color-amber)]"}`}>
          {!isSaved ? "✨ New Timer" : `✏️ Editing: ${timerName}`}
        </div>
        <button onClick={!isSaved ? () => setSaveModal(true) : handleUpdate} disabled={saveStatus==="saving"}
          className="text-white border-none rounded-lg px-[18px] py-2 text-[13px] font-bold cursor-pointer font-[inherit] min-w-[120px] transition-colors duration-200"
          style={{ background: saveBtnBg }}>
          {saveBtnLabel}
        </button>
      </Header>

      <div className="editor-body flex-1 flex overflow-hidden min-h-0">

        {/* ── Preview pane ── */}
        <div className="editor-preview flex-1 flex flex-col items-center justify-center gap-5 p-8 overflow-y-auto relative border-r border-[var(--color-border)]"
          style={{ background:"linear-gradient(135deg,#eef2ff 0%,#f1f5f9 50%,#eff6ff 100%)" }}>
          <div className="absolute inset-0 opacity-25 pointer-events-none"
            style={{ backgroundImage:"radial-gradient(circle,#c7d2fe 1px,transparent 1px)", backgroundSize:"28px 28px" }} />
          <div className="relative z-10 text-center w-full max-w-[560px]">
            <div className="text-[var(--color-faint)] text-[10px] tracking-[0.25em] uppercase font-semibold mb-[18px]">LIVE PREVIEW</div>
            <div className="rounded-2xl overflow-hidden shadow-[var(--shadow-xl)]" style={{ height:140, background:cfg.bg }}>
              <iframe key={previewParams} src={previewEmbedUrl} className="w-full h-full border-none block" title="Timer Preview" />
            </div>
            {mode === "evergreen" && <div className="text-[var(--color-accent)] text-[11px] mt-3 font-medium">⚡ Evergreen — resets each time email opens</div>}
          </div>
          <div className="flex gap-2.5 flex-wrap justify-center relative z-10">
            {[
              { l:"Mode",     v:mode==="evergreen"?"Evergreen ♻":mode==="countup"?"Count Up ↑":"Countdown ↓" },
              { l:"Timezone", v:timezone.split("/").pop() },
              { l:"ID",       v:savedId?`#${savedId}`:"unsaved" },
            ].map((s) => (
              <div key={s.l} className="bg-white border border-[var(--color-border)] rounded-[9px] px-3.5 py-[7px] text-center shadow-[var(--shadow-sm)]">
                <div className="text-[var(--color-faint)] text-[9px] uppercase tracking-[0.1em] font-semibold">{s.l}</div>
                <div className="text-[var(--color-mid)] text-xs font-mono mt-0.5 font-semibold">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="editor-sidebar w-[410px] flex flex-col bg-[var(--color-panel)] border-l border-[var(--color-border)] overflow-hidden flex-shrink-0">
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => handleTabClick(id)}
                className={`flex-1 py-[11px] px-0.5 border-none cursor-pointer text-[10px] font-[inherit] transition-all duration-150 capitalize tracking-[0.03em] border-b-2
                  ${tab===id ? "bg-[var(--color-panel)] text-[var(--color-accent)] font-bold border-[var(--color-accent)]" : "bg-transparent text-[var(--color-muted)] font-medium border-transparent"}`}>
                {label}{["email","embed","share"].includes(id)&&!savedId&&<span className="ml-0.5 opacity-40">🔒</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-[18px]">

            {/* ── Timer tab ── */}
            {tab === "timer" && (
              <div>
                <Field label="Event Title">
                  <input value={cfg.title} onChange={(e) => sc("title", e.target.value)} className={inputCls()} placeholder="OFFER ENDS IN" />
                </Field>
                <Field label="Target Date & Time">
                  <input type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)}
                    className={`${inputCls()} ${mode==="evergreen"?"opacity-40":""}`} disabled={mode==="evergreen"} />
                </Field>
                <Field label="Timezone">
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls()}>
                    {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </Field>
                <Card>
                  <Lbl>Timer Mode</Lbl>
                  <Chip active={mode==="countdown"} onClick={() => setMode("countdown")} icon="⏱" title="Countdown"  desc="Count down to a specific date" />
                  <Chip active={mode==="countup"}   onClick={() => setMode("countup")}   icon="⬆" title="Count Up"   desc="Count up from a date" />
                  <Chip active={mode==="evergreen"} onClick={() => setMode("evergreen")} icon="♻" title="Evergreen"  desc="Starts fresh each time email opens" />
                </Card>
                {mode === "evergreen" && (
                  <Card>
                    <Lbl>Duration: {egHours}h ({Math.floor(egHours/24)}d {egHours%24}h)</Lbl>
                    <input type="range" min={1} max={168} value={egHours} onChange={(e) => setEgHours(+e.target.value)} />
                    <div className="flex justify-between text-[var(--color-faint)] text-[10px] mt-1"><span>1h</span><span>1 week</span></div>
                  </Card>
                )}
                <Card>
                  <Lbl>Show Units</Lbl>
                  <div className="grid grid-cols-2 gap-2">
                    {[["showDays","Days"],["showHours","Hours"],["showMinutes","Minutes"],["showSeconds","Seconds"]].map(([k,l]) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer px-[11px] py-[9px] bg-white border border-[var(--color-border)] rounded-[7px]">
                        <input type="checkbox" checked={!!cfg[k]} onChange={(e) => sc(k, e.target.checked)} className="w-[15px] h-[15px] cursor-pointer accent-[var(--color-accent)]" />
                        <span className="text-[var(--color-mid)] text-xs font-medium">{l}</span>
                      </label>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Design tab ── */}
            {tab === "design" && (
              <div>

                {/* Style picker */}
                <Lbl>Style</Lbl>
                <div className="grid grid-cols-3 gap-2 mb-[18px]">
                  {Object.entries(VISUAL_STYLES).map(([key, vs]) => {
                    const active = (cfg.visualStyle || "flat") === key;
                    return (
                      <div key={key} onClick={() => sc("visualStyle", key)}
                        className={`cursor-pointer rounded-[9px] p-2 border-[2px] transition-all duration-150 flex flex-col items-center gap-1.5
                          ${active ? "border-[var(--color-accent)] bg-[var(--color-accentBg)]" : "border-[var(--color-border)] bg-[var(--color-card)]"}`}>
                        <div style={{ width:"100%", height:38, borderRadius:6, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", gap:3, overflow:"hidden", padding:"4px 6px", ...vs.wrapper(0.45, cfg) }}>
                          {["00","00"].map((v, i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:2 }}>
                              <div style={{ fontSize:11, fontWeight:700, padding:"2px 5px", minWidth:20, textAlign:"center", lineHeight:1, color:cfg.text, background:cfg.box, ...vs.box(0.45, cfg) }}>{v}</div>
                              {i===0 && <div style={{ fontSize:10, marginBottom:2, ...vs.sep(0.45, cfg) }}>:</div>}
                            </div>
                          ))}
                        </div>
                        <div className={`text-[10px] font-semibold ${active ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}>{vs.name}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Colour theme presets */}
                <Lbl>Color Theme</Lbl>
                <div className="grid grid-cols-3 gap-2 mb-[18px]">
                  {timerTemplates.map((t) => (
                    <div key={t.name} onClick={() => setCfg((c) => ({ ...c, bg:t.bg, box:t.box, text:t.text, accent:t.accent }))}
                      className="p-2.5 rounded-[9px] cursor-pointer text-center shadow-[0_1px_4px_rgba(0,0,0,.12)]"
                      style={{ background:t.bg, border:`2px solid ${t.accent}55` }}>
                      <div className="text-[10px] font-bold mb-[5px]" style={{ color:t.text }}>{t.name}</div>
                      <div className="flex gap-[3px] justify-center">
                        {[t.bg,t.box,t.text,t.accent].map((c,i) => (
                          <div key={i} className="w-[9px] h-[9px] rounded-full border border-black/20" style={{ background:c }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full colour pickers */}
                <Card>
                  <Lbl>Colors</Lbl>
                  {[
                    ["bg",     "Background"],
                    ["box",    "Number Box"],
                    ["text",   "Text"],
                    ["accent", "Accent"],
                  ].map(([k, l]) => (
                    <div key={k} className="flex items-center gap-2.5 mb-3">
                      <input type="color" value={cfg[k]||"#000000"} onChange={(e) => sc(k, e.target.value)}
                        className="w-9 h-9 border border-[var(--color-border)] rounded-[7px] p-0.5 flex-shrink-0 cursor-pointer" />
                      <span className="text-[var(--color-mid)] text-xs font-medium flex-1">{l}</span>
                      <code className="text-[var(--color-muted)] text-[10px] bg-[var(--color-card)] px-[7px] py-[2px] rounded border border-[var(--color-border)] font-mono">{cfg[k]}</code>
                    </div>
                  ))}
                </Card>

                {/* Font — options come from backend TIMER_FONTS */}
                <Field label="Font">
                  <select value={cfg.font || "Orbitron"} onChange={(e) => sc("font", e.target.value)} className={inputCls()}>
                    {timerFonts.map((f) => (
                      <option key={f.name} value={f.name}>{f.label}</option>
                    ))}
                  </select>
                </Field>

                {/* Number font size */}
                <Field label={`Number Size: ${cfg.fontSize || 36}px`} mb="mb-3.5">
                  <input type="range" min={18} max={64} value={cfg.fontSize||36} onChange={(e) => sc("fontSize", +e.target.value)} />
                  <div className="flex justify-between text-[var(--color-faint)] text-[10px] mt-1"><span>18px</span><span>64px</span></div>
                </Field>

                {/* Label font size */}
                <Field label={`Label Size: ${cfg.labelSize || 11}px`} mb="mb-3.5">
                  <input type="range" min={7} max={20} value={cfg.labelSize||11} onChange={(e) => sc("labelSize", +e.target.value)} />
                  <div className="flex justify-between text-[var(--color-faint)] text-[10px] mt-1"><span>7px</span><span>20px</span></div>
                </Field>

                {/* Corner radius */}
                <Field label={`Corner Radius: ${cfg.borderRadius ?? 12}px`} mb="mb-3.5">
                  <input type="range" min={0} max={32} value={cfg.borderRadius??12} onChange={(e) => sc("borderRadius", +e.target.value)} />
                  <div className="flex justify-between text-[var(--color-faint)] text-[10px] mt-1"><span>0</span><span>32px</span></div>
                </Field>

              </div>
            )}

            {/* ── Email tab ── */}
            {tab === "email" && (
              <div>
                {!savedId ? <UnsavedNudge onSave={() => setSaveModal(true)} /> : <>
                  <InfoBox colorVar="accent" bgVar="accentBg" borderVar="accentBdr" title="📧 Email Countdown GIF">
                    Rendered at 600px — the standard email width. Scales perfectly on mobile with <code>width:100%</code>.
                  </InfoBox>
                  {serverOnline && (
                    <Card>
                      <Lbl>Live GIF Preview</Lbl>
                      <div className="bg-[#111] rounded-lg p-3 text-center mb-2">
                        <img key={saveRev} src={shortGifUrl} alt="Timer GIF" style={{ display:"block", width:"100%", height:"auto", borderRadius:6 }} />
                      </div>
                    </Card>
                  )}
                  <CodeBox code={imgTag}     cid="img"   copied={copied} copy={copy} label="📋 Quick img tag" />
                  <CodeBox code={emailBlock} cid="email" copied={copied} copy={copy} label="Full HTML Email Block" />
                  <InfoBox colorVar="amber" bgVar="amberBg" borderVar="amberBdr" title="🍎 Apple Mail / MPP Note">
                    Apple Mail pre-fetches images which can freeze the GIF at frame 1. Use Litmus or Email on Acid to test.
                  </InfoBox>
                </>}
              </div>
            )}

            {/* ── Embed tab ── */}
            {tab === "embed" && (
              <div>
                {!savedId ? <UnsavedNudge onSave={() => setSaveModal(true)} /> : <>
                  <InfoBox colorVar="blue" bgVar="blueBg" borderVar="blueBdr" title="🌐 Website iFrame Embed">
                    Fully responsive — the wrapper div scales the iframe to any screen width automatically.
                  </InfoBox>
                  {serverOnline && (
                    <Card>
                      <Lbl>Live Embed Preview</Lbl>
                      <div className="border border-[var(--color-border)] rounded-lg overflow-hidden h-[130px]" style={{ background:cfg.bg }}>
                        <iframe key={saveRev} src={shortEmbedUrl} className="w-full h-full border-none block" title="Timer Embed" />
                      </div>
                    </Card>
                  )}
                  <CodeBox code={iframeTag} cid="iframe" copied={copied} copy={copy} label="📋 Responsive iframe (paste into website)" />
                  <Card>
                    <Lbl>Direct embed URL</Lbl>
                    <div className="flex gap-2 items-center">
                      <input readOnly value={cleanEmbedUrl} className={`${inputCls()} text-[10px] text-[var(--color-muted)] bg-[var(--color-card)] flex-1`} />
                      <button onClick={() => copy(cleanEmbedUrl, "eu")}
                        className={`text-white border-none rounded-[6px] px-3 py-2 text-[11px] cursor-pointer font-bold whitespace-nowrap flex-shrink-0 font-[inherit] ${copied==="eu"?"bg-[var(--color-green)]":"bg-[var(--color-accent)]"}`}>
                        {copied==="eu"?"✓ Copied":"Copy"}
                      </button>
                    </div>
                  </Card>
                </>}
              </div>
            )}

            {/* ── Share tab ── */}
            {tab === "share" && (
              <div>
                {!savedId ? <UnsavedNudge onSave={() => setSaveModal(true)} /> : <>
                  <Lbl>Share Link</Lbl>
                  <div className="flex gap-2 mb-4 items-stretch">
                    <input value={shareLink} readOnly className={`${inputCls()} flex-1 text-[10px] text-[var(--color-muted)] bg-[var(--color-card)]`} />
                    <button onClick={() => copy(shareLink, "sl")}
                      className={`text-white border-none rounded-[7px] px-3.5 py-2 text-[11px] cursor-pointer font-bold whitespace-nowrap flex-shrink-0 font-[inherit] ${copied==="sl"?"bg-[var(--color-green)]":"bg-[var(--color-accent)]"}`}>
                      {copied==="sl"?"✓ Copied":"Copy"}
                    </button>
                  </div>
                  <Lbl>QR Code</Lbl>
                  <div className="bg-white border border-[var(--color-border)] rounded-[10px] p-5 text-center mb-4">
                    <img src={qrUrl} alt="QR" width={150} height={150} className="rounded-lg block mx-auto" />
                    <div className="text-[var(--color-muted)] text-[11px] mt-2.5 font-medium">Scan to open countdown</div>
                  </div>
                  <Lbl>Share to Social</Lbl>
                  {[
                    { name:"Twitter / X", color:"#1da1f2", url:`https://twitter.com/intent/tweet?text=${encodeURIComponent("⏱ "+(cfg.title||"")+" "+shareLink)}` },
                    { name:"Facebook",    color:"#1877f2", url:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}` },
                    { name:"WhatsApp",    color:"#25d366", url:`https://wa.me/?text=${encodeURIComponent("⏱ "+(cfg.title||"")+" "+shareLink)}` },
                    { name:"LinkedIn",    color:"#0a66c2", url:`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}` },
                  ].map((s) => (
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border-[1.5px] border-[var(--color-border)] rounded-lg mb-2 no-underline text-xs font-semibold"
                      style={{ color:s.color }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:s.color }} />
                      Share on {s.name} ↗
                    </a>
                  ))}
                </>}
              </div>
            )}

          </div>
        </div>
      </div>

      {saveModal && (
        <NameModal title="Save Timer" description="Give this timer a name so you can find it later." confirmLabel="Save Timer"
          onConfirm={pendingTab ? handleSaveNewFromTab : handleSaveNew}
          onClose={() => { setSaveModal(false); setPendingTab(null); }} />
      )}
    </div>
  );
}