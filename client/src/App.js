import { useState, useEffect, useCallback, memo, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:3001";

/* ── palette ── */
const P = {
  bg:"#f1f5f9", panel:"#fff", border:"#e2e8f0", borderDark:"#cbd5e1",
  text:"#0f172a", mid:"#334155", muted:"#64748b", faint:"#94a3b8",
  card:"#f8fafc", accent:"#4f46e5",
  green:"#15803d", greenBg:"#f0fdf4", greenBdr:"#bbf7d0",
  amber:"#92400e", amberBg:"#fffbeb", amberBdr:"#fde68a",
  blue:"#1e40af",  blueBg:"#eff6ff",  blueBdr:"#bfdbfe",
  accentBg:"#eef2ff", accentBdr:"#c7d2fe",
  codeBg:"#1e1e2e", codeText:"#a6e3a1",
};

const FONTS = ["Orbitron","Space Mono","Oswald","Bebas Neue","Rajdhani","Share Tech Mono","DM Serif Display","Playfair Display"];
const TEMPLATES = [
  {name:"Dark Pro", bg:"#0f0f1a",box:"#1e1b4b",text:"#e0e7ff",accent:"#818cf8"},
  {name:"Fire",     bg:"#1c0a00",box:"#7f1d1d",text:"#fef2f2",accent:"#f97316"},
  {name:"Ocean",    bg:"#0c1a2e",box:"#0c4a6e",text:"#e0f2fe",accent:"#38bdf8"},
  {name:"Forest",   bg:"#052e16",box:"#14532d",text:"#dcfce7",accent:"#4ade80"},
  {name:"Gold",     bg:"#1c1400",box:"#451a03",text:"#fef9c3",accent:"#facc15"},
  {name:"Rose",     bg:"#1a000f",box:"#4c0519",text:"#ffe4e6",accent:"#fb7185"},
];
const TIMEZONES = ["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Karachi","Asia/Kolkata","Asia/Tokyo","Asia/Shanghai","Australia/Sydney","Pacific/Auckland"];
const LANGUAGES = ["English","Spanish","French","German","Portuguese","Italian","Dutch","Japanese","Korean","Arabic","Chinese","Polish","Russian"];

/* ── time helpers ── */
function pad(n){return String(Math.max(0,Math.floor(n))).padStart(2,"0");}
function calcTime(target,mode,countUp,egHours){
  if(mode==="evergreen"){const h=egHours;return{days:Math.floor(h/24),hours:h%24,minutes:0,seconds:0,done:false};}
  let diff=new Date(target)-new Date();
  if(countUp)diff=-diff;
  if(diff<0)diff=0;
  return{days:Math.floor(diff/86400000),hours:Math.floor((diff%86400000)/3600000),minutes:Math.floor((diff%3600000)/60000),seconds:Math.floor((diff%60000)/1000),done:diff===0};
}

/* ── build server URL params from cfg ── */
function buildParams(cfg, target, mode, egHours) {
  const p = new URLSearchParams({
    target,
    mode,
    egHours,
    bg:          cfg.bg.replace("#",""),
    box:         cfg.box.replace("#",""),
    text:        cfg.text.replace("#",""),
    accent:      cfg.accent.replace("#",""),
    title:       cfg.title,
    fontSize:    cfg.fontSize,
    borderRadius:cfg.borderRadius,
    transparent: cfg.transparent ? "1" : "0",
    days:        cfg.showDays    ? "1" : "0",
    hours:       cfg.showHours   ? "1" : "0",
    minutes:     cfg.showMinutes ? "1" : "0",
    seconds:     cfg.showSeconds ? "1" : "0",
  });
  return p.toString();
}

/* ── isolated timer face (memo — never re-renders from parent tick) ── */
const TimerFace = memo(function({time,cfg,scale=1}){
  const units=[
    cfg.showDays    &&{lbl:"DAYS",  val:pad(time.days)},
    cfg.showHours   &&{lbl:"HRS",   val:pad(time.hours)},
    cfg.showMinutes &&{lbl:"MIN",   val:pad(time.minutes)},
    cfg.showSeconds &&{lbl:"SEC",   val:pad(time.seconds)},
  ].filter(Boolean);
  const fs=(cfg.fontSize||36)*scale;
  return(
    <div style={{background:cfg.transparent?"transparent":cfg.bg,padding:`${20*scale}px ${24*scale}px`,
      borderRadius:`${(cfg.borderRadius||12)*scale}px`,fontFamily:`'${cfg.font||"Orbitron"}',monospace`,
      display:"inline-flex",flexDirection:"column",alignItems:"center",gap:`${10*scale}px`,
      border:`${2*scale}px solid ${cfg.accent}44`,boxShadow:`0 ${4*scale}px ${20*scale}px ${cfg.accent}18`}}>
      {cfg.title&&<div style={{color:cfg.text,fontSize:`${11*scale}px`,letterSpacing:"0.18em",textTransform:"uppercase",fontWeight:700,opacity:.9}}>{cfg.title}</div>}
      {time.done?<div style={{color:cfg.accent,fontSize:`${20*scale}px`,fontWeight:700}}>EXPIRED</div>
      :<div style={{display:"flex",gap:`${10*scale}px`,alignItems:"flex-start"}}>
        {units.map(({lbl,val},i)=>(
          <div key={lbl} style={{display:"flex",alignItems:"center"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{background:cfg.box,color:cfg.text,fontSize:`${fs}px`,fontWeight:700,
                padding:`${10*scale}px ${16*scale}px`,borderRadius:`${7*scale}px`,lineHeight:1,
                minWidth:`${52*scale}px`,textAlign:"center",border:`1px solid ${cfg.accent}30`,
                boxShadow:`0 ${2*scale}px ${8*scale}px rgba(0,0,0,.25)`}}>{val}</div>
              <div style={{color:cfg.text,fontSize:`${9*scale}px`,opacity:.55,marginTop:`${4*scale}px`,letterSpacing:"0.14em"}}>{lbl}</div>
            </div>
            {i<units.length-1&&<div style={{color:cfg.accent,fontSize:`${fs*.8}px`,fontWeight:700,margin:`0 ${3*scale}px`,paddingBottom:`${12*scale}px`,opacity:.65}}>:</div>}
          </div>
        ))}
      </div>}
    </div>
  );
});

/* isolated clock islands — their tick never causes parent re-render */
function LiveClock({target,mode,countUp,egHours,cfg}){
  const[time,setTime]=useState(()=>calcTime(target,mode,countUp,egHours));
  useEffect(()=>{
    setTime(calcTime(target,mode,countUp,egHours));
    if(mode==="evergreen")return;
    const id=setInterval(()=>setTime(calcTime(target,mode,countUp,egHours)),1000);
    return()=>clearInterval(id);
  },[target,mode,countUp,egHours]);
  return<TimerFace time={time} cfg={cfg} scale={1}/>;
}

/* ── UI atoms ── */
const INP={background:"#fff",color:P.text,border:`1px solid ${P.borderDark}`,borderRadius:7,padding:"8px 11px",fontSize:13,width:"100%",fontFamily:"inherit",boxSizing:"border-box"};
function Lbl({children}){return<div style={{color:P.muted,fontSize:11,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>{children}</div>;}
function Field({label,mb=16,children}){return<div style={{marginBottom:mb}}>{label&&<Lbl>{label}</Lbl>}{children}</div>;}
function Card({children,style={}}){return<div style={{background:P.card,border:`1px solid ${P.border}`,borderRadius:10,padding:14,marginBottom:14,...style}}>{children}</div>;}
function Chip({active,onClick,icon,title,desc}){
  return<div onClick={onClick} style={{padding:"10px 12px",borderRadius:8,cursor:"pointer",marginBottom:7,
    background:active?P.accentBg:P.card,border:`1.5px solid ${active?P.accent:P.border}`,transition:"all .15s"}}>
    <div style={{color:active?P.accent:P.mid,fontSize:12,fontWeight:700}}>{icon} {title}</div>
    <div style={{color:P.muted,fontSize:11,marginTop:2}}>{desc}</div>
  </div>;
}
function InfoBox({color,bg,border,title,children}){
  return<div style={{background:bg,border:`1px solid ${border}`,borderRadius:10,padding:13,marginBottom:14}}>
    <div style={{color,fontSize:12,fontWeight:700,marginBottom:3}}>{title}</div>
    <div style={{color,fontSize:11,lineHeight:1.65,opacity:.85}}>{children}</div>
  </div>;
}
function CodeBox({code,cid,copied,copy,label}){
  return<div style={{marginBottom:16}}>
    {label&&<Lbl>{label}</Lbl>}
    <div style={{position:"relative"}}>
      <pre style={{background:P.codeBg,color:P.codeText,padding:"13px 14px",borderRadius:8,fontSize:11,
        overflowX:"auto",margin:0,fontFamily:"monospace",border:"1px solid #313244",lineHeight:1.6,
        maxHeight:150,whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{code}</pre>
      <button onClick={()=>copy(code,cid)} style={{position:"absolute",top:8,right:8,
        background:copied===cid?P.green:P.accent,color:"#fff",border:"none",borderRadius:5,
        padding:"4px 10px",fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>
        {copied===cid?"✓ Copied":"Copy"}
      </button>
    </div>
  </div>;
}
function Btn({onClick,children,disabled,variant="primary",full,small}){
  const bg=variant==="primary"?P.accent:variant==="success"?P.green:variant==="outline"?"white":P.card;
  const cl=variant==="outline"||variant==="ghost"?P.mid:"#fff";
  const bd=variant==="outline"?`1px solid ${P.borderDark}`:"none";
  return<button onClick={onClick} disabled={disabled} style={{
    width:full?"100%":"auto",padding:small?"7px 12px":"10px 16px",borderRadius:8,border:bd,
    cursor:disabled?"not-allowed":"pointer",background:disabled?"#a5b4fc":bg,
    color:cl,fontWeight:700,fontSize:small?11:13,fontFamily:"inherit",
    opacity:disabled?.65:1,transition:"all .15s",display:"inline-flex",
    alignItems:"center",justifyContent:"center",gap:6}}>
    {children}
  </button>;
}

/* ════════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════════ */
export default function App(){
  const[tab,setTab]=useState("timer");
  const[target,setTarget]=useState(()=>{
    const d=new Date();d.setDate(d.getDate()+7);
    return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  });
  const[timezone,setTimezone]=useState("UTC");
  const[mode,setMode]=useState("countdown");
  const[egHours,setEgHours]=useState(48);
  const[language,setLanguage]=useState("English");
  const[cfg,setCfg]=useState({
    bg:"#0f0f1a",box:"#1e1b4b",text:"#e0e7ff",accent:"#818cf8",
    font:"Orbitron",title:"OFFER ENDS IN",
    showDays:true,showHours:true,showMinutes:true,showSeconds:true,
    transparent:false,borderRadius:12,fontSize:36,
  });
  const[copied,setCopied]=useState("");
  const[serverOnline,setServerOnline]=useState(null); // null=checking, true, false

  const sc=useCallback((k,v)=>setCfg(c=>({...c,[k]:v})),[]);
  const countUp=mode==="countup";
  const params=buildParams(cfg,target,mode,egHours);

  const copy=useCallback((text,id)=>{
    navigator.clipboard.writeText(text).catch(()=>{});
    setCopied(id);setTimeout(()=>setCopied(""),2200);
  },[]);

  /* check server is alive */
  useEffect(()=>{
    fetch(`${API}/health`).then(r=>r.ok?setServerOnline(true):setServerOnline(false)).catch(()=>setServerOnline(false));
  },[]);

  /* ── real server URLs ── */
  const gifUrl     = `${API}/gif?${params}`;
  const embedUrl   = `${API}/embed?${params}`;
  const previewUrl = `${API}/preview?${params}`;

  /* ── ready-to-paste output snippets (exactly like real providers) ── */
  const imgTag = `<img src="${gifUrl}"\n  style="display:inline-block;line-height:0;width:100%;max-width:380px"\n  alt="${cfg.title || "Countdown Timer"}">`;

  const iframeTag = `<iframe src="${embedUrl}"\n  width="420" height="130"\n  frameborder="0" scrolling="no"\n  style="border:none;overflow:hidden;display:block">\n</iframe>`;

  const emailBlock = `<!-- ${cfg.title || "Countdown Timer"} -->\n<table cellpadding="0" cellspacing="0" border="0" align="center" width="100%">\n  <tr>\n    <td align="center" bgcolor="${cfg.bg}"\n        style="padding:24px;border-radius:${cfg.borderRadius}px;">\n      ${p_title(cfg)}\n      <img src="${gifUrl}"\n           style="display:inline-block;line-height:0;width:100%;max-width:380px"\n           alt="${cfg.title || "Countdown Timer"}">\n      <!--[if mso]>\n      <p style="color:${cfg.accent};font-weight:bold">Hurry — limited time!</p>\n      <![endif]-->\n    </td>\n  </tr>\n</table>`;

  const shareLink = `${window.location.origin}${window.location.pathname}?${params}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareLink)}&bgcolor=ffffff&color=${P.accent.replace("#","")}&qzone=2`;

  function p_title(c){ return c.title?`<p style="color:${c.text};font-size:11px;letter-spacing:3px;margin:0 0 12px;text-transform:uppercase;font-family:monospace">${c.title}</p>`:""; }

  return(
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,fontFamily:"system-ui,'Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        input[type=range]{accent-color:${P.accent};width:100%;cursor:pointer;}
        input[type=color]{cursor:pointer;}
        select,input,button,textarea{font-family:inherit;}
        input:focus,select:focus{outline:2px solid ${P.accent};outline-offset:1px;border-radius:7px;}
        @media(max-width:750px){
          .layout{flex-direction:column!important;}
          .preview{border-right:none!important;border-bottom:1px solid ${P.border}!important;min-height:240px!important;}
          .sidebar{width:100%!important;}
        }
      `}</style>

      {/* Header */}
      <div style={{background:P.panel,borderBottom:`1px solid ${P.border}`,padding:"12px 20px",
        display:"flex",alignItems:"center",gap:12,flexShrink:0,
        boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <div style={{width:34,height:34,borderRadius:9,fontSize:17,
          background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
          display:"flex",alignItems:"center",justifyContent:"center"}}>⏳</div>
        <div>
          <div style={{fontWeight:700,fontSize:15,letterSpacing:"-.02em"}}>CountTimer Pro</div>
          <div style={{fontSize:11,color:P.faint}}>All-in-one countdown generator</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {/* server status badge */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",
            borderRadius:20,background:serverOnline===true?P.greenBg:serverOnline===false?"#fef2f2":P.card,
            border:`1px solid ${serverOnline===true?P.greenBdr:serverOnline===false?"#fecaca":P.border}`,
            fontSize:11,fontWeight:600,
            color:serverOnline===true?P.green:serverOnline===false?"#dc2626":P.muted}}>
            <div style={{width:7,height:7,borderRadius:"50%",
              background:serverOnline===true?"#22c55e":serverOnline===false?"#ef4444":"#94a3b8"}}/>
            {serverOnline===true?"Server Online":serverOnline===false?"Server Offline":"Connecting…"}
          </div>
        </div>
      </div>

      {serverOnline===false&&(
        <div style={{background:"#fef2f2",border:"none",borderBottom:"1px solid #fecaca",
          padding:"10px 20px",display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#991b1b"}}>
          <span>⚠️</span>
          <span>Server not running. Start it with: <code style={{background:"#fee2e2",padding:"2px 6px",borderRadius:4}}>cd server && npm install && npm start</code> — then refresh.</span>
        </div>
      )}

      {/* Main layout */}
      <div className="layout" style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

        {/* Preview */}
        <div className="preview" style={{flex:1,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:20,padding:32,overflowY:"auto",
          background:"linear-gradient(135deg,#eef2ff 0%,#f1f5f9 50%,#eff6ff 100%)",
          borderRight:`1px solid ${P.border}`,position:"relative"}}>
          <div style={{position:"absolute",inset:0,opacity:.3,pointerEvents:"none",
            backgroundImage:"radial-gradient(circle,#c7d2fe 1px,transparent 1px)",
            backgroundSize:"28px 28px"}}/>
          <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
            <div style={{color:P.faint,fontSize:10,letterSpacing:"0.25em",
              textTransform:"uppercase",fontWeight:600,marginBottom:18}}>LIVE PREVIEW</div>
            <div style={{background:"white",borderRadius:16,padding:28,display:"inline-block",
              boxShadow:"0 4px 24px rgba(79,70,229,.13),0 1px 4px rgba(0,0,0,.07)"}}>
              <LiveClock target={target} mode={mode} countUp={countUp} egHours={egHours} cfg={cfg}/>
            </div>
            {mode==="evergreen"&&<div style={{color:P.accent,fontSize:11,marginTop:12,fontWeight:500}}>
              ⚡ Evergreen — resets each time email opens</div>}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",position:"relative",zIndex:1}}>
            {[
              {l:"Mode",     v:mode==="evergreen"?"Evergreen ♻":mode==="countup"?"Count Up ↑":"Countdown ↓"},
              {l:"Timezone", v:timezone.split("/").pop()},
              {l:"Language", v:language},
            ].map(s=>(
              <div key={s.l} style={{background:"white",border:`1px solid ${P.border}`,
                borderRadius:9,padding:"7px 14px",textAlign:"center",
                boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                <div style={{color:P.faint,fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600}}>{s.l}</div>
                <div style={{color:P.mid,fontSize:12,fontFamily:"monospace",marginTop:2,fontWeight:600}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar" style={{width:410,display:"flex",flexDirection:"column",
          background:P.panel,borderLeft:`1px solid ${P.border}`,overflow:"hidden",flexShrink:0}}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:"#f8fafc",flexShrink:0}}>
            {["timer","design","email","embed","share"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                flex:1,padding:"12px 2px",border:"none",cursor:"pointer",
                background:tab===t?P.panel:"transparent",
                color:tab===t?P.accent:P.muted,
                fontSize:10,fontWeight:tab===t?700:500,
                borderBottom:tab===t?`2px solid ${P.accent}`:"2px solid transparent",
                transition:"all .15s",textTransform:"capitalize",letterSpacing:"0.03em"}}>
                {{"timer":"⏱ Timer","design":"🎨 Design","email":"📧 Email","embed":"🌐 Embed","share":"🔗 Share"}[t]}
              </button>
            ))}
          </div>

          {/* Scrollable panel */}
          <div style={{flex:1,overflowY:"auto",padding:18}}>

            {/* ══ TIMER ═══════════════════════════════════════════════════ */}
            {tab==="timer"&&<div>
              <Field label="Event Title">
                <input value={cfg.title} onChange={e=>sc("title",e.target.value)} style={INP} placeholder="OFFER ENDS IN"/>
              </Field>
              <Field label="Target Date & Time">
                <input type="datetime-local" value={target} onChange={e=>setTarget(e.target.value)}
                  style={{...INP,opacity:mode==="evergreen"?.4:1}} disabled={mode==="evergreen"}/>
              </Field>
              <Field label="Timezone">
                <select value={timezone} onChange={e=>setTimezone(e.target.value)} style={INP}>
                  {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>
              <Card>
                <Lbl>Timer Mode</Lbl>
                <Chip active={mode==="countdown"} onClick={()=>setMode("countdown")} icon="⏱" title="Countdown"  desc="Count down to a specific date"/>
                <Chip active={mode==="countup"}   onClick={()=>setMode("countup")}   icon="⬆" title="Count Up"   desc="Count up from a date"/>
                <Chip active={mode==="evergreen"} onClick={()=>setMode("evergreen")} icon="♻" title="Evergreen"  desc="Starts fresh each time email opens"/>
              </Card>
              {mode==="evergreen"&&<Card>
                <Lbl>Duration: {egHours}h ({Math.floor(egHours/24)}d {egHours%24}h)</Lbl>
                <input type="range" min={1} max={168} value={egHours} onChange={e=>setEgHours(+e.target.value)}/>
                <div style={{display:"flex",justifyContent:"space-between",color:P.faint,fontSize:10,marginTop:4}}><span>1h</span><span>1 week</span></div>
              </Card>}
              <Card>
                <Lbl>Show Units</Lbl>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["showDays","Days"],["showHours","Hours"],["showMinutes","Minutes"],["showSeconds","Seconds"]].map(([k,l])=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                      padding:"9px 11px",background:"white",border:`1px solid ${P.border}`,borderRadius:7}}>
                      <input type="checkbox" checked={cfg[k]} onChange={e=>sc(k,e.target.checked)}
                        style={{accentColor:P.accent,width:15,height:15,cursor:"pointer"}}/>
                      <span style={{color:P.mid,fontSize:12,fontWeight:500}}>{l}</span>
                    </label>
                  ))}
                </div>
              </Card>
              <Field label="Language">
                <select value={language} onChange={e=>setLanguage(e.target.value)} style={INP}>
                  {LANGUAGES.map(l=><option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
            </div>}

            {/* ══ DESIGN ══════════════════════════════════════════════════ */}
            {tab==="design"&&<div>
              <Lbl>Templates</Lbl>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                {TEMPLATES.map(t=>(
                  <div key={t.name} onClick={()=>setCfg(c=>({...c,bg:t.bg,box:t.box,text:t.text,accent:t.accent}))}
                    style={{padding:"10px 8px",borderRadius:9,cursor:"pointer",background:t.bg,
                      border:`2px solid ${t.accent}55`,textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}>
                    <div style={{color:t.text,fontSize:10,fontWeight:700,marginBottom:5}}>{t.name}</div>
                    <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                      {[t.bg,t.box,t.text,t.accent].map((c,i)=>(
                        <div key={i} style={{width:9,height:9,borderRadius:"50%",background:c,border:"1px solid rgba(0,0,0,.2)"}}/>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Card>
                <Lbl>Colors</Lbl>
                {[["bg","Background"],["box","Number Box"],["text","Text"],["accent","Accent"]].map(([k,l])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <input type="color" value={cfg[k]} onChange={e=>sc(k,e.target.value)}
                      style={{width:36,height:36,border:`1px solid ${P.border}`,borderRadius:7,padding:2,flexShrink:0}}/>
                    <span style={{color:P.mid,fontSize:12,fontWeight:500,flex:1}}>{l}</span>
                    <code style={{color:P.muted,fontSize:10,background:"#f8fafc",padding:"2px 7px",
                      borderRadius:4,border:`1px solid ${P.border}`,fontFamily:"monospace"}}>{cfg[k]}</code>
                  </div>
                ))}
              </Card>
              <Field label="Font">
                <select value={cfg.font} onChange={e=>sc("font",e.target.value)}
                  style={{...INP,fontFamily:`'${cfg.font}',monospace`}}>
                  {FONTS.map(f=><option key={f} value={f} style={{fontFamily:f}}>{f}</option>)}
                </select>
              </Field>
              <Field label={`Font Size: ${cfg.fontSize}px`} mb={14}>
                <input type="range" min={18} max={48} value={cfg.fontSize} onChange={e=>sc("fontSize",+e.target.value)}/>
              </Field>
              <Field label={`Corner Radius: ${cfg.borderRadius}px`} mb={14}>
                <input type="range" min={0} max={32} value={cfg.borderRadius} onChange={e=>sc("borderRadius",+e.target.value)}/>
              </Field>
              <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",
                padding:"10px 13px",background:P.card,border:`1px solid ${P.border}`,borderRadius:8,marginBottom:14}}>
                <input type="checkbox" checked={cfg.transparent} onChange={e=>sc("transparent",e.target.checked)}
                  style={{accentColor:P.accent,width:15,height:15,cursor:"pointer"}}/>
                <span style={{color:P.mid,fontSize:12,fontWeight:500}}>Transparent Background</span>
              </label>
            </div>}

            {/* ══ EMAIL ════════════════════════════════════════════════════ */}
            {tab==="email"&&<div>
              <InfoBox color={P.accent} bg={P.accentBg} border={P.accentBdr} title="📧 Email Countdown GIF">
                The server generates a fresh animated GIF on every request — exactly how mailtimers.com and emailcountdowntimer.com work.
                Just paste the <code style={{background:P.accentBdr,padding:"1px 4px",borderRadius:3}}>&lt;img&gt;</code> tag into your email template.
              </InfoBox>

              {/* Live GIF preview from server */}
              {serverOnline&&<Card>
                <Lbl>Live GIF Preview (from server)</Lbl>
                <div style={{background:"#111",borderRadius:8,padding:12,textAlign:"center",marginBottom:10}}>
                  <img key={params} src={gifUrl} alt="Timer GIF"
                    style={{maxWidth:"100%",borderRadius:6,display:"block",margin:"0 auto"}}/>
                </div>
                <div style={{color:P.muted,fontSize:11,textAlign:"center"}}>
                  This GIF is re-generated fresh on every request ↑
                </div>
              </Card>}

              {/* The actual output tag — copy and paste into email */}
              <CodeBox code={imgTag} cid="img-tag" copied={copied} copy={copy} label="📋 Paste into Email (img tag)"/>

              <CodeBox code={emailBlock} cid="email-block" copied={copied} copy={copy} label="Full Email HTML Block"/>

              <InfoBox color={P.amber} bg={P.amberBg} border={P.amberBdr} title="🍎 Apple Mail MPP Note">
                Apple Mail pre-fetches images which can freeze the timer. The HTML block above includes an MSO conditional fallback for Outlook/Apple Mail.
              </InfoBox>

              <Card>
                <Lbl>✅ Works In</Lbl>
                {["Gmail","Outlook 2007–365","Apple Mail","Yahoo Mail","Mailchimp","Klaviyo","SendGrid","HubSpot","ActiveCampaign"].map(c=>(
                  <div key={c} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:P.green,flexShrink:0}}/>
                    <span style={{color:P.mid,fontSize:12,fontWeight:500}}>{c}</span>
                  </div>
                ))}
              </Card>
            </div>}

            {/* ══ EMBED ════════════════════════════════════════════════════ */}
            {tab==="embed"&&<div>
              <InfoBox color={P.blue} bg={P.blueBg} border={P.blueBdr} title="🌐 Website iFrame Embed">
                The server serves a self-contained HTML page with a live JS timer. Drop the iframe anywhere on your site.
              </InfoBox>

              {/* Live iframe from server */}
              {serverOnline&&<Card>
                <Lbl>Live Embed Preview</Lbl>
                <div style={{border:`1px solid ${P.border}`,borderRadius:8,overflow:"hidden",background:cfg.bg,height:130}}>
                  <iframe key={params} src={embedUrl}
                    style={{width:"100%",height:"100%",border:"none",display:"block"}}
                    title="Timer Embed"/>
                </div>
              </Card>}

              {/* The actual output tag */}
              <CodeBox code={iframeTag} cid="iframe-tag" copied={copied} copy={copy} label="📋 Paste into Website (iframe tag)"/>

              <Card>
                <Lbl>Direct embed URL</Lbl>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input readOnly value={embedUrl}
                    style={{...INP,fontSize:10,color:P.muted,background:"#f8fafc",flex:1}}/>
                  <button onClick={()=>copy(embedUrl,"embed-url")} style={{
                    background:copied==="embed-url"?P.green:P.accent,color:"#fff",border:"none",
                    borderRadius:6,padding:"8px 12px",fontSize:11,cursor:"pointer",fontWeight:700,
                    whiteSpace:"nowrap",flexShrink:0}}>
                    {copied==="embed-url"?"✓ Copied":"Copy"}
                  </button>
                </div>
              </Card>

              <Card>
                <Lbl>Features</Lbl>
                {["Live JS countdown — updates every second","Fully responsive","Custom fonts & colors","Timezone-aware","Works on any website or CMS","No external dependencies in embed"].map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:P.accent,flexShrink:0}}/>
                    <span style={{color:P.mid,fontSize:12,fontWeight:500}}>{f}</span>
                  </div>
                ))}
              </Card>
            </div>}

            {/* ══ SHARE ════════════════════════════════════════════════════ */}
            {tab==="share"&&<div>
              <Lbl>Share Link</Lbl>
              <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"stretch"}}>
                <input value={shareLink} readOnly
                  style={{...INP,flex:1,fontSize:10,color:P.muted,background:"#f8fafc"}}/>
                <button onClick={()=>copy(shareLink,"share-link")} style={{
                  background:copied==="share-link"?P.green:P.accent,color:"#fff",border:"none",
                  borderRadius:7,padding:"8px 14px",fontSize:11,cursor:"pointer",
                  fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                  {copied==="share-link"?"✓ Copied":"Copy"}
                </button>
              </div>

              <Lbl>QR Code</Lbl>
              <div style={{background:"white",border:`1px solid ${P.border}`,borderRadius:10,
                padding:20,textAlign:"center",marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
                <img src={qrUrl} alt="QR" width={160} height={160}
                  style={{borderRadius:8,display:"block",margin:"0 auto"}}/>
                <div style={{color:P.muted,fontSize:11,marginTop:10,fontWeight:500}}>Scan to open countdown</div>
              </div>

              <Lbl>Share to Social</Lbl>
              {[
                {name:"Twitter / X",color:"#1da1f2",url:`https://twitter.com/intent/tweet?text=${encodeURIComponent("⏱ "+cfg.title+" "+shareLink)}`},
                {name:"Facebook",   color:"#1877f2",url:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`},
                {name:"WhatsApp",   color:"#25d366",url:`https://wa.me/?text=${encodeURIComponent("⏱ "+cfg.title+" "+shareLink)}`},
                {name:"LinkedIn",   color:"#0a66c2",url:`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`},
              ].map(s=>(
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                    background:"white",border:`1.5px solid ${P.border}`,
                    borderRadius:8,marginBottom:8,textDecoration:"none",
                    color:s.color,fontSize:12,fontWeight:600,
                    boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                  Share on {s.name} ↗
                </a>
              ))}

              <Card style={{marginTop:8}}>
                <Lbl>Timer Summary</Lbl>
                {[
                  ["Target",   new Date(target).toLocaleString()],
                  ["Timezone", timezone],
                  ["Mode",     mode==="evergreen"?"Evergreen":mode==="countup"?"Count Up":"Countdown"],
                  ["Language", language],
                  ["Font",     cfg.font],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{color:P.muted,fontSize:11,fontWeight:500}}>{k}</span>
                    <span style={{color:P.mid,fontFamily:"monospace",fontSize:11,fontWeight:600,
                      background:"#f8fafc",padding:"2px 8px",borderRadius:5,border:`1px solid ${P.border}`}}>{v}</span>
                  </div>
                ))}
              </Card>
            </div>}

          </div>
        </div>
      </div>
    </div>
  );
}
