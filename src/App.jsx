import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import * as drive from "./driveService";
import html2canvas from "html2canvas";
import {
  Home, TrendingUp, HardHat, FileText, MoreHorizontal, Plus, Phone,
  Mail, Check, Clock, Download, Eye, Search, Bell, X,
  CheckSquare, Square, ChevronDown, ChevronUp, Archive, ArrowRight,
  Trash2, Edit2, User, Users, ExternalLink, Settings, Link as LinkIcon,
  Star, Upload, Moon, Sun, LogOut, ArrowUp, ArrowDown, MoveVertical,
  Camera, Image as ImageIcon, Folder, ChevronLeft, ChevronRight } from "lucide-react";

/* ─── THEME CSS VARIABLES ─── */
const themeStyles = `
  :root {
    --bg: #F4EFE8; --card: #FFFFFF; --primary: #B8622A; --pLight: #FBE9D8;
    --secondary: #1E3A5F; --success: #4A7A56; --sLight: #E3F0E8;
    --warning: #C07A0A; --wLight: #FDF2D8; --danger: #B83030; --dLight: #FCEAEA;
    --text: #1A120D; --muted: #8C7A6E; --border: #E8DDD3;
  }
  [data-theme="dark"] {
    --bg: #141210; --card: #1F1C1A; --primary: #D97736; --pLight: #3D2311;
    --secondary: #5C8BC4; --success: #5C966B; --sLight: #1E2D22;
    --warning: #E09F3E; --wLight: #3D2D0F; --danger: #D34848; --dLight: #3D1616;
    --text: #F5F0EA; --muted: #A3968A; --border: #332D28;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
`;

const C = {
  bg: "var(--bg)", card: "var(--card)", primary: "var(--primary)", pLight: "var(--pLight)",
  secondary: "var(--secondary)", success: "var(--success)", sLight: "var(--sLight)",
  warning: "var(--warning)", wLight: "var(--wLight)", danger: "var(--danger)", dLight: "var(--dLight)",
  text: "var(--text)", muted: "var(--muted)", border: "var(--border)"
};

/* ─── CONSTANTS & UTILS ─── */
const COR_OPTS = ["#B8622A","#1E3A5F","#4A7A56","#C07A0A","#8C5B8C","#5B6A8C","#B83030","#2A6B6B"];
const EMOJI_OPTS = ["🏗️","🏛️","🧱","🏠","⚡","🪣","▪️","🪟","🚪","🎨","✨","🗝️","🛠️","📐","💧","🌿","🔲"];
const CAT_OPTS = ["Revestimentos","Pintura","Acabamentos","Instalações","Estrutura","Alvenaria","Cobertura","Fundação","Outros"];

const INIT_IDEIA_CATS = [
  {id:1, nome:"Cozinha", ativa:true}, {id:2, nome:"Sala", ativa:true},
  {id:3, nome:"Banheiro", ativa:true}, {id:4, nome:"Quarto", ativa:true},
  {id:5, nome:"Área Externa", ativa:true}, {id:6, nome:"Elétrica", ativa:true},
  {id:7, nome:"Outros", ativa:true}
];
const INIT_IDEIA_TAGS = ["💎 Premium", "✅ Decidido", "📋 Cotar", "❌ Descartado", "🔥 Urgente"];
const IDEIA_COLS = ["var(--pLight)","var(--sLight)","var(--wLight)","var(--dLight)","var(--border)","var(--bg)"];
const URG_OPTS = [{value:"alta",label:"🔴 Urgente"},{value:"media",label:"🟡 Médio"},{value:"baixa",label:"🟢 Baixo"}];
const ST_OPTS = [{value:"ok",label:"✅ Concluída"},{value:"run",label:"🔄 Em andamento"},{value:"wait",label:"⏳ Pendente"}];

/* ─── ID GENERATOR & DATES ─── */
const uid = () => Date.now();
const today = () => new Date().toISOString().split("T")[0];
const todayFmt = () => new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
const initials = (n="") => n.split(" ").slice(0,2).map(w=>w[0]||"").join("").toUpperCase();

