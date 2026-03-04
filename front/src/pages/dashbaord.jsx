import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const API =  "https://timer-server-moyt.onrender.com";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});

async function apiFetch(url, options = {}) {
  let res = await fetch(url, { ...options, headers: authHeaders() });
  if (res.status === 401) {
    const refresh = await fetch(`${API}/api/auth/refresh`, {
      method: "POST", credentials: "include",
    });
    if (refresh.ok) {
      const { accessToken } = await refresh.json();
      localStorage.setItem("accessToken", accessToken);
      res = await fetch(url, { ...options, headers: authHeaders() });
    } else {
      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    }
  }
  return res;
}

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
  red:"#dc2626", redBg:"#fef2f2", redBdr:"#fecaca",
  purple:"#7c3aed", purpleBg:"#f5f3ff", purpleBdr:"#ddd6fe",
};

const FONTS     = ["Orbitron","Space Mono","Oswald","Bebas Neue","Rajdhani","Share Tech Mono","DM Serif Display","Playfair Display"];
const TEMPLATES = [
  {name:"Dark Pro",bg:"#0f0f1a",box:"#1e1b4b",text:"#e0e7ff",accent:"#818cf8"},
  {name:"Fire",    bg:"#1c0a00",box:"#7f1d1d",text:"#fef2f2",accent:"#f97316"},
  {name:"Ocean",   bg:"#0c1a2e",box:"#0c4a6e",text:"#e0f2fe",accent:"#38bdf8"},
  {name:"Forest",  bg:"#052e16",box:"#14532d",text:"#dcfce7",accent:"#4ade80"},
  {name:"Gold",    bg:"#1c1400",box:"#451a03",text:"#fef9c3",accent:"#facc15"},
  {name:"Rose",    bg:"#1a000f",box:"#4c0519",text:"#ffe4e6",accent:"#fb7185"},
];
const TIMEZONES = ["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai","Asia/Karachi","Asia/Kolkata","Asia/Tokyo","Asia/Shanghai","Australia/Sydney","Pacific/Auckland"];

/* ── helpers ── */
function pad(n){return String(Math.max(0,Math.floor(n))).padStart(2,"0");}
function calcTime(target,mode,countUp,egHours){
  if(mode==="evergreen"){const h=egHours;return{days:Math.floor(h/24),hours:h%24,minutes:0,seconds:0,done:false};}
  let diff=new Date(target)-new Date();
  if(countUp)diff=-diff;
  if(diff<0)diff=0;
  return{days:Math.floor(diff/86400000),hours:Math.floor((diff%86400000)/3600000),minutes:Math.floor((diff%3600000)/60000),seconds:Math.floor((diff%60000)/1000),done:diff===0};
}
function buildParams(cfg,target,mode,egHours){
  return new URLSearchParams({
    target,mode,egHours,
    bg:cfg.bg.replace("#",""),box:cfg.box.replace("#",""),
    text:cfg.text.replace("#",""),accent:cfg.accent.replace("#",""),
    title:cfg.title,fontSize:cfg.fontSize,borderRadius:cfg.borderRadius,
    transparent:cfg.transparent?"1":"0",
    days:cfg.showDays?"1":"0",hours:cfg.showHours?"1":"0",
    minutes:cfg.showMinutes?"1":"0",seconds:cfg.showSeconds?"1":"0",
  }).toString();
}