const todayYM = () => { const d=new Date(); return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`; };
const parseYM = (ym) => { const [y,m] = ym.split('-'); return {y:parseInt(y), m:parseInt(m)}; };
const addYM = (ym, durMonths) => {
  let {y,m} = parseYM(ym);
  m += durMonths;
  while(m > 12) { m -= 12; y++; }
  while(m < 1) { m += 12; y--; }
  return `${y}-${m.toString().padStart(2,'0')}`;
};
const diffYM = (start, end) => {
  const s = parseYM(start); const e = parseYM(end);
  return (e.y - s.y)*12 + (e.m - s.m);
};
const fmtYM = (ym) => {
  if(!ym) return "";
  const mNames = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const {y,m} = parseYM(ym);
  return `${mNames[m]}/${y.toString().slice(-2)}`;
};

/* ─── HELPERS ─── */
const fmt = (n) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const fmtK = (n) => n>=1000 ? `R$ ${(n/1000).toFixed(0)}k` : `R$ ${n}`;
const real = (e) => (e.gastos||[]).reduce((s,g)=>s+g.valor,0);
const pBar = (r,o) => Math.min(100, o>0 ? Math.round((r/o)*100) : 0);

/* ─── FILE HELPERS ─── */
const compressFile = async (file) => {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("Compression timeout");
      resolve(file);
    }, 10000);

    try {
      const reader = new FileReader();
      reader.onerror = () => { clearTimeout(timeout); resolve(file); };
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => { clearTimeout(timeout); resolve(file); };
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 1200;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              clearTimeout(timeout);
              if (!blob) return resolve(file);
              resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            }, "image/jpeg", 0.7);
          } catch (e) {
            clearTimeout(timeout);
            resolve(file);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (e) {
      clearTimeout(timeout);
      resolve(file);
    }
  });
};

const uploadToStorage = async (file, folder) => {
  if (!file) throw new Error("Nenhum arquivo selecionado");
  if (!folder) throw new Error("Pasta de destino não especificada");
  
  try {
    console.log(`[uploadToStorage] Enviando ${file.name} para ${folder}`);
    const res = await drive.uploadFile(file, folder);
    console.log(`[uploadToStorage] Resultado:`, res);
    return res;
  } catch (err) {
    console.error(`[uploadToStorage] Erro:`, err);
    
    if (err.message?.includes("popup_closed_by_user")) {
      throw new Error("Você fechou a janela de autenticação. Por favor, autorize o acesso ao Google Drive.");
    }
    if (err.message?.includes("401")) {
      throw new Error("Token inválido ou expirado. Recarregue a página e tente novamente.");
    }
    if (err.message?.includes("403")) {
      throw new Error("Sem permissão para acessar Google Drive. Verifique as credenciais.");
    }
    if (err.message?.includes("DRIVE_CLIENT_ID")) {
      throw new Error("Google Drive não está configurado. Contate o administrador.");
    }
    
    throw err;
  }
};

/* ─── SHARED COMPONENTS ─── */
const Card = ({children,style={},onClick}) => (
  <div onClick={onClick} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 1px 8px rgba(0,0,0,0.06)",cursor:onClick?"pointer":"default",...style}}>
    {children}
  </div>
);
const Badge = ({label,color,bg}) => (
  <span style={{fontSize:11,fontWeight:700,color,background:bg,borderRadius:20,padding:"2px 10px",display:"inline-block"}}>{label}</span>
);
const STitle = ({children,style={}}) => (
  <p style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,...style}}>{children}</p>
);
const FInput = ({label,value,onChange,type="text",placeholder="",required=false,min,max}) => (
  <div style={{marginBottom:14}}>
    <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>{label}{required&&" *"}</p>
    <input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max}
      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,outline:"none",fontFamily:"inherit"}}/>
  </div>
);
const FSelect = ({label,value,onChange,options}) => (
  <div style={{marginBottom:14}}>
    <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>{label}</p>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,outline:"none",fontFamily:"inherit",appearance:"none"}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>
);
const FTextarea = ({label,value,onChange,placeholder="",rows=3}) => (
  <div style={{marginBottom:14}}>
    <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>{label}</p>
    <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,color:C.text,background:C.bg,outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
  </div>
);
const Btn = ({label,onClick,color=C.primary,outline=false,icon}) => (
  <button onClick={onClick} style={{
    width:"100%",padding:13,borderRadius:12,
    border:outline?`1.5px solid ${color}`:"none",
    background:outline?"transparent":color,
    color:outline?color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:8,
    display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"
  }}>{icon}{label}</button>
);
const SmBtn = ({onClick,children,bg=C.bg}) => (
  <button onClick={onClick} style={{
    width:32,height:32,borderRadius:9,border:`1px solid ${C.border}`,
    background:bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0
  }}>{children}</button>
);

function Sheet({title,onClose,children}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)"}}/>
      <div style={{position:"relative",background:C.card,borderRadius:"22px 22px 0 0",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"12px auto 0"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px 8px"}}>
          <p style={{fontSize:18,fontWeight:800,color:C.text}}>{title}</p>
          <SmBtn onClick={onClose} bg={C.bg}><X size={18} color={C.muted}/></SmBtn>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 16px 36px"}}>{children}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function App() {
  /* ─── AUTH & THEME ─── */
  const [user, setUser] = useState(null);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isDark, setIsDark] = useState(false);

  /* ─── NOTIFICATIONS STATE ─── */
  const [changeLog, setChangeLog] = useState([]);
  const [readNotifs, setReadNotifs] = useState([]);
  const [deletedNotifs, setDeletedNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    drive.initDrive().catch(err => console.error("Drive init error", err));
  }, []);

  /* ─── TAB STATE ─── */
  const [tab, setTab]         = useState("dash");
  const [maisTab, setMaisTab] = useState("docs");
  const [docTab, setDocTab]   = useState("contratos");
  
  /* ─── GALERIA STATE ─── */
  const [selectedPastaId, setSelectedPastaId] = useState(null);
  const [viewerImage, setViewerImage] = useState(null); // { fotos: [], index: 0 }

  /* ─── DATA STATE ─── */
  const [etapas,    setEtapas]    = useState([]);
  const [outrosGastos, setOutrosGastos] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [projetos,  setProjetos]  = useState([]);
  const [cotacoes,  setCotacoes]  = useState([]);
  const [contatos,  setContatos]  = useState([]);
  const [ideias,    setIdeias]    = useState([]);
  const [anotacoes, setAnotacoes] = useState([]);
  const [tarefas,   setTarefas]   = useState([]);
  const [ideiaCats, setIdeiaCats] = useState([]);
  const [ideiaTags, setIdeiaTags] = useState([]);
  const [galeria,   setGaleria]   = useState([]);

  useEffect(() => {
    const unsubEtapas = onSnapshot(collection(db, "etapas"), snapshot => {
      const list = snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}));
      setEtapas(list.sort((a,b) => {
        const diff = (a.ordem ?? 0) - (b.ordem ?? 0);
        if (diff !== 0) return diff;
        return (a.id < b.id ? -1 : 1);
      }));
    });
    const unsubOutros = onSnapshot(collection(db, "outrosGastos"), snapshot => setOutrosGastos(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubCheck = onSnapshot(collection(db, "checklist"), snapshot => setChecklist(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubContr = onSnapshot(collection(db, "contratos"), snapshot => setContratos(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubProj = onSnapshot(collection(db, "projetos"), snapshot => setProjetos(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubCot = onSnapshot(collection(db, "cotacoes"), snapshot => setCotacoes(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubContat = onSnapshot(collection(db, "contatos"), snapshot => setContatos(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubIdeias = onSnapshot(collection(db, "ideias"), snapshot => setIdeias(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubAnot = onSnapshot(collection(db, "anotacoes"), snapshot => setAnotacoes(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubTar = onSnapshot(collection(db, "tarefas"), snapshot => setTarefas(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubCats = onSnapshot(collection(db, "ideiaCats"), snapshot => setIdeiaCats(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));
    const unsubTags = onSnapshot(doc(db, "meta", "ideiaTags"), doc => { if (doc.exists()) setIdeiaTags(doc.data().tags || []); });
    const unsubGaleria = onSnapshot(collection(db, "galeria"), snapshot => setGaleria(snapshot.docs.map(d=>({id:isNaN(d.id)?d.id:Number(d.id), ...d.data()}))));

    return () => {
      unsubEtapas(); unsubOutros(); unsubCheck(); unsubContr(); unsubProj();
      unsubCot(); unsubContat(); unsubIdeias(); unsubAnot(); unsubTar();
      unsubCats(); unsubTags(); unsubGaleria();
    };
  }, []);

  /* ─── UI STATE ─── */
  const [modal,       setModal]       = useState(null);
  const [viewGastos,  setViewGastos]  = useState(null);
  const [expandedCot, setExpandedCot] = useState({});
  const [searchCon,   setSearchCon]   = useState("");
  const [searchGasto, setSearchGasto] = useState("");
  const [searchIdeia, setSearchIdeia] = useState("");
  const [searchDoc,   setSearchDoc]   = useState(""); 
  const [catFiltro,   setCatFiltro]   = useState("Todas");
  const [openEtapaId, setOpenEtapaId] = useState(null);
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [isSorting, setIsSorting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /* ─── NOTIFICATIONS LOGIC ─── */
  const logChange = (desc) => {
    if(user) setChangeLog(p => [...p, { id:uid(), user, time: Date.now(), desc }]);
  };

  const getActiveNotifs = () => {
    const notifs = [];
    etapas.forEach(e => {
       if(real(e) > e.orc && e.orc > 0) {
          notifs.push({ id: `orc-${e.id}`, title: "Orçamento Extrapolado", desc: `A etapa ${e.nome} excedeu o orçamento estimado em ${fmt(real(e) - e.orc)}.`, type: "danger" });
       }
    });
    tarefas.forEach(t => {
       if(!t.done && t.prazo && t.prazo < today()) {
          notifs.push({ id: `prz-${t.id}`, title: "Prazo Vencido", desc: `A tarefa "${t.t}" está atrasada.`, type: "warning" });
       }
    });
    if(user) {
      const partnerChanges = changeLog.filter(c => c.user !== user && (Date.now() - c.time) < 3600000);
      if(partnerChanges.length > 0) {
         const partnerName = user === 'Guilherme' ? 'Luan' : 'Guilherme';
         const lastId = partnerChanges[partnerChanges.length - 1].id;
         notifs.push({
           id: `chg-${partnerName}-${lastId}`,
           title: `Atualizações de ${partnerName}`,
           desc: `${partnerName} realizou ${partnerChanges.length} alteração(ões) no aplicativo recentemente.`,
           type: "primary",
           changes: partnerChanges.map(c => c.desc)
         });
      }
    }
    return notifs.filter(n => !deletedNotifs.includes(n.id));
  };

  const currentNotifs = getActiveNotifs();
  const unreadCount = currentNotifs.filter(n => !readNotifs.includes(n.id)).length;

  const handleOpenNotifs = () => {
    const ids = currentNotifs.map(n=>n.id);
    setReadNotifs(p => [...new Set([...p, ...ids])]);
    setShowNotifs(true);
  };

  /* ─── LOGIN & LOGOUT ─── */
  const handleLogin = () => {
    const u = loginUser.trim().toLowerCase();
    const p = loginPass.trim();
    if ((u === 'luan' && p === 'rafaeleugenio') || (u === 'guilherme' && p === 'augustovieira')) {
      setUser(u === 'luan' ? 'Luan' : 'Guilherme');
      setLoginPass("");
      setLoginError("");
    } else {
      setLoginError("Usuário ou senha incorretos.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTab("dash");
  };

  /* ─── MODAL HELPERS ─── */
  const openAdd  = (type, defaults={}, parentId=null) => {
    const data = {...defaults};
    if (type === "gasto" || type === "doc" || type === "ideia") data.anexos = [];
    setModal({type, data, parentId, editing:false});
  };
  
  const openEdit = (type, item, parentId=null) => {
    const data = JSON.parse(JSON.stringify(item));
    
    if (type === "gasto" && !data.anexos) {
      data.anexos = data.comp ? [{nome: data.comp, url: data.compUrl, driveId: data.compDriveId || ""}] : [];
    }
    if (type === "doc" && !data.anexos) {
      data.anexos = data.nome ? [{nome: data.nome, url: data.url, driveId: data.driveId || "", tam: data.tam || "", comp: data.comp || ""}] : [];
      data.titulo = data.titulo || data.nome;
    }
    if (type === "ideia" && !data.anexos) {
      data.anexos = [];
    }
    setModal({type, data, parentId, editing:true});
  };
  
  const closeModal = () => { setModal(null); setIsUploading(false); };
  const setF = (f,v) => setModal(m=>({...m,data:{...m.data,[f]:v}}));
  const d = modal?.data || {};

  /* ─── COMPUTED ─── */
  const totalOrc  = etapas.reduce((s,e)=>s+e.orc,0);
  const totalReal = etapas.reduce((s,e)=>s+real(e),0) + outrosGastos.reduce((s,g)=>s+g.valor,0);
  const pctGasto  = pBar(totalReal,totalOrc);
  const pctObra   = etapas.length > 0 ? Math.round(etapas.reduce((s,e)=>s+e.pct,0)/etapas.length) : 0;
  const emAndamento = etapas.filter(e=>e.st==="run");

  let totalG = 0, totalL = 0;
  etapas.forEach(e => e.gastos.forEach(g => { totalG += parseFloat(g.valorG)||0; totalL += parseFloat(g.valorL)||0; }));
  outrosGastos.forEach(g => { totalG += parseFloat(g.valorG)||0; totalL += parseFloat(g.valorL)||0; });

  /* ═══════════════════════════════════
     CRUD OPERATIONS
  ═══════════════════════════════════ */

  const saveEtapa = async () => {
    if(!d.nome?.trim()) return alert("Nome é obrigatório");
    const item = {
      ...d, orc:parseFloat(d.orc)||0, pct:Math.min(100,parseInt(d.pct)||0), 
      dataIniEst: d.dataIniEst || todayYM(), durEst: Math.max(1, parseInt(d.durEst) || 1),
      dataIniReal: d.dataIniReal || "", durReal: parseInt(d.durReal) || 0,
      detalhes: d.detalhes || "",
      dep: d.dep?parseInt(d.dep):null,
      ordem: d.ordem ?? etapas.length
    };
    if(!modal.editing) { item.id = uid(); item.gastos = []; }
    
    const payload = JSON.parse(JSON.stringify(item));
    await setDoc(doc(db, "etapas", item.id.toString()), payload);
    
    logChange(modal.editing ? `Editou a etapa "${item.nome}"` : `Criou a etapa "${item.nome}"`); closeModal();
  };

  const moveEtapa = async (id, delta) => {
    if (isUploading) return;
    const newList = [...etapas];
    const idx = newList.findIndex(e => String(e.id) === String(id));
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= newList.length) return;

    const [movedItem] = newList.splice(idx, 1);
    newList.splice(newIdx, 0, movedItem);

    setIsUploading(true);
    try {
      const batch = writeBatch(db);
      newList.forEach((item, i) => {
        batch.update(doc(db, "etapas", item.id.toString()), { ordem: i });
      });
      await batch.commit();
    } catch (err) {
      console.error("Erro ao reorganizar:", err);
      alert("Erro ao salvar nova ordem.");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteEtapa = async () => { await deleteDoc(doc(db, "etapas", d.id.toString())); logChange(`Excluiu a etapa "${d.nome}"`); closeModal(); };

  /* ─── UPLOADS MÚLTIPLOS ─── */
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const maxSize = 100 * 1024 * 1024;
    for (let file of files) {
      if (file.size > maxSize) return alert(`O arquivo ${file.name} é muito grande. Máximo de 100MB por arquivo.`);
    }

    setIsUploading(true);
    window.setTimeout(async () => {
      try {
        await drive.preAuthenticateIfNeeded();
        const folder = docTab === "contratos" ? "contratos" : "projetos";
        const novosAnexos = [];
        for (let file of files) {
          const res = await uploadToStorage(file, folder);
          novosAnexos.push({ nome: res.name, url: res.url, driveId: res.id, tam: (file.size / 1024 / 1024).toFixed(2) + " MB", comp: res.size });
        }
        setF("anexos", [...(d.anexos || []), ...novosAnexos]);
      } catch (err) {
        alert(err.message?.includes('autenticação') ? "Erro de autenticação. Recarregue e tente novamente." : `Erro: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }, 50);
  };

  const handleGastoFile = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const maxSize = 100 * 1024 * 1024;
    for (let file of files) {
      if (file.size > maxSize) return alert(`O arquivo ${file.name} é muito grande. Máximo de 100MB por arquivo.`);
    }

    setIsUploading(true);
    window.setTimeout(async () => {
      try {
        await drive.preAuthenticateIfNeeded();
        const novosAnexos = [];
        for (let file of files) {
          const res = await uploadToStorage(file, "gastos");
          novosAnexos.push({ nome: res.name, url: res.url, driveId: res.id });
        }
        setF("anexos", [...(d.anexos || []), ...novosAnexos]);
      } catch (err) {
        alert(err.message?.includes('autenticação') ? "Erro de autenticação. Recarregue e tente novamente." : `Erro: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }, 50);
  };

  const handleIdeiaFile = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const maxSize = 100 * 1024 * 1024;
    for (let file of files) {
      if (file.size > maxSize) return alert(`O arquivo ${file.name} é muito grande. Máximo de 100MB por arquivo.`);
    }

    setIsUploading(true);
    window.setTimeout(async () => {
      try {
        await drive.preAuthenticateIfNeeded();
        const novosAnexos = [];
        for (let file of files) {
          const res = await uploadToStorage(file, "ideias"); 
          novosAnexos.push({ nome: res.name, url: res.url, driveId: res.id });
        }
        setF("anexos", [...(d.anexos || []), ...novosAnexos]);
      } catch (err) {
        alert(err.message?.includes('autenticação') ? "Erro de autenticação. Recarregue e tente novamente." : `Erro: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }, 50);
  };

  const handleGaleriaFile = async (e, pastaId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const maxSize = 100 * 1024 * 1024;
    for (let file of files) {
      if (file.size > maxSize) return alert(`O arquivo ${file.name} é muito grande.`);
    }

    setIsUploading(true);
    window.setTimeout(async () => {
      try {
        await drive.preAuthenticateIfNeeded();
        const novasFotos = [];
        for (let file of files) {
          const compressed = await compressFile(file);
          const res = await uploadToStorage(compressed, "galeria");
          novasFotos.push({ id: uid() + Math.random(), nome: res.name, url: res.url, driveId: res.id, data: todayFmt() });
        }
        const pasta = galeria.find(p => p.id === pastaId);
        if(pasta) {
          const updatedPasta = { ...pasta, fotos: [...(pasta.fotos || []), ...novasFotos] };
          await setDoc(doc(db, "galeria", pasta.id.toString()), JSON.parse(JSON.stringify(updatedPasta)));
        }
      } catch (err) {
        alert(err.message?.includes('autenticação') ? "Erro de autenticação. Recarregue e tente novamente." : `Erro no upload: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }, 50);
  };

  const deleteFoto = async (pastaId, fotoIndex, ev) => {
    ev.stopPropagation();
    const pasta = galeria.find(p => p.id === pastaId);
    if(!pasta) return;
    
    const foto = pasta.fotos[fotoIndex];
    const confirmacao = window.confirm(`Deseja excluir esta imagem?`);
    if(!confirmacao) return;

    try {
      if(foto.driveId) await drive.deleteFile(foto.driveId);
      const novasFotos = [...pasta.fotos];
      novasFotos.splice(fotoIndex, 1);
      await setDoc(doc(db, "galeria", pasta.id.toString()), JSON.parse(JSON.stringify({...pasta, fotos: novasFotos})));
    } catch(err) {
      alert(`Erro ao excluir foto: ${err.message}`);
    }
  };

  const [showAllPayments, setShowAllPayments] = useState(false);

  const saveGasto = async () => {
    if(!d.desc?.trim()||!d.valor) return alert("Descrição e valor são obrigatórios");
    const etId = parseInt(d.etapaId);
    const oldEtId = modal.editing ? parseInt(modal.parentId) : null;

    let v = parseFloat(d.valor)||0, pagador = d.pagador || 'G', vG = 0, vL = 0;
    if(pagador === 'G') vG = v; else if(pagador === 'L') vL = v; else { vG = parseFloat(d.valorG)||(v/2); vL = parseFloat(d.valorL)||(v/2); v = vG + vL; }
    
    const gRaw = { id:d.id||uid(), desc:d.desc, valor:v, valorG:vG, valorL:vL, pagador, data:d.data||today(), recebedor:d.recebedor||"", tags:d.tags||"", obs:d.obs||"", anexos:d.anexos||[] };
    const g = JSON.parse(JSON.stringify(gRaw));
    
    if (modal.editing && oldEtId !== etId) {
       if (oldEtId === 999) {
          await deleteDoc(doc(db, "outrosGastos", g.id.toString()));
       } else {
          const oldE = etapas.find(x => x.id.toString() === oldEtId.toString());
          if (oldE) {
             const gastosLimpos = oldE.gastos.filter(x => x.id.toString() !== g.id.toString());
             await setDoc(doc(db, "etapas", oldE.id.toString()), JSON.parse(JSON.stringify({...oldE, gastos: gastosLimpos})));
          }
       }
    }

    if (etId === 999) {
      await setDoc(doc(db, "outrosGastos", g.id.toString()), g);
    } else {
      const e = etapas.find(x => x.id.toString() === etId.toString());
      if(e) {
         let novosGastos;
         if (modal.editing && oldEtId === etId) {
            novosGastos = e.gastos.map(x => x.id.toString()===g.id.toString() ? g : x);
         } else {
            novosGastos = [...e.gastos, g];
         }
         await setDoc(doc(db, "etapas", e.id.toString()), JSON.parse(JSON.stringify({...e, gastos: novosGastos})));
      }
    }
    
    logChange(modal.editing ? `Editou o gasto "${g.desc}"` : `Lançou o gasto "${g.desc}"`); closeModal();
  };
  
  const deleteGasto = async () => { 
    const confirmacao = window.confirm(`Tem certeza que deseja excluir o gasto "${d.desc}"?\n\nEsta ação não pode ser desfeita${d.anexos?.length ? ' e também removerá os comprovantes anexos do Google Drive.' : '.'}`);
    if (!confirmacao) return;
    
    try {
      if (d.anexos && d.anexos.length > 0) {
        for (const a of d.anexos) { if (a.driveId) await drive.deleteFile(a.driveId); }
      } else if (d.compDriveId) {
        await drive.deleteFile(d.compDriveId);
      }
      
      if (parseInt(d.etapaId) === 999) {
        await deleteDoc(doc(db, "outrosGastos", d.id.toString()));
      } else {
        const e = etapas.find(x => x.id.toString() === d.etapaId?.toString());
        if(e) {
           const payload = JSON.parse(JSON.stringify({...e, gastos: e.gastos.filter(g => g.id.toString() !== d.id.toString())}));
           await setDoc(doc(db, "etapas", e.id.toString()), payload);
        }
      }
      
      logChange(`Excluiu o gasto "${d.desc}"`); 
      closeModal();
    } catch (error) {
      alert(`Erro ao excluir gasto: ${error.message}`);
    }
  }; 

  const saveCheck = async () => {
    if(!d.t?.trim()) return alert("Tarefa é obrigatória");
    const item = {...d, depOk:!!d.depOk};
    if(!modal.editing) { item.id = uid(); item.done = false; }
    await setDoc(doc(db, "checklist", item.id.toString()), JSON.parse(JSON.stringify(item)));
    logChange(modal.editing ? `Editou a dependência "${item.t}"` : `Adicionou a dependência "${item.t}"`); closeModal();
  };
  const deleteCheck = async () => { await deleteDoc(doc(db, "checklist", d.id.toString())); logChange(`Excluiu a dependência "${d.t}"`); closeModal(); };
  const toggleCheck = async (id) => { 
     const item = checklist.find(c=>c.id===id);
     if(item) {
        await setDoc(doc(db, "checklist", id.toString()), JSON.parse(JSON.stringify({...item, done: !item.done})));
        logChange(`Marcou a dependência "${item.t}" como ${!item.done ? 'concluída' : 'pendente'}`); 
     }
  };

  const saveDoc = async () => {
    if(!d.titulo?.trim() && !d.nome?.trim()) return alert("Título do documento é obrigatório!");
    const itemRaw = {...d, id:d.id||uid(), data:d.data||todayFmt(), anexos: d.anexos||[], tags: d.tags||""};
    const item = JSON.parse(JSON.stringify(itemRaw));
    
    if(docTab==="contratos") { await setDoc(doc(db, "contratos", item.id.toString()), item); }
    else { await setDoc(doc(db, "projetos", item.id.toString()), item); }
    
    logChange(modal.editing ? `Editou o documento "${item.titulo || item.nome}"` : `Adicionou o documento "${item.titulo || item.nome}"`); closeModal();
  };

  const excluirDocumento = async () => { 
    const confirmacao = window.confirm(`Tem certeza que deseja excluir o documento "${d.titulo || d.nome}"?\n\nEsta ação não pode ser desfeita${d.anexos?.length ? ' e também removerá os arquivos anexos do Google Drive.' : '.'}`);
    if (!confirmacao) return;
    
    try {
      if (d.anexos && d.anexos.length > 0) {
        for (const a of d.anexos) { if (a.driveId) await drive.deleteFile(a.driveId); }
      } else if (d.driveId) {
        await drive.deleteFile(d.driveId);
      }
      
      if(docTab==="contratos") await deleteDoc(doc(db, "contratos", d.id.toString()));
      else await deleteDoc(doc(db, "projetos", d.id.toString()));
      
      logChange(`Excluiu o documento "${d.titulo || d.nome}"`); 
      closeModal();
    } catch (error) {
      alert(`Erro ao excluir documento: ${error.message}`);
    }
  };

  const toggleSigned = async (id) => { 
     const item = contratos.find(c=>c.id===id);
     if(item) {
        await setDoc(doc(db, "contratos", id.toString()), JSON.parse(JSON.stringify({...item, ok: !item.ok})));
        logChange(`Marcou o contrato "${item.titulo || item.nome}" como ${!item.ok ? 'assinado' : 'não assinado'}`); 
     }
  };

  const saveCotacao = async () => {
    if(!d.titulo?.trim()) return alert("Título é obrigatório");
    const item = {...d, itens: d.itens || []};
    if(!modal.editing) { item.id = uid(); item.st = d.st||"aberta"; item.forn = []; }
    const cotAtual = cotacoes.find(c=>c.id===item.id) || {};
    await setDoc(doc(db, "cotacoes", item.id.toString()), JSON.parse(JSON.stringify({...cotAtual, ...item})));
    logChange(modal.editing ? `Editou a cotação "${item.titulo}"` : `Criou a cotação "${item.titulo}"`); closeModal();
  };
  const deleteCotacao = async () => { await deleteDoc(doc(db, "cotacoes", d.id.toString())); logChange(`Excluiu a cotação "${d.titulo}"`); closeModal(); };
  const concluirCotacao = async (e, qId) => { 
     e.stopPropagation(); 
     const item = cotacoes.find(c=>c.id===qId);
     if(item) {
        await setDoc(doc(db, "cotacoes", qId.toString()), JSON.parse(JSON.stringify({...item, st:"concluida"})));
        logChange(`Concluiu a cotação "${item.titulo}"`); 
     }
  };

  const saveForn = async () => {
    if(!d.nome?.trim()||!d.precoVista) return alert("Nome e preço à vista são obrigatórios");
    const f = {...d,id:d.id||uid(), precoVista:parseFloat(d.precoVista)||0, precoPrazo:parseFloat(d.precoPrazo)||""};
    const c = cotacoes.find(x=>x.id===modal.parentId);
    if(c) {
       const novosForn = modal.editing ? c.forn.map(x=>x.id===f.id?f:x) : [...c.forn,{...f,best:c.forn.length===0}];
       await setDoc(doc(db, "cotacoes", c.id.toString()), JSON.parse(JSON.stringify({...c, forn: novosForn})));
    }
    logChange(modal.editing ? `Editou o fornecedor "${f.nome}"` : `Adicionou o fornecedor "${f.nome}"`); closeModal();
  };
  const deleteForn = async () => { 
    const c = cotacoes.find(x=>x.id===modal.parentId);
    if(c) {
       await setDoc(doc(db, "cotacoes", c.id.toString()), JSON.parse(JSON.stringify({...c, forn: c.forn.filter(f=>f.id!==d.id)})));
    }
    logChange(`Excluiu o fornecedor "${d.nome}"`); closeModal(); 
  };
  const setBest = async (cotId,fnId) => { 
     const c = cotacoes.find(x=>x.id===cotId);
     if(c) {
       const f = c.forn.find(x=>x.id===fnId);
       await setDoc(doc(db, "cotacoes", c.id.toString()), JSON.parse(JSON.stringify({...c, forn: c.forn.map(x=>({...x,best:x.id===fnId}))})));
       logChange(`Marcou o fornecedor "${f?.nome}" como melhor opção`); 
     }
  };

  const saveContato = async () => {
    if(!d.nome?.trim()) return alert("Nome é obrigatório");
    const item = {...d, ini:initials(d.nome), cor:d.cor||COR_OPTS[0], prestou:!!d.prestou, nota:d.prestou?parseInt(d.nota)||0:0, obs:d.obs||""};
    if(!modal.editing) item.id = uid();
    await setDoc(doc(db, "contatos", item.id.toString()), JSON.parse(JSON.stringify(item)));
    logChange(modal.editing ? `Editou o contato "${item.nome}"` : `Adicionou o contato "${item.nome}"`); closeModal();
  };
  const deleteContato = async () => { await deleteDoc(doc(db, "contatos", d.id.toString())); logChange(`Excluiu o contato "${d.nome}"`); closeModal(); };

  const saveIdeia = async () => {
    if(!d.t?.trim()) return alert("Título é obrigatório");
    const safeCats = ideiaCats || [];
    const catFinal = d.cat || (safeCats.find(c=>c.ativa)?.nome || "Outros");
    const item = {...d, cor:d.cor||IDEIA_COLS[0], data:d.data||todayFmt(), tags:d.tags||[], links:d.links||[], cat:catFinal, anexos:d.anexos||[]};
    if(!modal.editing) item.id = uid();
    await setDoc(doc(db, "ideias", item.id.toString()), JSON.parse(JSON.stringify(item)));
    logChange(modal.editing ? `Editou a ideia "${item.t}"` : `Adicionou a ideia "${item.t}"`); closeModal();
  };
  
  const deleteIdeia = async () => { 
    const confirmacao = window.confirm(`Tem certeza que deseja excluir a ideia "${d.t}"?\n\nEsta ação não pode ser desfeita${d.anexos?.length ? ' e também removerá os arquivos anexos do Google Drive.' : '.'}`);
    if (!confirmacao) return;
    try {
       if (d.anexos && d.anexos.length > 0) {
         for (const a of d.anexos) { if (a.driveId) await drive.deleteFile(a.driveId); }
       }
       await deleteDoc(doc(db, "ideias", d.id.toString())); 
       logChange(`Excluiu a ideia "${d.t}"`); 
       closeModal(); 
    } catch(error) {
       alert(`Erro ao excluir ideia: ${error.message}`);
    }
  };

  /* ─── GALERIA ACTIONS ─── */
  const savePastaGaleria = async () => {
    if(!d.nome?.trim()) return alert("Nome da pasta é obrigatório");
    const item = {...d, dataCriacao: d.dataCriacao || today()};
    if(!modal.editing) { item.id = uid(); item.fotos = []; }
    await setDoc(doc(db, "galeria", item.id.toString()), JSON.parse(JSON.stringify(item)));
    logChange(modal.editing ? `Editou a pasta "${item.nome}"` : `Criou a pasta "${item.nome}"`); closeModal();
  };

  const deletePastaGaleria = async () => {
    const confirmacao = window.confirm(`Tem certeza que deseja excluir a pasta "${d.nome}" e TODAS as fotos dentro dela?`);
    if(!confirmacao) return;
    try {
      if(d.fotos && d.fotos.length > 0) {
         for (const f of d.fotos) { if(f.driveId) await drive.deleteFile(f.driveId); }
      }
      await deleteDoc(doc(db, "galeria", d.id.toString()));
      logChange(`Excluiu a pasta "${d.nome}"`); 
      if(selectedPastaId === d.id) setSelectedPastaId(null);
      closeModal();
    } catch(e) {
      alert("Erro ao excluir: " + e.message);
    }
  };

  /* ─── EXPORTAR COTAÇÃO ─── */
  const cotacaoExportRef = useRef(null);
  const [exportingCot, setExportingCot] = useState(null);
  const [exportOpts, setExportOpts] = useState({ includeOthers: false, deadline: "" });

  const abrirExportCotacao = (q) => {
    setExportingCot(q);
    setExportOpts({ includeOthers: false, deadline: "" });
  };

  const baixarImagemCotacao = async () => {
    if (!cotacaoExportRef.current) return;
    try {
      const canvas = await html2canvas(cotacaoExportRef.current, {
        scale: 2, backgroundColor: "#ffffff", useCORS: true,
        logging: false
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeTitle = (exportingCot?.titulo||"cotacao").replace(/[^a-z0-9]/gi, '-').toLowerCase();
      link.download = `${safeTitle}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(e) { alert("Erro ao gerar imagem: " + e.message); }
  };

  /* ═══════════════════════════════════
     MODAL RENDERER
  ═══════════════════════════════════ */
  const renderModal = () => {
    if(!modal) return null;
    const {type, editing} = modal;

    if(type==="etapa") return (
      <Sheet title={editing?"Editar Etapa":"Nova Etapa"} onClose={closeModal}>
        <FInput label="Nome da etapa" value={d.nome} onChange={v=>setF("nome",v)} required/>
        <div style={{marginBottom:14}}><p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>Emoji</p><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{EMOJI_OPTS.map(em=>(<button key={em} onClick={()=>setF("emoji",em)} style={{width:42,height:42,borderRadius:10,border:`2px solid ${d.emoji===em?C.primary:C.border}`,background:d.emoji===em?C.pLight:"transparent",fontSize:20,cursor:"pointer"}}>{em}</button>))}</div></div>
        <FInput label="Orçamento (R$)" type="number" value={d.orc} onChange={v=>setF("orc",v)}/>
        <FTextarea label="Detalhes (O que está previsto/incluso?)" value={d.detalhes} onChange={v=>setF("detalhes",v)} rows={4} placeholder="Ex: Piso porcelanato retificado, reboco interno, etc."/>
        <div style={{marginBottom:14}}><p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>Conclusão: <strong style={{color:C.primary}}>{d.pct||0}%</strong></p><input type="range" min={0} max={100} value={d.pct||0} onChange={e=>setF("pct",e.target.value)} style={{width:"100%",accentColor:C.primary}}/></div>
        <FSelect label="Status" value={d.st||"wait"} onChange={v=>setF("st",v)} options={ST_OPTS}/>
        
        <div style={{background:C.bg, border:`1px solid ${C.border}`, padding:"12px 12px 0", borderRadius:12, marginBottom:14}}>
           <STitle style={{marginBottom:8, color:C.text}}>Planejamento Estimado</STitle>
           <div style={{display:"flex", gap:10}}>
             <div style={{flex:1}}><FInput label="Mês/Ano (Início)" type="month" value={d.dataIniEst} onChange={v=>setF("dataIniEst",v)} required/></div>
             <div style={{flex:1}}><FInput label="Duração (meses)" type="number" value={d.durEst} onChange={v=>setF("durEst",v)} min="1"/></div>
           </div>
        </div>
        
        <div style={{background:C.sLight, border:`1px solid var(--success)`, opacity:0.8, padding:"12px 12px 0", borderRadius:12, marginBottom:14}}>
           <STitle style={{marginBottom:8, color:C.success}}>Execução Real</STitle>
           <div style={{display:"flex", gap:10}}>
             <div style={{flex:1}}><FInput label="Mês/Ano (Início)" type="month" value={d.dataIniReal} onChange={v=>setF("dataIniReal",v)}/></div>
             <div style={{flex:1}}><FInput label="Duração (meses)" type="number" value={d.durReal} onChange={v=>setF("durReal",v)} min="0"/></div>
           </div>
        </div>

        <FSelect label="Depende de" value={d.dep||""} onChange={v=>setF("dep",v||null)} options={[{value:"",label:"— Sem dependência"},...etapas.filter(e=>e.id!==d.id).map(e=>({value:e.id,label:`${e.emoji} ${e.nome}`}))]}/>
        <Btn label="Salvar Etapa" onClick={saveEtapa}/>
        {editing && <Btn label="Excluir etapa" onClick={deleteEtapa} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="gasto") return (
      <Sheet title={editing?"Editar Lançamento":"Novo Lançamento"} onClose={closeModal}>
        <FSelect label="Etapa / Categoria" value={d.etapaId||etapas[0]?.id} onChange={v=>setF("etapaId",parseInt(v))} options={[
          ...etapas.map(e=>({value:e.id,label:`${e.emoji} ${e.nome}`})),
          {value: 999, label: "🧾 Outros (Taxas, Lote, etc.)"}
        ]}/>
        <FInput label="Descrição do Gasto" value={d.desc} onChange={v=>setF("desc",v)} required placeholder="Ex: Tijolos e cimento"/>
        <FInput label="Recebedor / Fornecedor" value={d.recebedor} onChange={v=>setF("recebedor",v)} placeholder="Ex: Depósito Central"/>
        <FSelect label="Quem efetuou o pagamento?" value={d.pagador||"G"} onChange={v=>setF("pagador",v)} options={[{value:"G",label:"Guilherme"},{value:"L",label:"Luan"},{value:"A",label:"Dividido (Ambos)"}]}/>
        {d.pagador === 'A' ? (
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}><FInput label="Valor do Guilherme" type="number" value={d.valorG} onChange={v=>{setF("valorG",v); setF("valor",(parseFloat(v)||0)+(parseFloat(d.valorL)||0))}}/></div>
            <div style={{flex:1}}><FInput label="Valor do Luan" type="number" value={d.valorL} onChange={v=>{setF("valorL",v); setF("valor",(parseFloat(d.valorG)||0)+(parseFloat(v)||0))}}/></div>
          </div>
        ) : ( <FInput label="Valor Total (R$)" type="number" value={d.valor} onChange={v=>setF("valor",v)} required/> )}
        <FInput label="Data do pagamento" type="date" value={d.data||today()} onChange={v=>setF("data",v)}/>
        <FInput label="Tags (separadas por vírgula)" value={d.tags} onChange={v=>setF("tags",v)} placeholder="Ex: material, urgente"/>
        <FTextarea label="Observações" value={d.obs} onChange={v=>setF("obs",v)} rows={2} placeholder="Detalhes do pagamento..."/>
        
        <div style={{marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>Comprovantes Anexos</p>
          
          {(d.anexos||[]).map((anexo, idx) => (
             <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.sLight,padding:"10px 14px",borderRadius:10,marginBottom:6}}>
               <div style={{display:"flex",alignItems:"center",gap:6, overflow:"hidden"}}>
                  <FileText size={16} color={C.success} style={{flexShrink:0}}/>
                  <p style={{fontSize:13,color:C.success,fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{anexo.nome}</p>
               </div>
               <button onClick={() => setF("anexos", d.anexos.filter((_, i) => i !== idx))} style={{background:"none",border:"none",color:C.danger,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:8}}>Remover</button>
             </div>
          ))}

          <input type="file" id="comp-upload" multiple style={{display:"none"}} onChange={handleGastoFile} />
          <label htmlFor="comp-upload" style={{width:"100%",padding:12,borderRadius:10,border:`1.5px dashed ${C.border}`,background:C.bg,color:C.text,fontSize:14,fontWeight:600,cursor:"pointer",display:isUploading?"none":"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
            <Upload size={16}/> {isUploading ? "Enviando..." : "Anexar Comprovante(s)"}
          </label>
          {isUploading && <p style={{fontSize:12, color:C.primary, textAlign:"center", marginTop:4}}>Enviando arquivo(s)...</p>}
        </div>

        <Btn label="Salvar Pagamento" onClick={saveGasto}/>
        {editing && <Btn label="Excluir lançamento" onClick={deleteGasto} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="checklist") return (
      <Sheet title={editing?"Editar Tarefa":"Nova Tarefa"} onClose={closeModal}>
        <FInput label="Tarefa / O que precisa ser feito" value={d.t} onChange={v=>setF("t",v)} required/>
        <FInput label="Depende de (descreva a condição)" value={d.dep} onChange={v=>setF("dep",v)} placeholder="ex: Reboco externo 100%"/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:C.bg,borderRadius:10}}>
          <button onClick={()=>setF("depOk",!d.depOk)} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>{d.depOk ? <CheckSquare size={22} color={C.success}/> : <Square size={22} color={C.muted}/>}</button>
          <p style={{fontSize:13,color:C.text}}>Dependência já está satisfeita</p>
        </div>
        <FInput label="Etapa relacionada" value={d.etapa} onChange={v=>setF("etapa",v)} placeholder="ex: Pintura"/>
        <FSelect label="Urgência" value={d.urg||"media"} onChange={v=>setF("urg",v)} options={URG_OPTS}/>
        <Btn label="Salvar Tarefa" onClick={saveCheck}/>
        {editing && <Btn label="Excluir tarefa" onClick={deleteCheck} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="doc") {
      return (
        <Sheet title={editing?"Editar Documento":"Novo Documento"} onClose={closeModal}>
          <FInput label="Título do documento (Identificação)" value={d.titulo} onChange={v=>setF("titulo",v)} placeholder="Ex: Contrato Pedreiro, Planta Hidráulica..." required/>
          <FInput label="Tags (separadas por vírgula)" value={d.tags} onChange={v=>setF("tags",v)} placeholder="Ex: hidraulica, projeto, urgente"/>
          
          <div style={{marginBottom:20}}>
             <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>Arquivos Anexos</p>
             
             {(d.anexos||[]).map((anexo, idx) => (
                <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.sLight,padding:"10px 14px",borderRadius:10,marginBottom:6, border:`1px solid var(--success)`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6, overflow:"hidden"}}>
                     <FileText size={16} color={C.success} style={{flexShrink:0}}/>
                     <p style={{fontSize:13,color:C.success,fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{anexo.nome}</p>
                  </div>
                  <button onClick={() => setF("anexos", d.anexos.filter((_, i) => i !== idx))} style={{background:"none",border:"none",color:C.danger,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:8}}>Remover</button>
                </div>
             ))}

             <input type="file" id="doc-upload" multiple style={{display:"none"}} onChange={handleFileChange} />
             <label htmlFor="doc-upload" style={{width:"100%",padding:20,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.6, background:C.pLight,color:C.primary,fontSize:14,fontWeight:800,cursor:"pointer",flexDirection:"column",alignItems:"center",gap:8,fontFamily:"inherit", display:isUploading?"none":"flex"}}>
               <Upload size={24}/> {isUploading ? "Enviando..." : "Anexar Arquivos"}
             </label>
             {isUploading && <p style={{fontSize:12, color:C.primary, textAlign:"center", marginTop:8}}>Enviando arquivo(s) para o servidor...</p>}
          </div>

          <FInput label="Data de envio (dd/mm/aaaa)" value={d.data} onChange={v=>setF("data",v)} placeholder="ex: 15/04/2026"/>
          {docTab==="contratos" && (
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:C.bg,borderRadius:10}}>
              <button onClick={()=>setF("ok",!d.ok)} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>{d.ok ? <CheckSquare size={22} color={C.success}/> : <Square size={22} color={C.muted}/>}</button>
              <p style={{fontSize:13,color:C.text}}>Contrato já assinado</p>
            </div>
          )}
          <Btn label="Salvar Documento" onClick={saveDoc}/>
          {editing && <Btn label="Excluir documento" onClick={excluirDocumento} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
        </Sheet>
      );
    }

    if(type==="cotacao") return (
      <Sheet title={editing?"Editar Cotação":"Nova Cotação"} onClose={closeModal}>
        <FInput label="Título / Resumo (Ex: Materiais Hidráulicos)" value={d.titulo} onChange={v=>setF("titulo",v)} required/>
        <FSelect label="Categoria" value={d.cat||CAT_OPTS[0]} onChange={v=>setF("cat",v)} options={CAT_OPTS}/>
        <FSelect label="Status da Cotação" value={d.st||"aberta"} onChange={v=>setF("st",v)} options={[{value:"aberta",label:"🟢 Em aberto (Procurando preços)"},{value:"concluida",label:"✅ Concluída (Decidido/Comprado)"}]}/>
        
        <div style={{marginBottom:14, padding:12, background:C.sLight, borderRadius:12}}>
           <p style={{fontSize:12,fontWeight:700,color:C.success,marginBottom:8}}>Itens desta Cotação</p>
           {(d.itens||[]).map((it, idx) => (
              <div key={idx} style={{display:"flex", gap:6, marginBottom:6}}>
                <input value={it.nome} onChange={e=>{
                   const n = [...(d.itens||[])]; n[idx].nome = e.target.value; setF("itens", n);
                }} placeholder="Nome do item" style={{flex:2, padding:"8px 10px", borderRadius:6, border:`1px solid var(--success)`, opacity:0.6, fontSize:13, outline:"none", fontFamily:"inherit", background:C.bg, color:C.text}}/>
                <input value={it.qtd} onChange={e=>{
                   const n = [...(d.itens||[])]; n[idx].qtd = e.target.value; setF("itens", n);
                }} placeholder="Qtd" style={{flex:1, padding:"8px 10px", borderRadius:6, border:`1px solid var(--success)`, opacity:0.6, fontSize:13, outline:"none", fontFamily:"inherit", background:C.bg, color:C.text}}/>
                <button onClick={()=>{
                   const n = [...(d.itens||[])]; n.splice(idx, 1); setF("itens", n);
                }} style={{background:"transparent", border:"none", cursor:"pointer", padding:"0 4px"}}><Trash2 size={16} color={C.danger}/></button>
              </div>
           ))}
           <div style={{display:"flex", gap:6, marginTop:8}}>
              <input value={d.tempNome||""} onChange={e=>setF("tempNome",e.target.value)} placeholder="Novo item..." style={{flex:2, padding:"8px 10px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:13, outline:"none", fontFamily:"inherit", background:C.bg, color:C.text}}/>
              <input value={d.tempQtd||""} onChange={e=>setF("tempQtd",e.target.value)} placeholder="Qtd" style={{flex:1, padding:"8px 10px", borderRadius:6, border:`1px solid ${C.border}`, fontSize:13, outline:"none", fontFamily:"inherit", background:C.bg, color:C.text}}/>
              <button onClick={()=>{
                 if(d.tempNome) {
                    setF("itens", [...(d.itens||[]), {id:uid(), nome:d.tempNome, qtd:d.tempQtd||"1"}]);
                    setF("tempNome",""); setF("tempQtd","");
                 }
              }} style={{background:C.success, color:"#fff", border:"none", borderRadius:6, padding:"0 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"}}>Add</button>
           </div>
        </div>
        <Btn label="Salvar Cotação" onClick={saveCotacao}/>
        {editing && <Btn label="Excluir cotação" onClick={deleteCotacao} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="fornecedor") return (
      <Sheet title={editing?"Editar Fornecedor":"Novo Fornecedor"} onClose={closeModal}>
        <FInput label="Fornecedor / Loja" value={d.nome} onChange={v=>setF("nome",v)} required/>
        <div style={{display:"flex", gap:10}}>
          <div style={{flex:1}}><FInput label="Preço à Vista (R$)" type="number" value={d.precoVista} onChange={v=>setF("precoVista",v)} required/></div>
          <div style={{flex:1}}><FInput label="Preço a Prazo (R$)" type="number" value={d.precoPrazo} onChange={v=>setF("precoPrazo",v)}/></div>
        </div>
        <FInput label="Validade do orçamento" value={d.val} onChange={v=>setF("val",v)} placeholder="ex: 30/05/2026"/>
        <FTextarea label="Observações" value={d.obs} onChange={v=>setF("obs",v)} rows={2}/>
        <Btn label="Salvar Fornecedor" onClick={saveForn}/>
        {editing && <Btn label="Excluir fornecedor" onClick={deleteForn} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="contato") return (
      <Sheet title={editing?"Editar Contato":"Novo Contato"} onClose={closeModal}>
        <FInput label="Nome" value={d.nome} onChange={v=>setF("nome",v)} required/>
        <FInput label="Função / Papel" value={d.papel} onChange={v=>setF("papel",v)} placeholder="ex: Empreiteiro, Arquiteto..."/>
        <FInput label="Telefone" value={d.tel} onChange={v=>setF("tel",v)} placeholder="(11) 99999-9999"/>
        <FInput label="E-mail" type="email" value={d.email} onChange={v=>setF("email",v)}/>
        
        <div style={{marginBottom:14}}><p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>Cor do avatar</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{COR_OPTS.map(cor=>(<button key={cor} onClick={(e)=>{e.preventDefault();setF("cor",cor);}} style={{width:34,height:34,borderRadius:"50%",background:cor,border:`3px solid ${d.cor===cor?"var(--text)":"transparent"}`,cursor:"pointer"}}/>))}</div></div>
        
        <div style={{background:C.bg, padding:14, borderRadius:12, marginBottom:14, border:`1px solid ${C.border}`}}>
           <div style={{display:"flex",alignItems:"center",gap:8, marginBottom: d.prestou?12:0}}>
              <button onClick={(e)=>{e.preventDefault(); setF("prestou",!d.prestou);}} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
                 {d.prestou ? <CheckSquare size={22} color={C.primary}/> : <Square size={22} color={C.muted}/>}
              </button>
              <p style={{fontSize:14,fontWeight:700,color:C.text}}>Já prestou serviço na obra?</p>
           </div>
           {d.prestou && (
              <div>
                 <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>Avaliação do Serviço prestado</p>
                 <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(v => (
                       <Star key={v} size={28} fill={d.nota>=v ? C.warning : "none"} color={d.nota>=v ? C.warning : C.muted} onClick={(e)=>{e.preventDefault(); setF("nota",v);}} style={{cursor:"pointer"}}/>
                    ))}
                 </div>
              </div>
           )}
        </div>
        <FTextarea label="Observações sobre o contato" value={d.obs} onChange={v=>setF("obs",v)} rows={3} placeholder="Ex: Preferir ligar de manhã..."/>

        <Btn label="Salvar Contato" onClick={saveContato}/>
        {editing && <Btn label="Excluir contato" onClick={deleteContato} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
      </Sheet>
    );

    if(type==="manage_cats") {
      const safeCats = ideiaCats || [];
      return (
        <Sheet title="Gerenciar Categorias (Ideias)" onClose={closeModal}>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={newCatInput} onChange={e=>setNewCatInput(e.target.value)} placeholder="Nova categoria..." 
                   style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,outline:"none",fontFamily:"inherit",background:C.bg,color:C.text}}/>
            <button onClick={async ()=>{
              const val = newCatInput?.trim();
              if(val){
                if(!safeCats.find(c=>c?.nome?.toLowerCase() === val.toLowerCase())) {
                   const item = {id:uid(), nome:val, ativa:true};
                   await setDoc(doc(db, "ideiaCats", item.id.toString()), JSON.parse(JSON.stringify(item)));
                }
                setNewCatInput("");
              }
            }} style={{padding:"0 16px",borderRadius:10,background:C.primary,color:"#fff",fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Adicionar</button>
          </div>
          <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>CATEGORIAS EXISTENTES</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {safeCats.map(c => (
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.bg,borderRadius:10,border:`1px solid ${C.border}`}}>
                <input value={c.nome} onChange={async e=>{
                   await setDoc(doc(db, "ideiaCats", c.id.toString()), JSON.parse(JSON.stringify({...c, nome:e.target.value})));
                   ideias.forEach(async i => {
                     if(i.cat===c.nome) await setDoc(doc(db, "ideias", i.id.toString()), JSON.parse(JSON.stringify({...i, cat:e.target.value})));
                   });
                }} style={{border:"none",background:"transparent",fontSize:14,fontWeight:700,color:c.ativa?C.text:C.muted,textDecoration:c.ativa?"none":"line-through",outline:"none",flex:1,fontFamily:"inherit"}}/>
                <button onClick={async ()=>await setDoc(doc(db, "ideiaCats", c.id.toString()), JSON.parse(JSON.stringify({...c, ativa:!c.ativa})))} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,color:c.ativa?C.danger:C.success,fontFamily:"inherit"}}>
                  {c.ativa ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        </Sheet>
      );
    }

    if(type==="ideia") {
      const toggleTag = (tg) => {
        const curr = d.tags || [];
        if(curr.includes(tg)) setF("tags", curr.filter(x=>x!==tg));
        else setF("tags", [...curr, tg]);
      };
      const addNewTag = async (e) => {
        e.preventDefault();
        const nt = prompt("Digite a nova tag (ex: 🔴 Urgente):");
        if(nt && nt.trim() && !(ideiaTags||[]).includes(nt.trim())) {
           await setDoc(doc(db, "meta", "ideiaTags"), JSON.parse(JSON.stringify({ tags: [...(ideiaTags||[]), nt.trim()] })));
           toggleTag(nt.trim());
        } else if (nt && nt.trim()) { toggleTag(nt.trim()); }
      };
      const addLink = (e) => { e.preventDefault(); setF("links", [...(d.links||[]), ""]); };
      const updateLink = (idx, val) => { const nv = [...(d.links||[])]; nv[idx] = val; setF("links", nv); };
      const removeLink = (idx) => { const nv = [...(d.links||[])]; nv.splice(idx, 1); setF("links", nv); };
      const activeCats = (ideiaCats||[]).filter(c=>c.ativa);

      return (
        <Sheet title={editing?"Editar Ideia":"Nova Ideia"} onClose={closeModal}>
          <FInput label="Título da Ideia" value={d.t} onChange={v=>setF("t",v)} required placeholder="Ex: Bancada de mármore"/>
          <FTextarea label="Descrição Detalhada" value={d.desc} onChange={v=>setF("desc",v)} rows={3} placeholder="Escreva os detalhes..."/>
          <FSelect label="Categoria" value={d.cat||(activeCats[0]?.nome||"Outros")} onChange={v=>setF("cat",v)} options={activeCats.map(c=>({value:c.nome, label:c.nome}))}/>
          <div style={{marginBottom:14}}>
            <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>Tags</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(ideiaTags||[]).map(tg=>(
                <button key={tg} onClick={(e)=>{e.preventDefault(); toggleTag(tg);}} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${d.tags?.includes(tg)?C.primary:C.border}`,background:d.tags?.includes(tg)?C.pLight:C.bg,color:d.tags?.includes(tg)?C.primary:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{tg}</button>
              ))}
              <button onClick={addNewTag} style={{padding:"6px 12px",borderRadius:20,border:`1.5px dashed ${C.primary}`,background:"transparent",color:C.primary,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Nova Tag</button>
            </div>
          </div>
          
          <div style={{marginBottom:14}}>
             <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:6}}>Imagens e Anexos</p>
             {(d.anexos||[]).map((anexo, idx) => (
                <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.sLight,padding:"10px 14px",borderRadius:10,marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6, overflow:"hidden"}}>
                     <FileText size={16} color={C.success} style={{flexShrink:0}}/>
                     <p style={{fontSize:13,color:C.success,fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{anexo.nome}</p>
                  </div>
                  <button onClick={() => setF("anexos", d.anexos.filter((_, i) => i !== idx))} style={{background:"none",border:"none",color:C.danger,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:8}}>Remover</button>
                </div>
             ))}

             <input type="file" id="ideia-upload" multiple style={{display:"none"}} onChange={handleIdeiaFile} />
             <label htmlFor="ideia-upload" style={{width:"100%",padding:12,borderRadius:10,border:`1.5px dashed ${C.border}`,background:C.bg,color:C.text,fontSize:14,fontWeight:600,cursor:"pointer",display:isUploading?"none":"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
               <Upload size={16}/> {isUploading ? "Enviando..." : "Anexar Imagem ou Arquivo"}
             </label>
             {isUploading && <p style={{fontSize:12, color:C.primary, textAlign:"center", marginTop:4}}>Enviando arquivo(s)...</p>}
          </div>

          <div style={{marginBottom:14}}>
            <p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>Links de Referência</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(d.links||[]).map((lk, idx) => (
                <div key={idx} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input value={lk} onChange={e=>updateLink(idx, e.target.value)} placeholder="https://..." style={{flex:1,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:14,outline:"none",background:C.bg,color:C.text,fontFamily:"inherit"}}/>
                  <button onClick={(e)=>{e.preventDefault(); removeLink(idx);}} style={{background:"none",border:"none",padding:6,cursor:"pointer"}}><Trash2 size={18} color={C.danger}/></button>
                </div>
              ))}
              <button onClick={addLink} style={{padding:"10px",borderRadius:10,border:`1.5px dashed ${C.border}`,background:C.bg,color:C.muted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><LinkIcon size={14}/> Adicionar Link</button>
            </div>
          </div>
          <div style={{marginBottom:14}}><p style={{fontSize:12,fontWeight:700,color:C.muted,marginBottom:8}}>Cor do cartão</p><div style={{display:"flex",gap:8}}>{IDEIA_COLS.map((cor, i)=>(<button key={i} onClick={(e)=>{e.preventDefault(); setF("cor",cor);}} style={{width:34,height:34,borderRadius:9,background:cor,border:`2.5px solid ${d.cor===cor?C.primary:"var(--border)"}`,cursor:"pointer"}}/>))}</div></div>
          <Btn label="Salvar Ideia" onClick={saveIdeia}/>
          {editing && <Btn label="Excluir ideia" onClick={deleteIdeia} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
        </Sheet>
      );
    }

    if(type==="tarefa") return (
       <Sheet title={editing?"Editar Tarefa":"Nova Tarefa"} onClose={closeModal}>
         <FInput label="O que precisa ser feito?" value={d.t} onChange={v=>setF("t",v)} required/>
         <FInput label="Executor (Quem vai fazer?)" value={d.executor} onChange={v=>setF("executor",v)} placeholder="Ex: Luan, Mestre de Obras..."/>
         <FInput label="Prazo (Data limite)" type="date" value={d.prazo} onChange={v=>setF("prazo",v)}/>
         <FTextarea label="Observação" value={d.obs} onChange={v=>setF("obs",v)} rows={2} placeholder="Detalhes, orientações ou links..."/>
         <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 12px",background:C.bg,borderRadius:10}}>
           <button onClick={()=>setF("done",!d.done)} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>{d.done ? <CheckSquare size={22} color={C.success}/> : <Square size={22} color={C.muted}/>}</button>
           <p style={{fontSize:13,color:C.text}}>Marcar como concluída</p>
         </div>
         <Btn label="Salvar Tarefa" onClick={async ()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, done:!!d.done, obs:d.obs||""};
           if(!editing) item.id = uid();
           await setDoc(doc(db, "tarefas", item.id.toString()), JSON.parse(JSON.stringify(item)));
           logChange(editing ? `Editou a tarefa "${d.t}"` : `Criou a tarefa "${d.t}"`); closeModal();
         }}/>
         {editing && <Btn label="Excluir tarefa" onClick={async ()=>{await deleteDoc(doc(db, "tarefas", d.id.toString())); logChange(`Excluiu a tarefa "${d.t}"`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
       </Sheet>
    );

    if(type==="anotacao") return (
       <Sheet title={editing?"Editar Anotação":"Nova Anotação"} onClose={closeModal}>
         <FInput label="Título / Assunto" value={d.t} onChange={v=>setF("t",v)} required placeholder="Ex: Ideias para o quintal"/>
         <FTextarea label="Anotação Completa" value={d.desc} onChange={v=>setF("desc",v)} rows={6} placeholder="Escreva informações, lembretes, medidas..."/>
         <Btn label="Salvar Anotação" onClick={async ()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, data: d.data||todayFmt()};
           if(!editing) item.id = uid();
           await setDoc(doc(db, "anotacoes", item.id.toString()), JSON.parse(JSON.stringify(item)));
           logChange(editing ? `Editou a anotação "${d.t}"` : `Criou a anotação "${d.t}"`); closeModal();
         }}/>
         {editing && <Btn label="Excluir anotação" onClick={async ()=>{await deleteDoc(doc(db, "anotacoes", d.id.toString())); logChange(`Excluiu a anotação "${d.t}"`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
       </Sheet>
    );

    if(type==="pastaGaleria") return (
       <Sheet title={editing?"Editar Pasta":"Nova Pasta de Fotos"} onClose={closeModal}>
         <FInput label="Nome da Pasta (ex: Fundação, Setembro 2026...)" value={d.nome} onChange={v=>setF("nome",v)} required/>
         <Btn label="Salvar Pasta" onClick={savePastaGaleria}/>
         {editing && <Btn label="Excluir pasta e fotos" onClick={deletePastaGaleria} color={C.danger} outline icon={<Trash2 size={15}/>}/>}
       </Sheet>
    );
    
    return null;
  };

  /* ─── COTAÇÃO EXPORT OVERLAY ─── */
  const renderExportOverlay = () => {
    if (!exportingCot) return null;
    const q = exportingCot;
    const best = q.forn?.find(f=>f.best);
    const displayedForn = exportOpts.includeOthers ? q.forn : [];
    
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,gap:16, overflowY:"auto"}}>
        <div style={{width:"100%",maxWidth:520,background:C.card,borderRadius:16,padding:20,boxShadow:"0 10px 40px rgba(0,0,0,0.3)"}}>
           <p style={{fontSize:14, fontWeight:800, color:C.text, marginBottom:12}}>Opções de Envio</p>
           <div style={{display:"flex", flexDirection:"column", gap:12}}>
              <label style={{display:"flex", alignItems:"center", gap:10, cursor:"pointer"}}>
                 <input type="checkbox" checked={exportOpts.includeOthers} onChange={e=>setExportOpts(p=>({...p, includeOthers:e.target.checked}))} style={{width:18,height:18}} />
                 <span style={{fontSize:13, color:C.text, fontWeight:600}}>Incluir preços de outros fornecedores na imagem</span>
              </label>
              <div>
                 <p style={{fontSize:11, color:C.muted, fontWeight:700, marginBottom:4}}>PRAZO PARA RETORNO (OPCIONAL)</p>
                 <input type="text" placeholder="Ex: 24h, 2 dias, 15/06..." value={exportOpts.deadline} onChange={e=>setExportOpts(p=>({...p, deadline:e.target.value}))} 
                        style={{width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, background:C.bg, color:C.text, outline:"none"}} />
              </div>
           </div>
        </div>

        <div style={{width:"100%",maxWidth:520,background:"#fff",borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
          <div ref={cotacaoExportRef} style={{background:"#ffffff",padding:32,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,paddingBottom:20,borderBottom:"2px solid #f0e9e0"}}>
              <div>
                <div style={{fontSize:28,marginBottom:4}}>🏗️</div>
                <p style={{fontSize:20,fontWeight:900,color:"#1A120D",letterSpacing:-0.5}}>Minha Obra</p>
                <p style={{fontSize:11,color:"#8C7A6E",fontWeight:600}}>CASA DOS SONHOS</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:11,color:"#8C7A6E",fontWeight:600}}>PEDIDO DE COTAÇÃO</p>
                <p style={{fontSize:13,fontWeight:700,color:"#1A120D"}}>{new Date().toLocaleDateString("pt-BR")}</p>
                <p style={{fontSize:11,color:"#B8622A",fontWeight:700,marginTop:4}}>{q.cat}</p>
              </div>
            </div>

            <p style={{fontSize:18,fontWeight:800,color:"#1A120D",marginBottom:6}}>{q.titulo}</p>
            <p style={{fontSize:12,color:"#8C7A6E",marginBottom:20}}>Solicitamos orçamento para os itens abaixo. Por favor, preencha os valores e retorne.</p>

            {q.itens && q.itens.length > 0 && (
              <div style={{marginBottom:24}}>
                <p style={{fontSize:11,fontWeight:700,color:"#B8622A",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Itens da Cotação</p>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:"#F4EFE8"}}>
                      <th style={{textAlign:"left",padding:"8px 10px",fontSize:11,fontWeight:700,color:"#8C7A6E",borderRadius:"6px 0 0 6px"}}>Item</th>
                      <th style={{textAlign:"right",padding:"8px 10px",fontSize:11,fontWeight:700,color:"#8C7A6E"}}>Qtd</th>
                      <th style={{textAlign:"right",padding:"8px 10px",fontSize:11,fontWeight:700,color:"#8C7A6E",borderRadius:"0 6px 6px 0"}}>Preço Unit (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.itens.map((it,i) => (
                      <tr key={i} style={{borderBottom:"1px solid #F4EFE8"}}>
                        <td style={{padding:"10px 10px",fontSize:13,color:"#1A120D",fontWeight:600}}>{it.nome}</td>
                        <td style={{padding:"10px 10px",fontSize:13,color:"#8C7A6E",textAlign:"right"}}>{it.qtd}</td>
                        <td style={{padding:"10px 10px",fontSize:13,color:"#1A120D",textAlign:"right",borderLeft:"2px dashed #F4EFE8"}}>__________</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {displayedForn.length > 0 && (
              <div style={{marginBottom:24}}>
                <p style={{fontSize:11,fontWeight:700,color:"#4A7A56",marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Propostas Recebidas</p>
                {displayedForn.map(f => (
                  <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:8,marginBottom:6,background:f.best?"#E3F0E8":"#F4EFE8",border:f.best?"1.5px solid #4A7A56":"1px solid #E8DDD3"}}>
                    <p style={{fontSize:13,fontWeight:700,color:"#1A120D"}}>{f.best && <span style={{color:"#4A7A56"}}>✦ </span>}{f.nome}</p>
                    <p style={{fontSize:14,fontWeight:800,color:f.best?"#4A7A56":"#1A120D"}}>R$ {Number(f.precoVista).toFixed(2).replace(".",",")}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={{borderTop:"1px solid #E8DDD3",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p style={{fontSize:11,color:"#8C7A6E"}}>Validade da proposta: <strong>30 dias</strong></p>
                <p style={{fontSize:11,color:"#8C7A6E"}}>Retornar até: <strong>{exportOpts.deadline || new Date(Date.now()+7*86400000).toLocaleDateString("pt-BR")}</strong></p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:10,color:"#B8622A",fontWeight:700}}>🏗️ Minha Obra App</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:12,width:"100%",maxWidth:520, paddingBottom:20}}>
          <button onClick={()=>setExportingCot(null)} style={{flex:1,padding:"14px",borderRadius:12,border:"none",background:"rgba(255,255,255,0.15)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
            ✕ Cancelar
          </button>
          <button onClick={baixarImagemCotacao} style={{flex:2,padding:"14px",borderRadius:12,border:"none",background:"#B8622A",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <Download size={18}/> Baixar Imagem PNG
          </button>
        </div>
      </div>
    );
  };

  /* ─── IMAGE VIEWER OVERLAY ─── */
  const renderImageViewer = () => {
     if(!viewerImage) return null;
     const { fotos, index } = viewerImage;
     if(!fotos || fotos.length === 0) return null;
     const foto = fotos[index];
     
     return (
       <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}>
         <div style={{position:"absolute",top:20,right:20,display:"flex",gap:16}}>
           <button onClick={()=>setViewerImage(null)} style={{background:"none",border:"none",color:"#fff",cursor:"pointer"}}><X size={30}/></button>
         </div>
         <p style={{position:"absolute",top:25,left:20,color:"#fff",fontSize:14,fontWeight:700}}>{index + 1} / {fotos.length}</p>

         <img src={foto.url} style={{maxWidth:"100%",maxHeight:"80vh",objectFit:"contain"}} alt={foto.nome}/>
         <p style={{position:"absolute",bottom:30,color:"#fff",fontSize:13, opacity:0.8}}>{foto.data} - {foto.nome}</p>

         {index > 0 && <button onClick={()=>setViewerImage({...viewerImage, index: index-1})} style={{position:"absolute",left:20,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",padding:10,color:"#fff",cursor:"pointer"}}><ChevronLeft size={30}/></button>}
         {index < fotos.length - 1 && <button onClick={()=>setViewerImage({...viewerImage, index: index+1})} style={{position:"absolute",right:20,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",padding:10,color:"#fff",cursor:"pointer"}}><ChevronRight size={30}/></button>}
       </div>
     );
  };

  /* ═══════════════════════════════════
     VIEW RENDERERS
  ═══════════════════════════════════ */

  if(!user) {
    return (
      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20}} data-theme={isDark?"dark":"light"}>
        <style>{themeStyles}</style>
        <Card style={{width:"100%", maxWidth:360, padding:"30px 20px", textAlign:"center"}}>
           <div style={{fontSize:50, marginBottom:10}}>🏗️</div>
           <p style={{fontSize:24, fontWeight:900, color:C.text, letterSpacing:-0.5, marginBottom:4}}>Minha Obra</p>
           <p style={{fontSize:13, color:C.muted, marginBottom:30}}>Faça login para acessar o projeto.</p>
           
           <div style={{textAlign:"left"}}>
              <FInput label="Usuário" value={loginUser} onChange={setLoginUser} placeholder="Luan ou Guilherme" />
              <FInput label="Senha" type="password" value={loginPass} onChange={setLoginPass} placeholder="Digite sua senha" />
              {loginError && <p style={{color:C.danger, fontSize:13, fontWeight:700, marginBottom:10}}>{loginError}</p>}
           </div>

           <Btn label="Entrar" onClick={handleLogin} />
           
           <button onClick={()=>setIsDark(!isDark)} style={{marginTop:20, background:"none", border:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", cursor:"pointer", color:C.muted, fontSize:13, fontWeight:600}}>
              {isDark ? <Sun size={16}/> : <Moon size={16}/>} 
              Mudar para tema {isDark ? "Claro" : "Escuro"}
           </button>
        </Card>
      </div>
    );
  }

  const GastoItem = ({g, e}) => {
    const anexos = g.anexos && g.anexos.length > 0 ? g.anexos : (g.comp ? [{nome: g.comp, url: g.compUrl}] : []);
    
    return (
      <div style={{padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
          <div style={{flex:1, paddingRight:10}}>
            <p style={{fontSize:14,fontWeight:800,color:C.text}}>{g.desc}</p>
            {e && <p style={{fontSize:11,fontWeight:700,color:C.primary,marginTop:2}}>{e.emoji} {e.nome}</p>}
            {g.recebedor && <p style={{fontSize:11,color:C.muted,marginTop:2}}>Recebedor: <strong>{g.recebedor}</strong></p>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:15,fontWeight:800,color:C.text}}>{fmt(g.valor)}</p>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,marginTop:2}}>
                <User size={10} color={C.muted}/>
                <p style={{fontSize:10,color:C.muted,fontWeight:600}}>{g.pagador === 'G' ? "Gui pagou" : g.pagador === 'L' ? "Luan pagou" : "Dividido"}</p>
              </div>
            </div>
            <SmBtn onClick={()=>{ if(viewGastos) { setViewGastos(null); setTimeout(()=>openEdit("gasto",{...g,etapaId:e.id},e.id),100); } else { openEdit("gasto",{...g,etapaId:e.id},e.id); } }} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
          </div>
        </div>
        {g.tags && (<div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>{g.tags.split(',').map(t=> <Badge key={t} label={t.trim()} color={C.primary} bg={C.pLight}/>)}</div>)}
        {g.obs && (<div style={{marginTop:8,background:C.wLight,padding:"8px 10px",borderRadius:8,border:`1px solid var(--warning)`, opacity:0.8}}><p style={{fontSize:11,color:C.text}}>💬 <strong>Obs:</strong> {g.obs}</p></div>)}
        
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
          <p style={{fontSize:11,color:C.muted,fontWeight:600}}>Data: {g.data}</p>
        </div>
        
        {anexos.length > 0 && (
          <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {anexos.map((a, idx) => (
               <button key={idx} onClick={(ev) => { ev.stopPropagation(); if(a.url) window.open(a.url, '_blank'); else alert("URL indisponível"); }} style={{display:"flex",alignItems:"center",gap:4,background:C.sLight,border:`1px solid var(--success)`, opacity:0.8, padding:"4px 10px",borderRadius:6,color:C.success,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  <Download size={12}/> {a.nome}
               </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDash = () => (
    <div style={{padding:"0 16px 16px"}}>
      <Card style={{background:`linear-gradient(135deg,${C.primary} 0%,#8C4320 100%)`,color:"#fff",marginBottom:12}}>
        <p style={{fontSize:12,opacity:.8,marginBottom:2,fontWeight:500}}>OBRA TOTAL</p>
        <p style={{fontSize:36,fontWeight:900,letterSpacing:-1,marginBottom:4}}>{pctObra}%</p>
        <p style={{fontSize:13,opacity:.85,marginBottom:12}}>concluído • previsão Dez/2026</p>
        <div style={{background:"rgba(255,255,255,0.2)",borderRadius:8,height:8,overflow:"hidden"}}><div style={{width:`${pctObra}%`,height:"100%",background:"#fff",borderRadius:8,transition:"width 0.8s"}}/></div>
      </Card>
      
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {[{label:"Gasto total",val:fmt(totalReal),sub:`de ${fmtK(totalOrc)}`,color:C.primary},{label:"Saldo restante",val:fmtK(totalOrc-totalReal),sub:`${100-pctGasto}% disponível`,color:C.success},{label:"Em andamento",val:`${emAndamento.length} etapas`,sub:emAndamento.map(e=>e.nome).join(", ")||"—",color:C.warning},{label:"Etapas concluídas",val:`${etapas.filter(e=>e.st==="ok").length} de ${etapas.length}`,sub:"fases da obra",color:C.secondary}].map((s,i)=>(
          <Card key={i} style={{padding:14}}>
            <p style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:4}}>{s.label}</p>
            <p style={{fontSize:18,fontWeight:800,color:s.color,marginBottom:2}}>{s.val}</p>
            <p style={{fontSize:11,color:C.muted,lineHeight:1.3}}>{s.sub}</p>
          </Card>
        ))}
      </div>
      
      <STitle>Ações rápidas</STitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
        {[
          {label:"Lançar gasto",emoji:"💰",bg:C.pLight,action:()=>openAdd("gasto",{etapaId:etapas[0]?.id})},
          {label:"Evolução",emoji:"📸",bg:C.sLight,action:()=>setTab("galeria")},
          {label:"Anotar ideia",emoji:"💡",bg:C.wLight,action:()=>{setTab("mais");setMaisTab("ideias");setTimeout(()=>openAdd("ideia",{cat:(ideiaCats||[]).find(c=>c.ativa)?.nome||"Outros",cor:IDEIA_COLS[0],tags:[],links:[]}),200)}},
          {label:"Nova tarefa",emoji:"📋",bg:C.dLight,action:()=>{setTab("mais");setMaisTab("tarefas");setTimeout(()=>openAdd("tarefa",{done:false}),200)}},
          {label:"Nova cotação",emoji:"🛒",bg:C.sLight,action:()=>{setTab("cotacoes");setTimeout(()=>openAdd("cotacao",{cat:CAT_OPTS[0]}),200)}},
          {label:"Nova etapa",emoji:"🏗️",bg:C.pLight,action:()=>openAdd("etapa",{emoji:"🏗️",st:"wait",pct:0,dataIniEst:todayYM(),durEst:2,dataIniReal:"",durReal:0})},
        ].map((a,i)=>(
          <Card key={i} style={{padding:"14px 10px",textAlign:"center",background:a.bg,cursor:"pointer"}} onClick={a.action}>
            <p style={{fontSize:24,marginBottom:6}}>{a.emoji}</p>
            <p style={{fontSize:11,fontWeight:700,color:C.text}}>{a.label}</p>
          </Card>
        ))}
      </div>
      
      <STitle>Etapas da obra</STitle>
      <Card>
        {etapas.map((e,i)=>(
          <div key={e.id} style={{marginBottom:i<etapas.length-1?14:0}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <p style={{fontSize:13,fontWeight:600,color:e.st==="wait"?C.muted:C.text}}>{e.emoji} {e.nome}</p>
              <p style={{fontSize:12,fontWeight:700,color:e.st==="ok"?C.success:e.st==="run"?C.primary:C.muted}}>{e.pct}%</p>
            </div>
            <div style={{background:C.border,borderRadius:6,height:6,overflow:"hidden"}}>
              <div style={{width:`${e.pct}%`,height:"100%",borderRadius:6,background:e.st==="ok"?C.success:e.st==="run"?C.primary:"transparent"}}/>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );

  const renderFin = () => {
    const pseudoOutros = {id:999, nome:"Outros Lançamentos", emoji:"🧾", gastos: outrosGastos, orc:0};
    const rOutros = outrosGastos.reduce((s,g)=>s+g.valor,0);

    const allGastos = [
       ...etapas.flatMap(e => e.gastos.map(g => ({...g, etapaObj: e}))),
       ...outrosGastos.map(g => ({...g, etapaObj: pseudoOutros}))
    ];
    
    const filteredGastos = searchGasto ? allGastos.filter(g => g.desc.toLowerCase().includes(searchGasto.toLowerCase()) || (g.recebedor && g.recebedor.toLowerCase().includes(searchGasto.toLowerCase())) || (g.tags && g.tags.toLowerCase().includes(searchGasto.toLowerCase())) || (g.obs && g.obs.toLowerCase().includes(searchGasto.toLowerCase()))) : [];
    
    return (
      <div style={{padding:"0 16px 16px"}}>
        <Card style={{background:C.card, padding:14, marginBottom:16}}>
           <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14}}>
              <STitle style={{marginBottom:0}}>Resumo de Gastos</STitle>
              <button onClick={()=>setShowAllPayments(!showAllPayments)} style={{padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:showAllPayments?C.pLight:C.bg, color:showAllPayments?C.primary:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"}}>
                 {showAllPayments ? "Ver por etapas" : "Ver todos pagamentos"}
              </button>
           </div>
           
           {!showAllPayments ? (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:6}}>
                  <p style={{fontSize:28,fontWeight:900,color:C.text}}>{fmt(totalReal)}</p>
                  <p style={{fontSize:13,fontWeight:700,color:C.muted}}>de {fmt(totalOrc)}</p>
                </div>
                <div style={{background:C.border,borderRadius:8,height:10,overflow:"hidden",marginBottom:6}}><div style={{width:`${pctGasto}%`,height:"100%",background:pctGasto>90?C.danger:C.primary,borderRadius:8}}/></div>
                <div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:12,color:C.muted}}>{pctGasto}% do orçamento</p><p style={{fontSize:12,fontWeight:700,color:C.success}}>{fmt(totalOrc-totalReal)} disponíveis</p></div>
              </>
           ) : (
              <div style={{background:C.bg, borderRadius:12, padding:12}}>
                 <p style={{fontSize:12, fontWeight:700, color:C.muted, marginBottom:10}}>TODOS OS LANÇAMENTOS ({etapas.reduce((s,e)=>s+(e.gastos?.length||0),0) + outrosGastos.length})</p>
                 <div style={{maxHeight:400, overflowY:"auto"}}>
                    {[...etapas.flatMap(e=>e.gastos.map(g=>({...g, etapaNome:e.nome, emoji:e.emoji}))), ...outrosGastos.map(g=>({...g, etapaNome:"Outros", emoji:"🧾"}))]
                      .sort((a,b)=> new Date(b.data.split("/").reverse().join("-")) - new Date(a.data.split("/").reverse().join("-")))
                      .map(g => (
                        <div key={g.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`}}>
                           <div style={{flex:1, paddingRight:10}}>
                              <p style={{fontSize:13, fontWeight:700, color:C.text}}>{g.desc}</p>
                              <p style={{fontSize:11, color:C.muted}}>{g.emoji} {g.etapaNome} • {g.data}</p>
                           </div>
                           <p style={{fontSize:14, fontWeight:800, color:C.primary}}>{fmt(g.valor)}</p>
                        </div>
                      ))
                    }
                 </div>
              </div>
           )}
        </Card>

        <Card style={{marginBottom:12, padding:"14px 16px", border:`1px solid var(--primary)`, opacity:0.9}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}><Users size={18} color={C.primary}/><p style={{fontSize:13, fontWeight:800, color:C.text}}>Acerto de Contas</p></div>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}>
            <div><p style={{fontSize:11, color:C.muted, fontWeight:600}}>GUILHERME PAGOU</p><p style={{fontSize:18, fontWeight:800, color:C.text}}>{fmt(totalG)}</p></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:11, color:C.muted, fontWeight:600}}>LUAN PAGOU</p><p style={{fontSize:18, fontWeight:800, color:C.text}}>{fmt(totalL)}</p></div>
          </div>
          <div style={{background:totalG === totalL ? C.sLight : C.wLight, borderRadius:10, padding:"10px 12px", textAlign:"center"}}>
            <p style={{fontSize:13, color:totalG === totalL ? C.success : C.warning, fontWeight:800}}>
              {totalG > totalL ? `Guilherme pagou ${fmt(totalG - totalL)} a mais que Luan` : totalL > totalG ? `Luan pagou ${fmt(totalL - totalG)} a mais que Guilherme` : "Tudo certo! Gastos iguais."}
            </p>
          </div>
        </Card>
        
        <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.03)"}}>
          <Search size={18} color={C.primary}/>
          <input value={searchGasto} onChange={e=>setSearchGasto(e.target.value)} placeholder="Buscar pagamentos..." style={{border:"none",outline:"none",fontSize:14,color:C.text,background:"transparent",flex:1,fontFamily:"inherit"}}/>
          {searchGasto && <button onClick={()=>setSearchGasto("")} style={{background:"none",border:"none",padding:4,cursor:"pointer"}}><X size={16} color={C.muted}/></button>}
        </div>
        
        {searchGasto ? (
          <Card style={{marginBottom:8, padding:"4px 14px"}}>
            {filteredGastos.length === 0 ? (<p style={{textAlign:"center",color:C.muted,padding:"20px 0"}}>Nenhum pagamento encontrado.</p>) : (filteredGastos.map(g => <GastoItem key={g.id} g={g} e={g.etapaObj} />))}
          </Card>
        ) : (
          <>
            <button onClick={()=>openAdd("gasto",{etapaId:etapas[0]?.id})} style={{width:"100%",padding:13,borderRadius:12,border:"none",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16,fontFamily:"inherit"}}><Plus size={16}/> Lançar novo pagamento</button>
            <STitle>Orçado × Realizado por etapa</STitle>
            {etapas.map(e=>{
              const r=real(e); const over=r>e.orc&&r>0; const pct=pBar(r,e.orc);
              return (
                <Card key={e.id} style={{marginBottom:8,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <p style={{fontSize:13,fontWeight:700,color:C.text}}>{e.emoji} {e.nome}</p>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {over && <Badge label={`+${fmt(r-e.orc)}`} color={C.danger} bg={C.dLight}/>}
                      <SmBtn onClick={()=>openAdd("gasto",{etapaId:e.id})} bg={C.pLight}><Plus size={13} color={C.primary}/></SmBtn>
                      <SmBtn onClick={()=>setViewGastos(e)} bg={C.bg}><Eye size={13} color={C.muted}/></SmBtn>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:6}}><p style={{fontSize:11,color:C.muted}}>Orç: <strong style={{color:C.text}}>{fmtK(e.orc)}</strong></p><p style={{fontSize:11,color:C.muted}}>Real: <strong style={{color:over?C.danger:C.text}}>{fmtK(r)}</strong></p></div>
                  <div style={{background:C.border,borderRadius:6,height:6,overflow:"hidden"}}><div style={{width:`${Math.min(100,pct)}%`,height:"100%",borderRadius:6,background:over?C.danger:e.st==="ok"?C.success:C.primary}}/></div>
                </Card>
              );
            })}
            
            <Card key={999} style={{marginBottom:8,padding:"12px 14px", border:`1px dashed ${C.border}`, background:C.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <p style={{fontSize:13,fontWeight:700,color:C.text}}>🧾 Outros Lançamentos</p>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <SmBtn onClick={()=>openAdd("gasto",{etapaId:999})} bg={C.card}><Plus size={13} color={C.primary}/></SmBtn>
                  <SmBtn onClick={()=>setViewGastos(pseudoOutros)} bg={C.card}><Eye size={13} color={C.muted}/></SmBtn>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:0}}>
                <p style={{fontSize:11,color:C.muted}}>Impostos, lote, etc. Total: <strong style={{color:C.text}}>{fmtK(rOutros)}</strong></p>
              </div>
            </Card>
          </>
        )}
        
        {viewGastos && (
          <Sheet title={`${viewGastos.emoji} ${viewGastos.nome} — Pagamentos`} onClose={()=>setViewGastos(null)}>
            <button onClick={()=>{setViewGastos(null);setTimeout(()=>openAdd("gasto",{etapaId:viewGastos.id}),100);}} style={{width:"100%",padding:12,borderRadius:10,border:"none",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}><Plus size={14}/> Novo pagamento</button>
            <div style={{background:C.card, borderRadius:12}}>
              {viewGastos.gastos.length===0 && <p style={{textAlign:"center",color:C.muted,padding:"20px 0"}}>Nenhum pagamento lançado ainda.</p>}
              {viewGastos.gastos.map(g => <GastoItem key={g.id} g={g} e={viewGastos} />)}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"16px 0 0 0", marginTop:10, borderTop:`1.5px solid ${C.border}`}}>
              <p style={{fontSize:14,fontWeight:700,color:C.text}}>Total da sessão</p>
              <p style={{fontSize:16,fontWeight:800,color:C.primary}}>{fmt(viewGastos.gastos.reduce((s,g)=>s+g.valor,0))}</p>
            </div>
          </Sheet>
        )}
      </div>
    );
  };

  const renderObra = () => {
    let minYM = "9999-12"; let maxYM = "0000-01";
    etapas.forEach(e => {
        if(e.dataIniEst && e.dataIniEst < minYM) minYM = e.dataIniEst;
        if(e.dataIniReal && e.dataIniReal < minYM) minYM = e.dataIniReal;
        if(e.dataIniEst) { const endEst = addYM(e.dataIniEst, e.durEst); if(endEst > maxYM) maxYM = endEst; }
        if(e.dataIniReal) { const endReal = addYM(e.dataIniReal, Math.max(e.durReal,1)); if(endReal > maxYM) maxYM = endReal; }
    });
    if(minYM > maxYM) { minYM = todayYM(); maxYM = addYM(minYM, 6); }
    const totalMonths = diffYM(minYM, maxYM) + 1;
    const timeline = Array.from({length: totalMonths}, (_,i) => addYM(minYM, i));
    const curM = todayYM();
    const isCurInBounds = curM >= minYM && curM <= maxYM;

    return (
      <div style={{padding:"0 16px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <STitle style={{marginBottom:0}}>Etapas</STitle>
          <div style={{display:"flex", gap:8}}>
            <button onClick={()=>setIsSorting(!isSorting)} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 11px",borderRadius:8,border:`1.5px solid ${isSorting?C.primary:C.border}`,background:isSorting?C.pLight:"transparent",color:isSorting?C.primary:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {isSorting ? "Concluir" : <><MoveVertical size={13}/> Reordenar</>}
            </button>
            <button onClick={()=>openAdd("etapa",{emoji:"🏗️",st:"wait",pct:0,dataIniEst:todayYM(),durEst:2,dataIniReal:"",durReal:0})} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 13px",borderRadius:8,border:"none",background:C.primary,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><Plus size={13}/> Nova etapa</button>
          </div>
        </div>
        {etapas.map((e, idx)=>{
          const depEtapa = e.dep ? etapas.find(x=>x.id===e.dep) : null;
          const isOpen = openEtapaId===e.id;
          return (
            <Card key={e.id} style={{marginBottom:8,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setOpenEtapaId(isOpen?null:e.id)}>
                <div style={{width:40,height:40,borderRadius:12,flexShrink:0,background:e.st==="ok"?C.sLight:e.st==="run"?C.pLight:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{e.emoji}</div>
                <div style={{flex:1}}>
                  <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{e.nome}</p>
                  <div style={{background:C.border,borderRadius:4,height:4,overflow:"hidden"}}><div style={{width:`${e.pct}%`,height:"100%",background:e.st==="ok"?C.success:e.st==="run"?C.primary:"transparent"}}/></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {isSorting && (
                    <div style={{display:"flex", gap:4, marginRight:4, opacity:isUploading?0.5:1, pointerEvents:isUploading?"none":"auto"}}>
                      <button onClick={ev=>{ev.stopPropagation();moveEtapa(e.id,-1);}} disabled={idx===0 || isUploading} style={{width:30,height:30,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",opacity:idx===0?0.3:1}}><ArrowUp size={14} color={C.primary}/></button>
                      <button onClick={ev=>{ev.stopPropagation();moveEtapa(e.id,1);}} disabled={idx===etapas.length-1 || isUploading} style={{width:30,height:30,borderRadius:8,border:`1px solid ${C.border}`,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",opacity:idx===etapas.length-1?0.3:1}}><ArrowDown size={14} color={C.primary}/></button>
                    </div>
                  )}
                  <p style={{fontSize:16,fontWeight:800,color:e.st==="ok"?C.success:e.st==="run"?C.primary:C.muted}}>{e.pct}%</p>
                  <SmBtn onClick={ev=>{ev.stopPropagation();openEdit("etapa",e);}} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
                  {isOpen ? <ChevronUp size={16} color={C.muted}/> : <ChevronDown size={16} color={C.muted}/>}
                </div>
              </div>
              {isOpen && (
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    <div>
                      <p style={{fontSize:10,color:C.muted,fontWeight:600}}>TEMPO ESTIMADO</p>
                      <p style={{fontSize:13,fontWeight:700,color:C.text}}>{fmtYM(e.dataIniEst)} a {fmtYM(addYM(e.dataIniEst, e.durEst-1))} <span style={{fontSize:11,color:C.muted}}>({e.durEst}m)</span></p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:C.muted,fontWeight:600}}>TEMPO REAL</p>
                      <p style={{fontSize:13,fontWeight:700,color:e.dataIniReal?C.primary:C.muted}}>
                        {e.dataIniReal ? `${fmtYM(e.dataIniReal)} a ${fmtYM(addYM(e.dataIniReal, e.durReal-1))} ` : "Não iniciada"}
                        {e.dataIniReal && <span style={{fontSize:11,color:C.muted}}>({e.durReal}m)</span>}
                      </p>
                    </div>
                  </div>
                  {e.detalhes && (
                    <p style={{fontSize:12, color:C.muted, marginTop:8, fontStyle:"italic", lineHeight:1.4, padding:"10px", background:C.bg, borderRadius:10, marginBottom:10}}>{e.detalhes}</p>
                  )}
                  {depEtapa && (<div style={{background:C.pLight,borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}><ArrowRight size={14} color={C.primary}/><p style={{fontSize:12,color:C.text}}><strong>Depende de:</strong> {depEtapa.emoji} {depEtapa.nome} {depEtapa.st==="ok" && <span style={{color:C.success,fontWeight:700}}> ✓ Concluída</span>}</p></div>)}
                </div>
              )}
            </Card>
          );
        })}
        
        <STitle style={{marginTop:8}}>Cronograma: Estimado vs Real</STitle>
        <Card style={{padding:"12px 14px",overflow:"hidden"}}>
          <p style={{fontSize:11,color:C.muted,marginBottom:8}}>← arraste para ver a linha completa</p>
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth: timeline.length*40 + 110}}>
              <div style={{display:"flex",paddingLeft:100,marginBottom:4}}>
                {timeline.map((ym, i)=>( <div key={i} style={{width:40,flexShrink:0,fontSize:9,textAlign:"center",fontWeight:600,color:ym===curM?C.primary:C.muted,borderBottom:`2px solid ${ym===curM?C.primary:C.border}`,paddingBottom:3}}>{fmtYM(ym)}</div> ))}
              </div>
              {etapas.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",height:34,marginBottom:6, borderBottom:`1px solid ${C.sLight}`}}>
                  <div style={{width:100,flexShrink:0,fontSize:10,fontWeight:600,color:C.text,paddingRight:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.nome}</div>
                  <div style={{position:"relative",flex:1,height:"100%"}}>
                    {isCurInBounds && ( <div style={{position:"absolute",left:diffYM(minYM, curM)*40 + 20,top:0,bottom:0,width:2,background:`var(--primary)`, opacity:0.2, zIndex:0}}/> )}
                    <div style={{
                       position:"absolute", left: diffYM(minYM, e.dataIniEst)*40 + 2, width: e.durEst*40 - 4,
                       top: 2, height: 10, borderRadius: 5, border:`1px dashed ${C.muted}`, background: C.bg, zIndex:1
                    }}/>
                    {e.dataIniReal && (
                      <div style={{
                         position:"absolute", left: diffYM(minYM, e.dataIniReal)*40 + 2, width: (e.durReal||1)*40 - 4,
                         top: 15, height: 16, borderRadius: 8, background: e.st==="ok"?C.success:e.st==="run"?C.primary:C.border, overflow:"hidden", zIndex:2
                      }}>
                         {e.st==="run" && <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${e.pct}%`,background:C.success,opacity:.6}}/>}
                         {(e.durReal||1)>=2 && <p style={{position:"relative",fontSize:9,fontWeight:700,color:"#fff",textAlign:"center",lineHeight:"16px",zIndex:2}}>{e.pct}%</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:10}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:4,border:`1px dashed ${C.muted}`}}/><p style={{fontSize:10,color:C.muted}}>Tempo Estimado</p></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:8,borderRadius:4,background:C.success}}/><p style={{fontSize:10,color:C.muted}}>Real Concluída</p></div>
            <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:8,borderRadius:4,background:C.primary}}/><p style={{fontSize:10,color:C.muted}}>Real Em andamento</p></div>
          </div>
        </Card>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,marginBottom:10}}>
          <STitle style={{marginBottom:0}}>Checklist de dependências</STitle>
          <button onClick={()=>openAdd("checklist",{depOk:false,urg:"media"})} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 13px",borderRadius:8,border:"none",background:C.primary,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><Plus size={13}/> Nova</button>
        </div>
        {checklist.map(c=>(
          <Card key={c.id} style={{marginBottom:8,padding:"12px 14px",opacity:c.done?.5:1,border:c.depOk?`1px solid var(--success)`:`1px solid ${C.border}`}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <button onClick={()=>toggleCheck(c.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0,marginTop:1}}>{c.done ? <CheckSquare size={20} color={C.success}/> : <Square size={20} color={C.muted}/>}</button>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4,textDecoration:c.done?"line-through":"none"}}>{c.t}</p>
                <div style={{display:"inline-flex",alignItems:"center",gap:6,background:c.depOk?C.sLight:C.wLight,borderRadius:8,padding:"4px 10px"}}>{c.depOk ? <Check size={12} color={C.success}/> : <Clock size={12} color={C.warning}/>}<p style={{fontSize:11,fontWeight:600,color:c.depOk?C.success:C.warning}}>{c.dep}</p></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}><Badge label={c.urg==="alta"?"🔴 Urgente":c.urg==="media"?"🟡 Médio":"🟢 Baixo"} color={C.text} bg={C.border}/><SmBtn onClick={()=>openEdit("checklist",c)} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn></div>
            </div>
          </Card>
        ))}
        {checklist.length===0 && <p style={{textAlign:"center",color:C.muted,padding:"16px 0"}}>Nenhuma tarefa cadastrada.</p>}
      </div>
    );
  };

  const renderCotacaoCard = (q) => {
    const isOpen = expandedCot[q.id]; 
    const best = q.forn.find(f=>f.best); 
    const worst = q.forn.reduce((max,f)=>(f.precoVista||0)>max?(f.precoVista||0):max, 0); 
    const economy = best ? (worst-(best.precoVista||0)).toFixed(2) : 0;
    
    return (
      <Card key={q.id} style={{marginBottom:10, opacity: q.st === "concluida" ? 0.7 : 1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpandedCot(p=>({...p,[q.id]:!p[q.id]}))}>
          <div style={{flex:1,paddingRight:8}}>
            <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{q.titulo}</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap", marginBottom:4}}>
               <Badge label={q.cat} color={C.secondary} bg={`${C.secondary}15`}/>
               <Badge label={`${q.itens?.length||0} item(ns)`} color={C.muted} bg={C.border}/>
               <Badge label={`${q.forn.length} forn.`} color={C.muted} bg={C.border}/>
            </div>
            {!isOpen && q.itens && q.itens.length > 0 && (
               <p style={{fontSize:11, color:C.muted, marginTop:4}}>{q.itens.map(i => `${i.qtd} ${i.nome}`).join(", ")}</p>
            )}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <SmBtn onClick={ev=>{ev.stopPropagation();openEdit("cotacao",q);}} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
            {isOpen ? <ChevronUp size={18} color={C.muted}/> : <ChevronDown size={18} color={C.muted}/>}
          </div>
        </div>

        {!isOpen && best && (
          <div style={{background:C.sLight,borderRadius:8,padding:"8px 12px",display:"flex",justifyContent:"space-between",marginTop:8}}>
            <p style={{fontSize:12,color:C.success,fontWeight:700}}>✦ Melhor: {best.nome}</p>
            <p style={{fontSize:12,fontWeight:800,color:C.success}}>
               R$ {Number(best.precoVista).toFixed(2).replace(".",",")}
               {economy>0 && <span style={{fontSize:10,color:C.muted,fontWeight:400}}> / ec. R${economy}</span>}
            </p>
          </div>
        )}

        {isOpen && (
          <div style={{paddingTop:10,marginTop:10,borderTop:`1px solid ${C.border}`}}>
            
            {q.itens && q.itens.length > 0 && (
               <div style={{marginBottom:12, padding:"8px", background:C.wLight, borderRadius:8}}>
                 <p style={{fontSize:11, fontWeight:700, color:C.warning, marginBottom:4}}>ITENS DA COTAÇÃO:</p>
                 {q.itens.map((it, i) => (
                    <p key={i} style={{fontSize:12, color:C.text, marginBottom:2}}>• {it.qtd} - {it.nome}</p>
                 ))}
               </div>
            )}

            {q.forn.map(f=>(
              <div key={f.id} style={{borderRadius:10,padding:"10px 12px",marginBottom:8,background:f.best?C.sLight:C.bg,border:f.best?`1.5px solid var(--success)`:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <p style={{fontSize:13,fontWeight:700,color:C.text}}>{f.best&&<span style={{color:C.success}}>✦ </span>}{f.nome}</p>
                  <SmBtn onClick={()=>openEdit("fornecedor",f,q.id)} bg={C.bg}><Edit2 size={12} color={C.muted}/></SmBtn>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                   <div>
                     <p style={{fontSize:14,fontWeight:800,color:f.best?C.success:C.text}}>R$ {Number(f.precoVista).toFixed(2).replace(".",",")}</p>
                     <p style={{fontSize:10,color:C.muted}}>à vista</p>
                   </div>
                   {f.precoPrazo && (
                     <div style={{textAlign:"right"}}>
                       <p style={{fontSize:13,fontWeight:700,color:C.text}}>R$ {Number(f.precoPrazo).toFixed(2).replace(".",",")}</p>
                       <p style={{fontSize:10,color:C.muted}}>a prazo</p>
                     </div>
                   )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center", borderTop:`1px dashed ${C.border}`, paddingTop:6}}>
                  <p style={{fontSize:11,color:C.muted}}>Válido: {f.val}{f.obs&&` • ${f.obs}`}</p>
                  {!f.best && ( <button onClick={()=>setBest(q.id,f.id)} style={{fontSize:10,fontWeight:700,color:C.muted,border:`1px solid ${C.border}`,background:"transparent",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>⭐ Marcar melhor</button> )}
                </div>
              </div>
            ))}
            
            <div style={{display:"flex", gap:8, marginTop:10, flexWrap:"wrap"}}>
               <button onClick={()=>openAdd("fornecedor",{best:false},q.id)} style={{flex:1, padding:10,borderRadius:8,border:`1.5px dashed var(--primary)`, opacity:0.8, background:"transparent",color:C.primary,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}><Plus size={14}/> Add fornecedor</button>
               <button onClick={(e)=>{e.stopPropagation(); abrirExportCotacao(q);}} style={{flex:1, padding:10,borderRadius:8,border:`1.5px solid var(--secondary)`, opacity:0.9, background:"transparent",color:C.secondary,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}><Download size={14}/> Enviar</button>
               {q.st !== "concluida" && (
                  <button onClick={(e)=>concluirCotacao(e, q.id)} style={{flex:1, padding:10,borderRadius:8,border:`1.5px solid var(--success)`, opacity:0.8, background:C.sLight,color:C.success,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}><Check size={14}/> Concluir</button>
               )}
               {q.st === "concluida" && (
                  <button onClick={async (e)=>{e.stopPropagation(); const c=cotacoes.find(x=>x.id===q.id); if(c) { await setDoc(doc(db,"cotacoes",q.id.toString()),JSON.parse(JSON.stringify({...c,st:"aberta"}))); logChange(`Reabriu a cotação "${q.titulo}"`);}}} style={{flex:1, padding:10,borderRadius:8,border:`1.5px solid var(--warning)`, opacity:0.8, background:C.wLight,color:C.warning,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}>Reabrir</button>
               )}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderCotacoes = () => {
    const abertas = cotacoes.filter(c => c.st !== "concluida");
    const concluidas = cotacoes.filter(c => c.st === "concluida");

    return (
      <div style={{padding:"0 16px 16px"}}>
        <Card style={{background:C.sLight,marginBottom:12,padding:"12px 14px"}}>
          <p style={{fontSize:13,fontWeight:700,color:C.success,marginBottom:2}}>💡 Compare antes de decidir</p>
          <p style={{fontSize:12,color:C.text}}>Adicione orçamentos de diferentes fornecedores e veja o melhor preço destacado.</p>
        </Card>
        
        <button onClick={()=>openAdd("cotacao",{cat:CAT_OPTS[0], st:"aberta"})} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.8, background:"transparent",cursor:"pointer",color:C.primary,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4,marginBottom:16,fontFamily:"inherit"}}><Plus size={18}/> Nova cotação</button>
        
        {abertas.map(q => renderCotacaoCard(q))}
        {abertas.length === 0 && <p style={{textAlign:"center", color:C.muted, margin:"20px 0"}}>Nenhuma cotação em aberto.</p>}

        {concluidas.length > 0 && (
           <div style={{marginTop:20}}>
              <button onClick={()=>setShowConcluidas(!showConcluidas)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:14,borderRadius:12,background:C.border,border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                 <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <CheckSquare size={18} color={C.success}/>
                    <p style={{fontSize:13,fontWeight:800,color:C.text}}>Cotações Concluídas ({concluidas.length})</p>
                 </div>
                 {showConcluidas ? <ChevronUp size={18} color={C.muted}/> : <ChevronDown size={18} color={C.muted}/>}
              </button>
              
              {showConcluidas && (
                 <div style={{marginTop:12}}>
                   {concluidas.map(q => renderCotacaoCard(q))}
                 </div>
              )}
           </div>
        )}
      </div>
    );
  };

  /* ─── RENDER GALERIA (EVOLUÇÃO DA OBRA) ─── */
  const renderGaleria = () => {
     if(!selectedPastaId) {
        return (
           <div style={{padding:"0 16px 16px"}}>
             <button onClick={()=>openAdd("pastaGaleria", {})} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.8, background:"transparent",cursor:"pointer",color:C.primary,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16,fontFamily:"inherit"}}>
                <Folder size={18}/> Nova Pasta de Fotos
             </button>

             <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
                {galeria.map(p => {
                   const thumb = p.fotos && p.fotos.length > 0 ? p.fotos[0].url : null;
                   return (
                      <Card key={p.id} onClick={()=>setSelectedPastaId(p.id)} style={{padding:0, overflow:"hidden", display:"flex", flexDirection:"column", height:160, cursor:"pointer", border:`1px solid ${C.border}`}}>
                         <div style={{flex:1, background:C.border, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden"}}>
                            {thumb ? (
                               <img src={thumb} alt="capa" style={{width:"100%", height:"100%", objectFit:"cover"}} />
                            ) : (
                               <ImageIcon size={32} color={C.muted} opacity={0.5}/>
                            )}
                         </div>
                         <div style={{padding:"10px 12px", background:C.card, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                            <div style={{overflow:"hidden"}}>
                               <p style={{fontSize:13, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{p.nome}</p>
                               <p style={{fontSize:11, color:C.muted}}>{p.fotos?.length || 0} fotos</p>
                            </div>
                            <SmBtn onClick={(e)=>{e.stopPropagation(); openEdit("pastaGaleria", p);}} bg="transparent"><Edit2 size={13} color={C.muted}/></SmBtn>
                         </div>
                      </Card>
                   );
                })}
             </div>
             {galeria.length === 0 && <p style={{textAlign:"center", color:C.muted, marginTop:30}}>Nenhuma pasta criada. Adicione uma para começar.</p>}
           </div>
        );
     }

     const pasta = galeria.find(p => p.id === selectedPastaId);
     if(!pasta) { setSelectedPastaId(null); return null; }

     return (
        <div style={{padding:"0 16px 16px"}}>
           <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:16}}>
              <button onClick={()=>setSelectedPastaId(null)} style={{background:C.border, border:"none", width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}><ChevronLeft size={20} color={C.text}/></button>
              <div style={{flex:1}}>
                 <p style={{fontSize:18, fontWeight:800, color:C.text}}>{pasta.nome}</p>
                 <p style={{fontSize:12, color:C.muted}}>Criada em {pasta.dataCriacao}</p>
              </div>
           </div>

           <div style={{marginBottom:20}}>
              <input type="file" id="galeria-upload" multiple accept="image/*" style={{display:"none"}} onChange={(e) => handleGaleriaFile(e, pasta.id)} />
              <label htmlFor="galeria-upload" style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, background:C.pLight,color:C.primary,fontSize:14,fontWeight:800,cursor:"pointer",display:isUploading?"none":"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
                <Camera size={20}/> {isUploading ? "Enviando imagens..." : "Adicionar Fotos"}
              </label>
              {isUploading && <p style={{fontSize:13, color:C.primary, textAlign:"center", marginTop:8, fontWeight:600}}>Comprimindo e enviando para o Drive...</p>}
           </div>

           <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(100px, 1fr))", gap:8}}>
              {(pasta.fotos || []).map((f, idx) => (
                 <div key={f.id} onClick={()=>setViewerImage({fotos: pasta.fotos, index: idx})} style={{position:"relative", paddingTop:"100%", borderRadius:12, overflow:"hidden", background:C.border, cursor:"pointer"}}>
                    <img src={f.url} alt={f.nome} style={{position:"absolute", top:0, left:0, width:"100%", height:"100%", objectFit:"cover"}} loading="lazy"/>
                    <button onClick={(e) => deleteFoto(pasta.id, idx, e)} style={{position:"absolute", top:4, right:4, background:"rgba(0,0,0,0.6)", border:"none", width:24, height:24, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"}}>
                       <Trash2 size={12} color="#fff"/>
                    </button>
                 </div>
              ))}
           </div>
           {(!pasta.fotos || pasta.fotos.length === 0) && <p style={{textAlign:"center", color:C.muted, marginTop:20}}>Pasta vazia.</p>}
        </div>
     );
  };

  const renderTarefas = () => {
    const pendentes = tarefas.filter(t=>!t.done);
    const concluidas = tarefas.filter(t=>t.done);
    return (
       <div style={{padding:"0 16px 16px"}}>
         <button onClick={()=>openAdd("tarefa",{done:false})} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.8, background:"transparent",cursor:"pointer",color:C.primary,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14,fontFamily:"inherit"}}><Plus size={18}/> Nova tarefa</button>

         {pendentes.map(t=>(
           <Card key={t.id} style={{marginBottom:10, borderLeft:`4px solid var(--warning)`}}>
             <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
               <button onClick={()=>{setTarefas(p=>p.map(x=>x.id===t.id?{...x,done:true}:x)); logChange(`Marcou a tarefa "${t.t}" como concluída`);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,marginTop:2}}><Square size={22} color={C.muted}/></button>
               <div style={{flex:1}}>
                 <p style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:4}}>{t.t}</p>
                 <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                    {t.executor && <p style={{fontSize:11,color:C.muted,background:C.bg,padding:"4px 8px",borderRadius:6}}>👤 {t.executor}</p>}
                    {t.prazo && <p style={{fontSize:11,color:C.danger,background:C.dLight,padding:"4px 8px",borderRadius:6,fontWeight:700}}>📅 Até {new Date(t.prazo).toLocaleDateString("pt-BR", {timeZone:"UTC"})}</p>}
                 </div>
                 {t.obs && <p style={{fontSize:12, color:C.muted, marginTop:8, fontStyle:"italic", lineHeight:1.4}}>{t.obs}</p>}
               </div>
               <SmBtn onClick={()=>openEdit("tarefa",t)} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
             </div>
           </Card>
         ))}
         
         {pendentes.length === 0 && <p style={{textAlign:"center", color:C.muted, margin:"20px 0"}}>Nenhuma tarefa pendente 🎉</p>}
         
         {concluidas.length > 0 && (
           <>
             <STitle style={{marginTop:24}}>Concluídas</STitle>
             {concluidas.map(t=>(
               <Card key={t.id} style={{marginBottom:10, opacity:0.7}}>
                 <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                   <button onClick={()=>{setTarefas(p=>p.map(x=>x.id===t.id?{...x,done:false}:x)); logChange(`Marcou a tarefa "${t.t}" como pendente`);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,marginTop:2}}><CheckSquare size={22} color={C.success}/></button>
                   <div style={{flex:1}}>
                     <p style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:4,textDecoration:"line-through"}}>{t.t}</p>
                     {t.obs && <p style={{fontSize:12, color:C.muted, marginTop:2, fontStyle:"italic"}}>{t.obs}</p>}
                   </div>
                   <SmBtn onClick={()=>openEdit("tarefa",t)} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
                 </div>
               </Card>
             ))}
           </>
         )}
       </div>
    );
  };

  const renderAnotacoes = () => {
    const filteredAnotacoes = searchAnotacao
       ? anotacoes.filter(a => a.t.toLowerCase().includes(searchAnotacao.toLowerCase()) || a.desc.toLowerCase().includes(searchAnotacao.toLowerCase()))
       : anotacoes;

    return (
       <div style={{padding:"0 16px 16px"}}>
         <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,borderRadius:12,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.03)"}}>
           <Search size={16} color={C.muted}/>
           <input value={searchAnotacao} onChange={e=>setSearchAnotacao(e.target.value)} placeholder="Pesquisar anotações..." style={{border:"none",outline:"none",fontSize:14,color:C.text,background:"transparent",flex:1,fontFamily:"inherit"}}/>
           {searchAnotacao && <button onClick={()=>setSearchAnotacao("")} style={{background:"none",border:"none",padding:4,cursor:"pointer"}}><X size={16} color={C.muted}/></button>}
         </div>

         <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
           <div onClick={()=>openAdd("anotacao",{})} style={{borderRadius:14,border:`2px dashed var(--primary)`, opacity:0.8, padding:14,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:80,gap:6}}>
             <Plus size={22} color={C.primary}/>
             <p style={{fontSize:13,fontWeight:700,color:C.primary}}>Nova anotação</p>
           </div>
           
           {filteredAnotacoes.map(a=>(
             <div key={a.id} onClick={()=>openEdit("anotacao",a)} style={{background:C.wLight,borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer",borderLeft:`4px solid var(--warning)`}}>
               <p style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:6}}>{a.t}</p>
               <p style={{fontSize:13,color:C.text,lineHeight:1.5,whiteSpace:"pre-wrap",opacity:0.85,marginBottom:10}}>{a.desc}</p>
               <p style={{fontSize:10,fontWeight:700,color:C.muted}}>Salvo em {a.data}</p>
             </div>
           ))}
           {filteredAnotacoes.length === 0 && <p style={{textAlign:"center",color:C.muted,padding:"16px 0"}}>Nenhuma anotação encontrada.</p>}
         </div>
       </div>
    );
  };

  const renderDocs = () => {
    const list = docTab === "contratos" ? contratos : projetos;
    
    const filteredList = list.filter(f => {
       if (!searchDoc) return true;
       const term = searchDoc.toLowerCase();
       const titleMatch = (f.titulo || f.nome || "").toLowerCase().includes(term);
       const tagMatch = (f.tags || "").toLowerCase().includes(term);
       return titleMatch || tagMatch;
    });

    return (
       <div style={{padding:"0 16px 16px"}}>
         <div style={{display:"flex", background:C.border, borderRadius:12, padding:4, marginBottom:16}}>
           <button onClick={()=>setDocTab("contratos")} style={{flex:1, padding:8, borderRadius:8, border:"none", background:docTab==="contratos"?C.card:"transparent", color:docTab==="contratos"?C.primary:C.muted, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"}}>Contratos</button>
           <button onClick={()=>setDocTab("projetos")} style={{flex:1, padding:8, borderRadius:8, border:"none", background:docTab==="projetos"?C.card:"transparent", color:docTab==="projetos"?C.primary:C.muted, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"}}>Projetos</button>
         </div>

         <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,borderRadius:12,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.03)"}}>
           <Search size={16} color={C.muted}/>
           <input value={searchDoc} onChange={e=>setSearchDoc(e.target.value)} placeholder="Pesquisar por título ou tag..." style={{border:"none",outline:"none",fontSize:14,color:C.text,background:"transparent",flex:1,fontFamily:"inherit"}}/>
           {searchDoc && <button onClick={()=>setSearchDoc("")} style={{background:"none",border:"none",padding:4,cursor:"pointer"}}><X size={16} color={C.muted}/></button>}
         </div>

         <button onClick={()=>openAdd("doc",{data:todayFmt()})} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.8, background:"transparent",cursor:"pointer",color:C.primary,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:16,fontFamily:"inherit"}}><Plus size={18}/> Novo {docTab==="contratos"?"contrato":"projeto"}</button>

         <div style={{display:"grid", gridTemplateColumns:"1fr", gap:10}}>
           {filteredList.map(f => {
              const anexos = f.anexos && f.anexos.length > 0 ? f.anexos : (f.nome ? [{nome: f.nome, url: f.url, tam: f.tam, comp: f.comp}] : []);
              
              return (
                 <Card key={f.id} style={{padding:"12px 14px", borderLeft:docTab==="contratos"?`4px solid ${f.ok?C.success:C.warning}`:`4px solid ${C.secondary}`}}>
                    <div style={{display:"flex", alignItems:"flex-start", gap:12}}>
                       <div style={{width:42, height:42, borderRadius:10, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}><FileText size={20} color={C.muted}/></div>
                       <div style={{flex:1, paddingRight:10}}>
                          <p style={{fontSize:14, fontWeight:800, color:C.text, marginBottom:4}}>{f.titulo || f.nome}</p>
                          {f.tags && (<div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>{f.tags.split(',').map(t=> <Badge key={t} label={t.trim()} color={C.secondary} bg={`${C.secondary}15`}/>)}</div>)}
                          <p style={{fontSize:11, color:C.muted, marginBottom:4}}>Enviado em {f.data}</p>
                          
                          {anexos.length > 0 && (
                             <div style={{marginTop:8, display:"flex", flexDirection:"column", gap:6}}>
                                {anexos.map((a, idx) => (
                                   <div key={idx} style={{display:"flex", alignItems:"center", justifyContent:"space-between", background:C.bg, padding:"6px 10px", borderRadius:6, border:`1px solid ${C.border}`}}>
                                      <div style={{display:"flex", alignItems:"center", gap:6, overflow:"hidden"}}>
                                        <FileText size={12} color={C.muted}/>
                                        <span style={{fontSize:11, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{a.nome}</span>
                                        <span style={{fontSize:9, color:C.muted}}>({a.comp || a.tam})</span>
                                      </div>
                                      <SmBtn onClick={() => window.open(a.url, '_blank')} bg="transparent"><Download size={14} color={C.primary}/></SmBtn>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                       <div style={{display:"flex", gap:6, alignItems:"flex-start"}}>
                          {docTab==="contratos" && (
                             <button onClick={()=>toggleSigned(f.id)} style={{background:"none", border:"none", cursor:"pointer", padding:4}} title={f.ok?"Assinado":"Pendente"}>{f.ok?<CheckSquare size={18} color={C.success}/>:<Square size={18} color={C.muted}/>}</button>
                          )}
                          <SmBtn onClick={()=>openEdit("doc",f)} bg={C.bg}><Edit2 size={13} color={C.muted}/></SmBtn>
                       </div>
                    </div>
                 </Card>
              );
           })}
           {filteredList.length === 0 && <p style={{textAlign:"center", color:C.muted, margin:"20px 0"}}>Nenhum documento encontrado.</p>}
         </div>
       </div>
    );
  };

  const renderContatos = () => {
    const filtered = contatos.filter(c=> c.nome.toLowerCase().includes(searchCon.toLowerCase()) || c.papel.toLowerCase().includes(searchCon.toLowerCase()) );
    return (
      <div style={{padding:"0 16px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,borderRadius:12,padding:"10px 14px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.03)"}}>
          <Search size={16} color={C.muted}/>
          <input value={searchCon} onChange={e=>setSearchCon(e.target.value)} placeholder="Pesquisar contatos..." style={{border:"none",outline:"none",fontSize:14,color:C.text,background:"transparent",flex:1,fontFamily:"inherit"}}/>
          {searchCon && <button onClick={()=>setSearchCon("")} style={{background:"none",border:"none",padding:4,cursor:"pointer"}}><X size={16} color={C.muted}/></button>}
        </div>

        <button onClick={()=>openAdd("contato",{cor:COR_OPTS[0], prestou:false, nota:0})} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed var(--primary)`, opacity:0.8, background:"transparent",cursor:"pointer",color:C.primary,fontSize:14,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4,marginBottom:14,fontFamily:"inherit"}}><Plus size={18}/> Novo contato</button>
        {filtered.map(c=>(
          <Card key={c.id} style={{marginBottom:10,padding:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:46,height:46,borderRadius:14,background:c.cor,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,fontWeight:800,flexShrink:0}}>{c.ini}</div>
              <div style={{flex:1}}>
                 <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:2}}>{c.nome}</p>
                 <Badge label={c.papel} color={c.cor} bg={`${C.bg}`}/>
              </div>
              <div style={{display:"flex",gap:8}}><SmBtn onClick={()=>openEdit("contato",c)} bg={C.bg}><Edit2 size={15} color={C.muted}/></SmBtn><a href={`tel:${c.tel}`} style={{width:32,height:32,borderRadius:9,background:C.sLight,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}}><Phone size={15} color={C.success}/></a><a href={`mailto:${c.email}`} style={{width:32,height:32,borderRadius:9,background:C.pLight,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}}><Mail size={15} color={C.primary}/></a></div>
            </div>
            <div style={{marginTop:12,padding:"10px 12px",background:C.bg,borderRadius:10}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                 <div style={{display:"flex", alignItems:"center", gap:6}}><p style={{fontSize:11,color:C.muted}}>📞 {c.tel}</p></div>
                 {c.prestou && (<div style={{display:"flex", alignItems:"center", gap:2}}>{[1,2,3,4,5].map(v=><Star key={v} size={12} fill={c.nota>=v ? C.warning : "none"} color={c.nota>=v ? C.warning : C.border}/>)}</div>)}
              </div>
              {c.obs && (<div style={{marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}`}}><p style={{fontSize:12, color:C.text, fontStyle:"italic"}}>"{c.obs}"</p></div>)}
            </div>
          </Card>
        ))}
        {filtered.length===0 && <p style={{textAlign:"center",color:C.muted,padding:"16px 0"}}>Nenhum contato encontrado.</p>}
      </div>
    );
  };

  const renderIdeias = () => {
    const filteredBySearch = searchIdeia
      ? ideias.filter(i => 
          i.t.toLowerCase().includes(searchIdeia.toLowerCase()) || 
          (i.desc && i.desc.toLowerCase().includes(searchIdeia.toLowerCase())) ||
          (i.tags && i.tags.some(tg => tg.toLowerCase().includes(searchIdeia.toLowerCase())))
        )
      : ideias;
    const filtered = catFiltro==="Todas" ? filteredBySearch : filteredBySearch.filter(i=>i.cat===catFiltro);
    const activeCats = (ideiaCats||[]).filter(c=>c.ativa);

    return (
      <div style={{padding:"0 16px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.03)"}}>
          <Search size={18} color={C.primary}/>
          <input value={searchIdeia} onChange={e=>setSearchIdeia(e.target.value)} placeholder="Buscar ideia, tag ou detalhe..."
            style={{border:"none",outline:"none",fontSize:14,color:C.text,background:"transparent",flex:1,fontFamily:"inherit"}}/>
          {searchIdeia && <button onClick={()=>setSearchIdeia("")} style={{background:"none",border:"none",padding:4,cursor:"pointer"}}><X size={16} color={C.muted}/></button>}
        </div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:10}}>
          <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,flex:1}}>
            <button onClick={()=>setCatFiltro("Todas")} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:catFiltro==="Todas"?C.primary:C.card,color:catFiltro==="Todas"?"#fff":C.muted,fontSize:12,fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",fontFamily:"inherit"}}>Todas</button>
            {activeCats.map(cat=>( <button key={cat.id} onClick={()=>setCatFiltro(cat.nome)} style={{padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",flexShrink:0,background:catFiltro===cat.nome?C.primary:C.card,color:catFiltro===cat.nome?"#fff":C.muted,fontSize:12,fontWeight:700,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",fontFamily:"inherit"}}>{cat.nome}</button> ))}
          </div>
          <SmBtn onClick={()=>openAdd("manage_cats")} bg={C.card}><Settings size={15} color={C.muted}/></SmBtn>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div onClick={()=>openAdd("ideia",{cat:activeCats[0]?.nome||"Outros",cor:IDEIA_COLS[0],tags:[],links:[]})} style={{borderRadius:14,border:`2px dashed var(--primary)`, opacity:0.8, padding:14,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:140,gap:6}}><Plus size={22} color={C.primary}/><p style={{fontSize:12,fontWeight:700,color:C.primary}}>Nova ideia</p></div>
          {filtered.map(i=>(
            <div key={i.id} onClick={()=>openEdit("ideia",i)} style={{background:i.cor,borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer",display:"flex",flexDirection:"column"}}>
              <p style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>{i.cat}</p>
              <p style={{fontSize:13,fontWeight:800,color:C.text,lineHeight:1.3,marginBottom:4}}>{i.t}</p>
              {i.desc && <p style={{fontSize:11,color:C.text,opacity:0.8,marginBottom:8,lineHeight:1.4}}>{i.desc}</p>}
              <div style={{flex:1}}/>
              {i.tags && i.tags.length > 0 && (<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{i.tags.map(tg=>(<span key={tg} style={{fontSize:10,fontWeight:700,color:C.text,background:"var(--bg)",borderRadius:8,padding:"2px 8px", opacity:0.8}}>{tg}</span>))}</div>)}
              {i.links && i.links.length > 0 && (<div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>{i.links.map((lk, idx)=>(<a key={idx} href={lk.startsWith('http')?lk:`https://${lk}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:C.secondary,fontWeight:800,textDecoration:"none",display:"flex",alignItems:"center",gap:4,background:"var(--bg)", opacity:0.8, padding:"4px 8px",borderRadius:6}}><ExternalLink size={12}/> Link {idx+1}</a>))}</div>)}
              {i.anexos && i.anexos.length > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>
                  {i.anexos.map((a, idx)=>(
                    <a key={idx} href={a.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:C.success,fontWeight:800,textDecoration:"none",display:"flex",alignItems:"center",gap:4,background:"var(--bg)", opacity:0.8, padding:"4px 8px",borderRadius:6}}>
                      <Download size={12}/> Anexo
                    </a>
                  ))}
                </div>
              )}
              <p style={{fontSize:10,color:C.muted,marginTop:4}}>{i.data}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMais = () => (
    <div>
      <div style={{overflowX:"auto", margin:"0 16px 14px", paddingBottom:4}}>
        <div style={{display:"inline-flex", background:C.border, borderRadius:14, padding:4, gap:4}}>
          {[["docs","📄 Docs"],["tarefas","📋 Tarefas"],["anotacoes","📝 Anotações"],["contatos","👥 Contatos"],["ideias","💡 Ideias"]].map(([k,l])=>(
            <button key={k} onClick={()=>setMaisTab(k)} style={{
              padding:"10px 14px", borderRadius:10, border:"none", cursor:"pointer", whiteSpace:"nowrap",
              background:maisTab===k?C.card:"transparent", color:maisTab===k?C.primary:C.muted,
              fontSize:13, fontWeight:700, boxShadow:maisTab===k?"0 1px 4px rgba(0,0,0,0.08)":"none", fontFamily:"inherit"
            }}>{l}</button>
          ))}
        </div>
      </div>
      
      {maisTab==="docs"      && renderDocs()}
      {maisTab==="tarefas"   && renderTarefas()}
      {maisTab==="anotacoes" && renderAnotacoes()}
      {maisTab==="contatos"  && renderContatos()}
      {maisTab==="ideias"    && renderIdeias()}

      <div style={{padding:16, borderTop:`1px solid ${C.border}`, marginTop:20}}>
        {/* Google Drive já está configurado automaticamente e silencioso em background */}
      </div>
    </div>
  );

  /* ─── NAV ─── */
  const navItems = [
    {id:"dash",label:"Início",icon:Home},
    {id:"fin",label:"Finanças",icon:TrendingUp},
    {id:"obra",label:"Obra",icon:HardHat},
    {id:"galeria",label:"Evolução",icon:Camera},
    {id:"cotacoes",label:"Cotações",icon:LinkIcon},
    {id:"mais",label:"Ferramentas",icon:MoreHorizontal},
  ];
  const headings = {dash:"Minha Obra",fin:"Financeiro",obra:"Andamento",galeria:"Evolução da Obra",cotacoes:"Cotações",mais:"Ferramentas"};

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column"}} data-theme={isDark ? "dark" : "light"}>
      <style>{themeStyles}</style>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}
        button,a,input,select,textarea{font-family:inherit;}
        input[type=range]{appearance:none;height:6px;border-radius:3px;background:var(--border);outline:none;width:100%;}
        input[type=range]::-webkit-slider-thumb{appearance:none;width:20px;height:20px;border-radius:50%;background:var(--primary);cursor:pointer;}
        
        /* ── RESPONSIVE LAYOUT ── */
        .app-shell { display: flex; flex-direction: column; min-height: 100vh; }
        .app-main  { display: flex; flex: 1; }
        .sidebar   { display: none; }
        .content   { flex: 1; padding-bottom: 80px; overflow-y: auto; }
        .bottom-nav { display: flex; }
        
        @media (min-width: 768px) {
          .app-shell { max-width: 900px; margin: 0 auto; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
          .content { padding-bottom: 20px; }
          .bottom-nav { display: none; }
          .sidebar { display: flex; flex-direction: column; width: 200px; border-right: 1px solid var(--border); padding: 16px 12px; position: sticky; top: 57px; align-self: flex-start; height: calc(100vh - 57px); gap: 4px; }
        }
        
        @media (min-width: 1200px) {
          .app-shell { max-width: 1280px; }
          .sidebar { width: 240px; padding: 20px 16px; }
        }
      `}</style>

      {/* Header */}
      <div style={{background:C.card,padding:"14px 16px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div>
          <p style={{fontSize:11,color:C.muted,fontWeight:600}}>CASA DOS SONHOS</p>
          <p style={{fontSize:22,fontWeight:900,color:C.text,letterSpacing:-0.5}}>{headings[tab]}</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>setIsDark(!isDark)} style={{background:"none", border:"none", cursor:"pointer", color:C.muted}}>
            {isDark ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          <div style={{position:"relative", cursor:"pointer"}} onClick={handleOpenNotifs}>
            <Bell size={22} color={C.muted}/>
            {unreadCount > 0 && (
              <div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:C.danger, border:`2px solid ${C.card}`}}/>
            )}
          </div>
          <div style={{width:34,height:34,borderRadius:10,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800}} title={user}>{user.charAt(0).toUpperCase()}</div>
          <button onClick={handleLogout} style={{background:"none", border:"none", cursor:"pointer", color:C.muted}} title="Sair"><LogOut size={18}/></button>
        </div>
      </div>

      {/* Main area = sidebar + content */}
      <div className="app-main">

        {/* Sidebar (visible on tablet+) */}
        <nav className="sidebar">
          {navItems.map(n => {
            const Icon = n.icon; const active = tab === n.id;
            return (
              <button key={n.id} onClick={()=>setTab(n.id)} style={{
                display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,
                border:"none",background:active?C.pLight:"transparent",cursor:"pointer",
                color:active?C.primary:C.muted,fontWeight:active?700:500,fontSize:14,
                transition:"background 0.15s",textAlign:"left"
              }}>
                <Icon size={18} strokeWidth={active?2.5:2}/>
                {n.label}
              </button>
            );
          })}
          <div style={{marginTop:"auto",paddingTop:20,borderTop:`1px solid ${C.border}`}}>
            <button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,border:"none",background:"transparent",cursor:"pointer",color:C.muted,fontWeight:500,fontSize:13,width:"100%"}}>
              <LogOut size={16}/> Sair
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="content" style={{paddingTop:14}}>
          {tab==="dash" && renderDash()}
          {tab==="fin"  && renderFin()}
          {tab==="obra" && renderObra()}
          {tab==="galeria" && renderGaleria()}
          {tab==="cotacoes" && renderCotacoes()}
          {tab==="mais" && renderMais()}
        </div>
      </div>

      {/* Bottom Nav (mobile only) */}
      <div className="bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,padding:"8px 0 12px",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",zIndex:200}}>
        {navItems.map(n=>{
          const Icon=n.icon; const active=tab===n.id;
          return (
            <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,border:"none",background:"transparent",cursor:"pointer",padding:"4px 0"}}>
              <div style={{width:36,height:28,borderRadius:10,background:active?C.pLight:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon size={19} color={active?C.primary:C.muted} strokeWidth={active?2.5:2}/>
              </div>
              <p style={{fontSize:10,fontWeight:active?800:500,color:active?C.primary:C.muted}}>{n.label}</p>
            </button>
          );
        })}
      </div>

      {/* Modals & Overlays */}
      {renderModal()}
      {renderExportOverlay()}
      {renderImageViewer()}
      
      {/* Notifications Sheet */}
      {showNotifs && (
        <Sheet title="Notificações" onClose={()=>setShowNotifs(false)}>
          {currentNotifs.map(n => (
             <Card key={n.id} style={{marginBottom:10, borderLeft:`4px solid var(--${n.type})`, position:"relative"}}>
                <button onClick={() => setDeletedNotifs(p=>[...p, n.id])} style={{position:"absolute", top:10, right:10, background:"none", border:"none", cursor:"pointer", padding:4}}><X size={16} color={C.muted}/></button>
                <div style={{paddingRight:24}}>
                  <p style={{fontSize:14, fontWeight:800, color:C.text}}>{n.title}</p>
                  <p style={{fontSize:12, color:C.text, marginTop:4, opacity:0.9, lineHeight:1.4}}>{n.desc}</p>
                  {n.changes && n.changes.length > 0 && (
                     <div style={{marginTop:10, paddingTop:10, borderTop:`1px dashed ${C.border}`}}>
                        {n.changes.map((c, i) => <p key={i} style={{fontSize:11, color:C.muted, marginBottom:4}}>• {c}</p>)}
                     </div>
                  )}
                </div>
             </Card>
          ))}
          {currentNotifs.length === 0 && <p style={{textAlign:"center", color:C.muted, marginTop:20}}>Nenhuma notificação no momento.</p>}
        </Sheet>
      )}
    </div>
  );
}