const DEFAULT_CFG={
  bg:"#0f0f1a",box:"#1e1b4b",text:"#e0e7ff",accent:"#818cf8",
  font:"Orbitron",title:"OFFER ENDS IN",
  showDays:true,showHours:true,showMinutes:true,showSeconds:true,
  transparent:false,borderRadius:12,fontSize:36,
};
function defaultTarget(){
  const d=new Date();d.setDate(d.getDate()+7);
  return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

/* ── TimerFace ── */
const TimerFace=memo(function({time,cfg,scale=1}){
  const units=[
    cfg.showDays    &&{lbl:"DAYS",val:pad(time.days)},
    cfg.showHours   &&{lbl:"HRS", val:pad(time.hours)},
    cfg.showMinutes &&{lbl:"MIN", val:pad(time.minutes)},
    cfg.showSeconds &&{lbl:"SEC", val:pad(time.seconds)},
  ].filter(Boolean);
  const fs=(cfg.fontSize||36)*scale;
  return(
    <div style={{background:cfg.transparent?"transparent":cfg.bg,
      padding:`${20*scale}px ${24*scale}px`,
      borderRadius:`${(cfg.borderRadius||12)*scale}px`,
      fontFamily:`'${cfg.font||"Orbitron"}',monospace`,
      display:"inline-flex",flexDirection:"column",alignItems:"center",gap:`${10*scale}px`,
      border:`${2*scale}px solid ${cfg.accent}44`,
      boxShadow:`0 ${4*scale}px ${20*scale}px ${cfg.accent}18`}}>
      {cfg.title&&<div style={{color:cfg.text,fontSize:`${11*scale}px`,letterSpacing:"0.18em",
        textTransform:"uppercase",fontWeight:700,opacity:.9}}>{cfg.title}</div>}
      {time.done
        ?<div style={{color:cfg.accent,fontSize:`${20*scale}px`,fontWeight:700}}>EXPIRED</div>
        :<div style={{display:"flex",gap:`${10*scale}px`,alignItems:"flex-start"}}>
          {units.map(({lbl,val},i)=>(
            <div key={lbl} style={{display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{background:cfg.box,color:cfg.text,fontSize:`${fs}px`,fontWeight:700,
                  padding:`${10*scale}px ${16*scale}px`,borderRadius:`${7*scale}px`,lineHeight:1,
                  minWidth:`${52*scale}px`,textAlign:"center",border:`1px solid ${cfg.accent}30`,
                  boxShadow:`0 ${2*scale}px ${8*scale}px rgba(0,0,0,.25)`}}>{val}</div>
                <div style={{color:cfg.text,fontSize:`${9*scale}px`,opacity:.55,
                  marginTop:`${4*scale}px`,letterSpacing:"0.14em"}}>{lbl}</div>
              </div>
              {i<units.length-1&&<div style={{color:cfg.accent,fontSize:`${fs*.8}px`,
                fontWeight:700,margin:`0 ${3*scale}px`,paddingBottom:`${12*scale}px`,opacity:.65}}>:</div>}
            </div>
          ))}
        </div>}
    </div>
  );
});

function LiveClock({target,mode,countUp,egHours,cfg}){
  const[time,setTime]=useState(()=>calcTime(target,mode,countUp,egHours));
  useEffect(()=>{
    setTime(calcTime(target,mode,countUp,egHours));
    if(mode==="evergreen")return;
    const id=setInterval(()=>setTime(calcTime(target,mode,countUp,egHours)),1000);
    return()=>clearInterval(id);
  },[target,mode,countUp,egHours]);
  return <TimerFace time={time} cfg={cfg} scale={1}/>;
}

/* ── UI atoms ── */
const INP={background:"#fff",color:P.text,border:`1px solid ${P.borderDark}`,borderRadius:7,
  padding:"8px 11px",fontSize:13,width:"100%",fontFamily:"inherit",boxSizing:"border-box"};
function Lbl({children}){return<div style={{color:P.muted,fontSize:11,fontWeight:600,
  letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>{children}</div>;}
function Field({label,mb=16,children}){return<div style={{marginBottom:mb}}>
  {label&&<Lbl>{label}</Lbl>}{children}</div>;}
function Card({children,style={}}){return<div style={{background:P.card,border:`1px solid ${P.border}`,
  borderRadius:10,padding:14,marginBottom:14,...style}}>{children}</div>;}
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

/* ── Name Modal ── */
function NameModal({title,description,initialValue="",confirmLabel="Save",onConfirm,onClose}){
  const[name,setName]=useState(initialValue);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:360,
        boxShadow:"0 8px 40px rgba(0,0,0,.2)"}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:4,color:P.text}}>{title}</div>
        <div style={{color:P.muted,fontSize:12,marginBottom:18,lineHeight:1.5}}>{description}</div>
        <input autoFocus value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&name.trim()&&onConfirm(name.trim())}
          placeholder="e.g. Black Friday Sale"
          style={{...INP,marginBottom:20,fontSize:14}}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,
            border:`1px solid ${P.border}`,background:"white",color:P.mid,
            fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Cancel
          </button>
          <button onClick={()=>name.trim()&&onConfirm(name.trim())} disabled={!name.trim()}
            style={{padding:"9px 20px",borderRadius:8,border:"none",background:P.accent,
              color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",
              opacity:name.trim()?1:.45}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm Modal ── */
function DeleteModal({timerName,onConfirm,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:14,padding:28,width:340,
        boxShadow:"0 8px 40px rgba(0,0,0,.2)"}}>
        <div style={{fontSize:32,textAlign:"center",marginBottom:10}}>🗑️</div>
        <div style={{fontWeight:700,fontSize:15,textAlign:"center",color:P.text,marginBottom:6}}>Delete Timer?</div>
        <div style={{color:P.muted,fontSize:12,textAlign:"center",marginBottom:22,lineHeight:1.6}}>
          <strong style={{color:P.text}}>"{timerName}"</strong> will be permanently deleted.
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:8,
            border:`1px solid ${P.border}`,background:"white",color:P.mid,
            fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{flex:1,padding:"10px",borderRadius:8,
            border:"none",background:P.red,color:"#fff",
            fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared top header ── */
function Header({user,serverOnline,onLogout,children}){
  return(
    <div style={{background:P.panel,borderBottom:`1px solid ${P.border}`,
      padding:"10px 20px",display:"flex",alignItems:"center",gap:12,
      flexShrink:0,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
      <div style={{width:32,height:32,borderRadius:8,fontSize:16,
        background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>⏳</div>
      <div>
        <div style={{fontWeight:700,fontSize:14}}>CountTimer Pro</div>
        <div style={{fontSize:10,color:P.faint}}>All-in-one countdown generator</div>
      </div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {children}
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,
          background:serverOnline===true?P.greenBg:serverOnline===false?P.redBg:P.card,
          border:`1px solid ${serverOnline===true?P.greenBdr:serverOnline===false?P.redBdr:P.border}`,
          fontSize:10,fontWeight:600,
          color:serverOnline===true?P.green:serverOnline===false?P.red:P.muted}}>
          <div style={{width:6,height:6,borderRadius:"50%",
            background:serverOnline===true?"#22c55e":serverOnline===false?"#ef4444":"#94a3b8"}}/>
          {serverOnline===true?"Online":serverOnline===false?"Offline":"…"}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"4px 10px",
          background:P.card,border:`1px solid ${P.border}`,borderRadius:20}}>
          <div style={{width:22,height:22,borderRadius:"50%",
            background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
            display:"flex",alignItems:"center",justifyContent:"center",
            color:"#fff",fontSize:10,fontWeight:700,flexShrink:0}}>
            {user?.email?.[0]?.toUpperCase()??"U"}
          </div>
          <span style={{fontSize:11,color:P.mid,fontWeight:600,maxWidth:130,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email}</span>
        </div>
        <button onClick={onLogout} style={{background:P.redBg,border:`1px solid ${P.redBdr}`,
          color:P.red,borderRadius:8,padding:"7px 13px",fontSize:11,fontWeight:700,
          cursor:"pointer",fontFamily:"inherit"}}>
          Logout
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   HOME SCREEN  — timer grid
══════════════════════════════════════════════ */
function HomeScreen({user,serverOnline,timers,loading,onNew,onEdit,onDelete,onLogout}){
  const[deleteModal,setDeleteModal]=useState(null);

  return(
    <div style={{minHeight:"100vh",background:P.bg,display:"flex",flexDirection:"column",fontFamily:"system-ui,'Segoe UI',sans-serif"}}>
      <Header user={user} serverOnline={serverOnline} onLogout={onLogout}>
        <button onClick={onNew}
          style={{background:P.accent,color:"#fff",border:"none",borderRadius:8,
            padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          + New Timer
        </button>
      </Header>

      <div style={{flex:1,padding:"32px 28px",maxWidth:1100,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>

        {/* welcome row */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:22,fontWeight:700,color:P.text,marginBottom:4}}>
            My Timers
          </div>
          <div style={{fontSize:13,color:P.muted}}>
            {timers.length===0
              ?"Create your first countdown timer to get started."
              :`You have ${timers.length} saved timer${timers.length!==1?"s":""}.`}
          </div>
        </div>

        {loading&&(
          <div style={{textAlign:"center",padding:"60px 0",color:P.faint,fontSize:14}}>
            Loading timers…
          </div>
        )}

        {!loading&&timers.length===0&&(
          <div style={{textAlign:"center",padding:"72px 20px"}}>
            <div style={{fontSize:52,marginBottom:16}}>⏳</div>
            <div style={{fontSize:18,fontWeight:700,color:P.mid,marginBottom:8}}>No timers yet</div>
            <div style={{fontSize:13,color:P.muted,marginBottom:24}}>
              Create a countdown for your next sale, launch, or event.
            </div>
            <button onClick={onNew}
              style={{background:P.accent,color:"#fff",border:"none",borderRadius:10,
                padding:"12px 28px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              + Create First Timer
            </button>
          </div>
        )}

        {/* timer grid */}
        {!loading&&timers.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:18}}>

            {/* Add new card */}
            <div onClick={onNew} style={{border:`2px dashed ${P.accentBdr}`,borderRadius:14,
              padding:"28px 20px",display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:10,cursor:"pointer",background:P.accentBg,
              transition:"all .15s",minHeight:160}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=P.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=P.accentBdr}>
              <div style={{width:40,height:40,borderRadius:"50%",background:P.accent,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontSize:22,fontWeight:300}}>+</div>
              <div style={{color:P.accent,fontWeight:700,fontSize:13}}>New Timer</div>
            </div>

            {timers.map(timer=>(
              <TimerGridCard key={timer.id} timer={timer}
                onEdit={()=>onEdit(timer)}
                onDelete={()=>setDeleteModal(timer)}/>
            ))}
          </div>
        )}
      </div>

      {deleteModal&&<DeleteModal
        timerName={deleteModal.name}
        onConfirm={()=>{onDelete(deleteModal);setDeleteModal(null);}}
        onClose={()=>setDeleteModal(null)}/>}
    </div>
  );
}

/* ── Timer grid card ── */
function TimerGridCard({timer,onEdit,onDelete}){
  const modeLabel={countdown:"Countdown",countup:"Count Up",evergreen:"Evergreen"}[timer.mode]||"Countdown";
  const modeIcon ={countdown:"⏱",countup:"⬆",evergreen:"♻"}[timer.mode]||"⏱";
  const accent   = timer.cfg?.accent||"#818cf8";
  const bg       = timer.cfg?.bg||"#0f0f1a";

  return(
    <div style={{background:P.panel,border:`1px solid ${P.border}`,borderRadius:14,
      overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)",
      display:"flex",flexDirection:"column",transition:"box-shadow .15s"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.10)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)"}>

      {/* color strip */}
      <div style={{background:bg,padding:"18px 16px",display:"flex",
        alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:5}}>
          {[timer.cfg?.bg,timer.cfg?.box,timer.cfg?.text,timer.cfg?.accent].map((c,i)=>(
            <div key={i} style={{width:10,height:10,borderRadius:"50%",
              background:c||"#888",border:"1px solid rgba(255,255,255,.25)"}}/>
          ))}
        </div>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:20,
          padding:"3px 10px",fontSize:10,fontWeight:700,color:"#fff",
          display:"flex",alignItems:"center",gap:4}}>
          {modeIcon} {modeLabel}
        </div>
      </div>

      {/* content */}
      <div style={{padding:"14px 16px",flex:1}}>
        <div style={{fontWeight:700,fontSize:14,color:P.text,marginBottom:4,
          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {timer.name}
        </div>
        <div style={{fontSize:11,color:P.muted}}>
          {timer.cfg?.title&&<span style={{marginRight:8,color:P.faint}}>"{timer.cfg.title}"</span>}
          {timer.mode==="evergreen"
            ?`Resets every ${timer.egHours}h`
            :new Date(timer.target).toLocaleDateString(undefined,{
                month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}
        </div>
      </div>

      {/* actions */}
      <div style={{padding:"10px 14px",borderTop:`1px solid ${P.border}`,
        display:"flex",gap:8}}>
        <button onClick={onEdit}
          style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${P.accentBdr}`,
            background:P.accentBg,color:P.accent,fontWeight:700,fontSize:12,
            cursor:"pointer",fontFamily:"inherit"}}>
          ✏️ Edit
        </button>
        <button onClick={onDelete}
          style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${P.redBdr}`,
            background:P.redBg,color:P.red,fontWeight:700,fontSize:12,
            cursor:"pointer",fontFamily:"inherit"}}>
          🗑️
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   EDITOR SCREEN
══════════════════════════════════════════════ */
function EditorScreen({user,serverOnline,initialTimer,onSaved,onBack,onLogout}){
  const isNew=!initialTimer;

  const[tab,setTab]=useState("timer");
  const[target,setTarget]=useState(initialTimer?.target||defaultTarget());
  const[timezone,setTimezone]=useState(initialTimer?.timezone||"UTC");
  const[mode,setMode]=useState(initialTimer?.mode||"countdown");
  const[egHours,setEgHours]=useState(initialTimer?.egHours||48);
  const[cfg,setCfg]=useState(initialTimer?{...DEFAULT_CFG,...initialTimer.cfg}:DEFAULT_CFG);

  const[saveStatus,setSaveStatus]=useState(""); // "saving"|"saved"|"error"
  const[saveModal,setSaveModal]=useState(false);
  const[copied,setCopied]=useState("");

  const sc=useCallback((k,v)=>setCfg(c=>({...c,[k]:v})),[]);
  const countUp=mode==="countup";
  const params=buildParams(cfg,target,mode,egHours);
  const copy=useCallback((text,id)=>{
    navigator.clipboard.writeText(text).catch(()=>{});
    setCopied(id);setTimeout(()=>setCopied(""),2200);
  },[]);

  const currentPayload=(name)=>({name,target,mode,egHours,timezone,cfg});

  const flashStatus=(ok,savedObj)=>{
    setSaveStatus(ok?"saved":"error");
    setTimeout(()=>{setSaveStatus("");if(ok&&savedObj)onSaved(savedObj);},1200);
  };

  const handleSaveNew=async(name)=>{
    setSaveModal(false);setSaveStatus("saving");
    try{
      const res=await apiFetch(`${API}/api/timers`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(currentPayload(name)),
      });
      if(!res.ok)throw new Error();
      flashStatus(true,await res.json());
    }catch{flashStatus(false);}
  };

  const handleUpdate=async()=>{
    if(!initialTimer)return;
    setSaveStatus("saving");
    try{
      const res=await apiFetch(`${API}/api/timers/${initialTimer.id}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(currentPayload(initialTimer.name)),
      });
      if(!res.ok)throw new Error();
      flashStatus(true,await res.json());
    }catch{flashStatus(false);}
  };

  const gifUrl   =`${API}/api/timer/gif?${params}`;
  const embedUrl =`${API}/api/timer/embed?${params}`;
  const imgTag   =`<img src="${gifUrl}"\n  style="display:inline-block;line-height:0;width:100%;max-width:380px"\n  alt="${cfg.title||"Countdown Timer"}">`;
  const iframeTag=`<iframe src="${embedUrl}"\n  width="420" height="130"\n  frameborder="0" scrolling="no"\n  style="border:none;overflow:hidden;display:block">\n</iframe>`;
  const emailBlock=`<!-- ${cfg.title||"Countdown Timer"} -->\n<table cellpadding="0" cellspacing="0" border="0" align="center" width="100%">\n  <tr><td align="center" bgcolor="${cfg.bg}" style="padding:24px;border-radius:${cfg.borderRadius}px;">\n      <img src="${gifUrl}" style="display:inline-block;line-height:0;width:100%;max-width:380px" alt="${cfg.title||"Countdown Timer"}">\n  </td></tr>\n</table>`;
  const shareLink=`${window.location.origin}/dashboard?${params}`;
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareLink)}&bgcolor=ffffff&color=${P.accent.replace("#","")}&qzone=2`;

  const saveBtnLabel=saveStatus==="saving"?"Saving…":saveStatus==="saved"?"✓ Saved!":saveStatus==="error"?"✗ Error":(isNew?"Save Timer":"Save Changes");
  const saveBtnBg=saveStatus==="saved"?P.green:saveStatus==="error"?P.red:P.accent;

  return(
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,
      fontFamily:"system-ui,'Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        input[type=range]{accent-color:${P.accent};width:100%;cursor:pointer;}
        input[type=color]{cursor:pointer;}
        select,input,button,textarea{font-family:inherit;}
        input:focus,select:focus{outline:2px solid ${P.accent};outline-offset:1px;border-radius:7px;}
        @media(max-width:800px){
          .editor-body{flex-direction:column!important;}
          .editor-preview{border-right:none!important;border-bottom:1px solid ${P.border}!important;min-height:220px!important;}
          .editor-sidebar{width:100%!important;}
        }
      `}</style>

      <Header user={user} serverOnline={serverOnline} onLogout={onLogout}>
        {/* back */}
        <button onClick={onBack}
          style={{background:"white",color:P.mid,border:`1px solid ${P.border}`,
            borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,
            cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
          ← My Timers
        </button>

        {/* context label */}
        <div style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:700,
          background:isNew?P.purpleBg:P.amberBg,
          border:`1px solid ${isNew?P.purpleBdr:P.amberBdr}`,
          color:isNew?P.purple:P.amber}}>
          {isNew?"✨ New Timer":"✏️ Editing: "+initialTimer.name}
        </div>

        {/* save */}
        <button onClick={isNew?()=>setSaveModal(true):handleUpdate}
          disabled={saveStatus==="saving"}
          style={{background:saveBtnBg,color:"#fff",border:"none",borderRadius:8,
            padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",
            fontFamily:"inherit",minWidth:120,transition:"background .2s"}}>
          {saveBtnLabel}
        </button>
      </Header>

      {/* 2-column editor */}
      <div className="editor-body" style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

        {/* Preview */}
        <div className="editor-preview" style={{flex:1,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:20,padding:32,overflowY:"auto",
          background:"linear-gradient(135deg,#eef2ff 0%,#f1f5f9 50%,#eff6ff 100%)",
          borderRight:`1px solid ${P.border}`,position:"relative"}}>
          <div style={{position:"absolute",inset:0,opacity:.25,pointerEvents:"none",
            backgroundImage:"radial-gradient(circle,#c7d2fe 1px,transparent 1px)",
            backgroundSize:"28px 28px"}}/>
          <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
            <div style={{color:P.faint,fontSize:10,letterSpacing:"0.25em",
              textTransform:"uppercase",fontWeight:600,marginBottom:18}}>LIVE PREVIEW</div>
            <div style={{background:"white",borderRadius:16,padding:24,display:"inline-block",
              boxShadow:"0 4px 24px rgba(79,70,229,.13)"}}>
              <LiveClock target={target} mode={mode} countUp={countUp} egHours={egHours} cfg={cfg}/>
            </div>
            {mode==="evergreen"&&<div style={{color:P.accent,fontSize:11,marginTop:12,fontWeight:500}}>
              ⚡ Evergreen — resets each time email opens</div>}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",position:"relative",zIndex:1}}>
            {[
              {l:"Mode",v:mode==="evergreen"?"Evergreen ♻":mode==="countup"?"Count Up ↑":"Countdown ↓"},
              {l:"Timezone",v:timezone.split("/").pop()},
            ].map(s=>(
              <div key={s.l} style={{background:"white",border:`1px solid ${P.border}`,
                borderRadius:9,padding:"7px 14px",textAlign:"center",
                boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
                <div style={{color:P.faint,fontSize:9,textTransform:"uppercase",
                  letterSpacing:"0.1em",fontWeight:600}}>{s.l}</div>
                <div style={{color:P.mid,fontSize:12,fontFamily:"monospace",
                  marginTop:2,fontWeight:600}}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings panel */}
        <div className="editor-sidebar" style={{width:410,display:"flex",flexDirection:"column",
          background:P.panel,borderLeft:`1px solid ${P.border}`,overflow:"hidden",flexShrink:0}}>

          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,
            background:"#f8fafc",flexShrink:0}}>
            {["timer","design","email","embed","share"].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                flex:1,padding:"11px 2px",border:"none",cursor:"pointer",
                background:tab===t?P.panel:"transparent",
                color:tab===t?P.accent:P.muted,fontSize:10,
                fontWeight:tab===t?700:500,
                borderBottom:tab===t?`2px solid ${P.accent}`:"2px solid transparent",
                transition:"all .15s",textTransform:"capitalize",letterSpacing:"0.03em"}}>
                {{"timer":"⏱ Timer","design":"🎨 Design","email":"📧 Email","embed":"🌐 Embed","share":"🔗 Share"}[t]}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflowY:"auto",padding:18}}>

            {tab==="timer"&&<div>
              <Field label="Event Title">
                <input value={cfg.title} onChange={e=>sc("title",e.target.value)}
                  style={INP} placeholder="OFFER ENDS IN"/>
              </Field>
              <Field label="Target Date & Time">
                <input type="datetime-local" value={target}
                  onChange={e=>setTarget(e.target.value)}
                  style={{...INP,opacity:mode==="evergreen"?.4:1}}
                  disabled={mode==="evergreen"}/>
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
                <input type="range" min={1} max={168} value={egHours}
                  onChange={e=>setEgHours(+e.target.value)}/>
                <div style={{display:"flex",justifyContent:"space-between",
                  color:P.faint,fontSize:10,marginTop:4}}>
                  <span>1h</span><span>1 week</span>
                </div>
              </Card>}
              <Card>
                <Lbl>Show Units</Lbl>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["showDays","Days"],["showHours","Hours"],["showMinutes","Minutes"],["showSeconds","Seconds"]].map(([k,l])=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
                      padding:"9px 11px",background:"white",
                      border:`1px solid ${P.border}`,borderRadius:7}}>
                      <input type="checkbox" checked={cfg[k]}
                        onChange={e=>sc(k,e.target.checked)}
                        style={{accentColor:P.accent,width:15,height:15,cursor:"pointer"}}/>
                      <span style={{color:P.mid,fontSize:12,fontWeight:500}}>{l}</span>
                    </label>
                  ))}
                </div>
              </Card>
            </div>}

            {tab==="design"&&<div>
              <Lbl>Templates</Lbl>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                {TEMPLATES.map(t=>(
                  <div key={t.name}
                    onClick={()=>setCfg(c=>({...c,bg:t.bg,box:t.box,text:t.text,accent:t.accent}))}
                    style={{padding:"10px 8px",borderRadius:9,cursor:"pointer",background:t.bg,
                      border:`2px solid ${t.accent}55`,textAlign:"center",
                      boxShadow:"0 1px 4px rgba(0,0,0,.12)"}}>
                    <div style={{color:t.text,fontSize:10,fontWeight:700,marginBottom:5}}>{t.name}</div>
                    <div style={{display:"flex",gap:3,justifyContent:"center"}}>
                      {[t.bg,t.box,t.text,t.accent].map((c,i)=>(
                        <div key={i} style={{width:9,height:9,borderRadius:"50%",
                          background:c,border:"1px solid rgba(0,0,0,.2)"}}/>
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
                      style={{width:36,height:36,border:`1px solid ${P.border}`,
                        borderRadius:7,padding:2,flexShrink:0}}/>
                    <span style={{color:P.mid,fontSize:12,fontWeight:500,flex:1}}>{l}</span>
                    <code style={{color:P.muted,fontSize:10,background:"#f8fafc",
                      padding:"2px 7px",borderRadius:4,border:`1px solid ${P.border}`,
                      fontFamily:"monospace"}}>{cfg[k]}</code>
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
                <input type="range" min={18} max={48} value={cfg.fontSize}
                  onChange={e=>sc("fontSize",+e.target.value)}/>
              </Field>
              <Field label={`Corner Radius: ${cfg.borderRadius}px`} mb={14}>
                <input type="range" min={0} max={32} value={cfg.borderRadius}
                  onChange={e=>sc("borderRadius",+e.target.value)}/>
              </Field>
              <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",
                padding:"10px 13px",background:P.card,border:`1px solid ${P.border}`,
                borderRadius:8,marginBottom:14}}>
                <input type="checkbox" checked={cfg.transparent}
                  onChange={e=>sc("transparent",e.target.checked)}
                  style={{accentColor:P.accent,width:15,height:15,cursor:"pointer"}}/>
                <span style={{color:P.mid,fontSize:12,fontWeight:500}}>Transparent Background</span>
              </label>
            </div>}

            {tab==="email"&&<div>
              <InfoBox color={P.accent} bg={P.accentBg} border={P.accentBdr} title="📧 Email Countdown GIF">
                Paste the img tag into your email. A fresh animated GIF is generated on every open.
              </InfoBox>
              {serverOnline&&<Card>
                <Lbl>Live GIF Preview</Lbl>
                <div style={{background:"#111",borderRadius:8,padding:12,textAlign:"center",marginBottom:8}}>
                  <img key={params} src={gifUrl} alt="Timer GIF"
                    style={{maxWidth:"100%",borderRadius:6,display:"block",margin:"0 auto"}}/>
                </div>
              </Card>}
              <CodeBox code={imgTag}    cid="img"   copied={copied} copy={copy} label="📋 Paste into Email"/>
              <CodeBox code={emailBlock} cid="email" copied={copied} copy={copy} label="Full HTML Email Block"/>
              <InfoBox color={P.amber} bg={P.amberBg} border={P.amberBdr} title="🍎 Apple Mail / MPP Note">
                Apple Mail pre-fetches images which can freeze the GIF. The block above includes an MSO fallback.
              </InfoBox>
            </div>}

            {tab==="embed"&&<div>
              <InfoBox color={P.blue} bg={P.blueBg} border={P.blueBdr} title="🌐 Website iFrame Embed">
                Drop the iframe anywhere on your site for a live JS countdown.
              </InfoBox>
              {serverOnline&&<Card>
                <Lbl>Live Embed Preview</Lbl>
                <div style={{border:`1px solid ${P.border}`,borderRadius:8,
                  overflow:"hidden",background:cfg.bg,height:130}}>
                  <iframe key={params} src={embedUrl}
                    style={{width:"100%",height:"100%",border:"none",display:"block"}}
                    title="Timer Embed"/>
                </div>
              </Card>}
              <CodeBox code={iframeTag} cid="iframe" copied={copied} copy={copy} label="📋 Paste into Website"/>
              <Card>
                <Lbl>Direct embed URL</Lbl>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input readOnly value={embedUrl}
                    style={{...INP,fontSize:10,color:P.muted,background:"#f8fafc",flex:1}}/>
                  <button onClick={()=>copy(embedUrl,"eu")} style={{
                    background:copied==="eu"?P.green:P.accent,color:"#fff",border:"none",
                    borderRadius:6,padding:"8px 12px",fontSize:11,cursor:"pointer",
                    fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                    {copied==="eu"?"✓ Copied":"Copy"}
                  </button>
                </div>
              </Card>
            </div>}

            {tab==="share"&&<div>
              <Lbl>Share Link</Lbl>
              <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"stretch"}}>
                <input value={shareLink} readOnly
                  style={{...INP,flex:1,fontSize:10,color:P.muted,background:"#f8fafc"}}/>
                <button onClick={()=>copy(shareLink,"sl")} style={{
                  background:copied==="sl"?P.green:P.accent,color:"#fff",border:"none",
                  borderRadius:7,padding:"8px 14px",fontSize:11,cursor:"pointer",
                  fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                  {copied==="sl"?"✓ Copied":"Copy"}
                </button>
              </div>
              <Lbl>QR Code</Lbl>
              <div style={{background:"white",border:`1px solid ${P.border}`,borderRadius:10,
                padding:20,textAlign:"center",marginBottom:16}}>
                <img src={qrUrl} alt="QR" width={150} height={150}
                  style={{borderRadius:8,display:"block",margin:"0 auto"}}/>
                <div style={{color:P.muted,fontSize:11,marginTop:10,fontWeight:500}}>
                  Scan to open countdown
                </div>
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
                    background:"white",border:`1.5px solid ${P.border}`,borderRadius:8,
                    marginBottom:8,textDecoration:"none",color:s.color,
                    fontSize:12,fontWeight:600}}>
                  <div style={{width:8,height:8,borderRadius:"50%",
                    background:s.color,flexShrink:0}}/>
                  Share on {s.name} ↗
                </a>
              ))}
            </div>}

          </div>
        </div>
      </div>

      {saveModal&&<NameModal
        title="Save Timer"
        description="Give this timer a name so you can find it later."
        confirmLabel="Save Timer"
        onConfirm={handleSaveNew}
        onClose={()=>setSaveModal(false)}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════
   ROOT — switches between Home and Editor
══════════════════════════════════════════════ */
export default function Dashboard(){
  const navigate=useNavigate();
  const[user,setUser]=useState(null);
  const[timers,setTimers]=useState([]);
  const[loading,setLoading]=useState(true);
  const[serverOnline,setServerOnline]=useState(null);

  // "home" | "new" | {timer object} = editing
  const[screen,setScreen]=useState("home");

  /* auth */
  useEffect(()=>{
    const token=localStorage.getItem("accessToken");
    if(!token){navigate("/login");return;}
    try{setUser(jwtDecode(token));}
    catch{localStorage.removeItem("accessToken");navigate("/login");}
  },[navigate]);

  const handleLogout=()=>{localStorage.removeItem("accessToken");navigate("/login");};

  /* health */
  useEffect(()=>{
    fetch(`${API}/health`)
      .then(r=>r.ok?setServerOnline(true):setServerOnline(false))
      .catch(()=>setServerOnline(false));
  },[]);

  /* fetch timers */
  useEffect(()=>{
    if(!user)return;
    setLoading(true);
    apiFetch(`${API}/api/timers`)
      .then(r=>r.json())
      .then(d=>setTimers(Array.isArray(d)?d:[]))
      .catch(()=>setTimers([]))
      .finally(()=>setLoading(false));
  },[user]);

  /* delete */
  const handleDelete=async(timer)=>{
    try{
      await apiFetch(`${API}/api/timers/${timer.id}`,{method:"DELETE"});
      setTimers(prev=>prev.filter(t=>t.id!==timer.id));
    }catch{/* silent */}
  };

  /* after save/update in editor → update list and go back home */
  const handleSaved=(savedTimer)=>{
    setTimers(prev=>{
      const exists=prev.find(t=>t.id===savedTimer.id);
      return exists?prev.map(t=>t.id===savedTimer.id?savedTimer:t):[savedTimer,...prev];
    });
    setScreen("home");
  };

  if(!user)return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      height:"100vh",fontFamily:"system-ui",color:P.muted}}>
      Loading…
    </div>
  );

  if(screen==="home"){
    return(
      <HomeScreen
        user={user}
        serverOnline={serverOnline}
        timers={timers}
        loading={loading}
        onNew={()=>setScreen("new")}
        onEdit={(timer)=>setScreen(timer)}
        onDelete={handleDelete}
        onLogout={handleLogout}/>
    );
  }

  return(
    <EditorScreen
      user={user}
      serverOnline={serverOnline}
      initialTimer={screen==="new"?null:screen}
      onSaved={handleSaved}
      onBack={()=>setScreen("home")}
      onLogout={handleLogout}/>
  );
}