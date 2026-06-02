import React, { useState, useEffect, useCallback } from "react";

const GNEWS_KEY = import.meta.env.VITE_GNEWS_KEY || "";
const FX_KEY    = import.meta.env.VITE_FX_KEY    || "";
const AV_KEY    = import.meta.env.VITE_AV_KEY    || "";

// ── GEMINI via proxy (bypasses corporate firewall) ─────────────────────────
async function callGemini(prompt: string): Promise<string> {
  try {
    const r = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const d = await r.json();
    if (d.error) return "Erreur IA : " + d.error;
    return d.text || "Reponse indisponible.";
  } catch (e: any) {
    return "Erreur de connexion au proxy IA.";
  }
}

// ── STATIC DATA ────────────────────────────────────────────────────────────
const ALL_INDICES = [
  {id:"cnr_gazole",label:"CNR Gazole",category:"Transport",unit:"c\u20ac/L",source:"CNR",values:[182.3,185.1,183.7,188.2,191.4,189.6,192.1],trend:1.8},
  {id:"cnr_gnv",label:"CNR GNV",category:"Transport",unit:"\u20ac/kg",source:"CNR",values:[1.42,1.39,1.45,1.48,1.51,1.49,1.53],trend:2.7},
  {id:"cnr_loc",label:"CNR Location Engins",category:"Transport",unit:"base 100",source:"CNR",values:[118.2,119.1,120.4,121.8,122.3,123.7,124.9],trend:1.0},
  {id:"baltic",label:"Baltic Dry Index",category:"Transport",unit:"pts",source:"Baltic Exchange",values:[1420,1380,1510,1490,1560,1530,1610],trend:5.2},
  {id:"brent",label:"Petrole Brent",category:"Energie",unit:"$/bbl",source:"ICE",values:[78.2,80.1,77.4,81.3,83.2,82.7,85.1],trend:2.9},
  {id:"epex",label:"EPEX Spot Electricite",category:"Energie",unit:"\u20ac/MWh",source:"EPEX",values:[62.1,58.4,71.2,68.9,74.3,69.8,77.2],trend:4.1},
  {id:"ttf",label:"Gaz Naturel TTF",category:"Energie",unit:"\u20ac/MWh",source:"TTF",values:[38.2,36.1,41.4,39.8,44.2,42.7,46.3],trend:3.8},
  {id:"acier",label:"Acier HRC",category:"Matieres premieres",unit:"\u20ac/t",source:"LME",values:[612,598,621,635,628,641,658],trend:2.7},
  {id:"aluminium",label:"Aluminium LME",category:"Matieres premieres",unit:"$/t",source:"LME",values:[2180,2210,2195,2240,2228,2267,2291],trend:1.1},
  {id:"coton",label:"Coton ICE",category:"Matieres premieres",unit:"c$/lb",source:"ICE",values:[78.2,76.4,79.1,81.3,80.7,83.2,82.9],trend:-0.4},
  {id:"plastique",label:"Polypropylene",category:"Matieres premieres",unit:"\u20ac/t",source:"ICIS",values:[1180,1210,1195,1220,1240,1228,1255],trend:2.2},
  {id:"cuivre",label:"Cuivre LME",category:"Matieres premieres",unit:"$/t",source:"LME",values:[8420,8650,8380,8710,8840,8790,8980],trend:2.2},
  {id:"icht",label:"ICHT (cout horaire travail)",category:"INSEE",unit:"base 100",source:"INSEE",values:[118.4,119.1,119.8,120.3,121.0,121.6,122.2],trend:0.5},
  {id:"ipc",label:"IPC (Inflation)",category:"INSEE",unit:"base 100",source:"INSEE",values:[117.2,117.8,118.1,118.6,119.0,119.3,119.7],trend:0.3},
  {id:"ichtrevts",label:"ICHTrev-TS Transport",category:"INSEE",unit:"base 100",source:"INSEE",values:[121.3,122.1,122.8,123.4,124.1,124.7,125.3],trend:0.5},
  {id:"bt01",label:"Indice BT01 (BTP)",category:"INSEE",unit:"base 100",source:"INSEE",values:[133.2,134.1,134.8,135.6,136.2,137.0,137.8],trend:0.6},
  {id:"syntec",label:"Indice Syntec",category:"INSEE",unit:"base 100",source:"Syntec",values:[312.4,314.1,315.8,317.2,318.9,320.4,322.1],trend:0.5},
  {id:"eur_cny",label:"EUR/CNY",category:"Change",unit:"CNY",source:"ECB",values:[7.71,7.68,7.74,7.72,7.69,7.75,7.73],trend:-0.3},
  {id:"eur_usd",label:"EUR/USD",category:"Change",unit:"USD",source:"ECB",values:[1.072,1.068,1.081,1.077,1.083,1.079,1.086],trend:0.6},
  {id:"eur_gbp",label:"EUR/GBP",category:"Change",unit:"GBP",source:"ECB",values:[0.856,0.861,0.858,0.864,0.860,0.867,0.863],trend:0.8},
  {id:"eur_jpy",label:"EUR/JPY",category:"Change",unit:"JPY",source:"ECB",values:[158.2,161.4,159.8,163.2,164.7,162.9,166.3],trend:2.1},
];

const CATS: Record<string,{icon:string;color:string;indices:string[];keywords:string}> = {
  "Flotte camion":          {icon:"\uD83D\uDE9B",color:"#F97316",indices:["cnr_gazole","cnr_gnv","brent","baltic","icht","ichtrevts"],keywords:"transport routier camion logistique carburant"},
  "Engins de manutention":  {icon:"\uD83C\uDFD7\uFE0F",color:"#8B5CF6",indices:["acier","aluminium","cnr_loc","eur_cny","icht"],keywords:"chariot elevateur manutention engins entrepot"},
  "Energie":                {icon:"\u26A1",color:"#EAB308",indices:["epex","brent","ttf","eur_usd"],keywords:"energie electricite gaz petrole marche energetique"},
  "EPI / Workwear":         {icon:"\uD83E\uDDBA",color:"#10B981",indices:["coton","plastique","eur_cny","eur_usd","ipc"],keywords:"EPI equipement protection vetement travail securite"},
  "Flotte automobile":      {icon:"\uD83D\uDE97",color:"#3B82F6",indices:["brent","acier","aluminium","eur_usd","ipc"],keywords:"vehicule automobile flotte voiture electrique"},
  "Automatisation entrepot":{icon:"\uD83E\uDD16",color:"#EC4899",indices:["acier","aluminium","cuivre","eur_cny","eur_usd","syntec"],keywords:"automatisation entrepot robot logistique AGV"},
  "Bornes de recharge":     {icon:"\uD83D\uDD0C",color:"#06B6D4",indices:["epex","acier","aluminium","cuivre","eur_cny"],keywords:"borne recharge vehicule electrique IRVE"},
};

const GLOBAL_NEWS = [
  {id:"g1",title:"Geodis renforce sa presence en Asie du Sud-Est : ouverture de 3 nouveaux hubs",source:"Supply Chain Magazine",date:"2026-05-29",impact:"medium",categories:["global"],tag:"Logistique",summary:"Geodis annonce l'ouverture de trois nouveaux centres de distribution en Malaisie, Vietnam et Indonesie pour repondre a la demande croissante en e-commerce regional.",url:"https://supplychainmagazine.fr"},
  {id:"g2",title:"Transport maritime : les volumes mondiaux en hausse de 3.2% au T1 2026",source:"Lloyd's List",date:"2026-05-28",impact:"medium",categories:["global"],tag:"Transport",summary:"Les volumes de transport maritime mondial progressent de 3.2% sur le premier trimestre 2026, portés par la reprise des echanges Asie-Europe malgré les tensions en mer Rouge.",url:"https://lloydslist.com"},
  {id:"g3",title:"Supply chain : la reshoring europeenne s'accelere dans l'industrie automobile",source:"Les Echos",date:"2026-05-27",impact:"high",categories:["global"],tag:"Supply Chain",summary:"Plusieurs constructeurs automobiles europeens annoncent le rapatriement de production de composants critiques, impactant les flux logistiques et les fournisseurs asiatiques.",url:"https://lesechos.fr"},
  {id:"g4",title:"Reglementation CO2 transport : la Commission europeenne durcit les objectifs 2030",source:"Journal Officiel UE",date:"2026-05-25",impact:"high",categories:["global"],tag:"Reglementation",summary:"La Commission europeenne publie de nouveaux objectifs de reduction des emissions CO2 pour le secteur transport, avec des penalites renforcees pour les operateurs non conformes.",url:"https://ec.europa.eu"},
  {id:"g5",title:"Logistique urbaine : boom des solutions de livraison du dernier kilometre electrique",source:"Logistique Magazine",date:"2026-05-23",impact:"medium",categories:["global"],tag:"Innovation",summary:"Les investissements dans la logistique urbaine electrique explosent en Europe, avec une croissance de 45% des flottes de velos-cargos et vehicules electriques de livraison.",url:"https://logistique-magazine.com"},
];

const RISKS_DEFAULT = [
  {id:1,zone:"Mer Rouge / Bab-el-Mandeb",level:"critical",type:"Geopolitique",categories:["Flotte camion","Engins de manutention","Automatisation entrepot"],desc:"Attaques Houthis persistantes. Deroutement Cap de Bonne Esperance (+12-15j). Surcout fret +35-60%.",since:"Oct 2023",evol:"stable"},
  {id:2,zone:"Taiwan / Detroit de Formose",level:"high",type:"Geopolitique",categories:["Automatisation entrepot","Bornes de recharge"],desc:"Tensions sino-americaines. Risque fort sur composants electroniques et semi-conducteurs.",since:"Jan 2024",evol:"degradation"},
  {id:3,zone:"Chine (hubs logistiques)",level:"medium",type:"Supply chain",categories:["EPI / Workwear","Automatisation entrepot","Bornes de recharge"],desc:"Concentration fournisseurs critique. Risque de dependance unique sur plusieurs categories.",since:"Permanent",evol:"stable"},
  {id:4,zone:"Europe de l'Est",level:"medium",type:"Geopolitique",categories:["Flotte camion","Energie"],desc:"Conflit Ukraine persistant. Impact sur prix energie et routes transport Est-Ouest.",since:"Fev 2022",evol:"stable"},
  {id:5,zone:"Maroc / Maghreb",level:"low",type:"Supply chain",categories:["EPI / Workwear","Flotte automobile"],desc:"Montee en puissance comme zone de fabrication alternative. Risque instabilite politique modere.",since:"2023",evol:"amelioration"},
];

const CAL_DEFAULT = [
  {id:1,title:"Salon SITL Paris",date:"2026-06-10",endDate:"2026-06-12",type:"event",categories:["Flotte camion","Automatisation entrepot"],author:"Sam",location:"Paris Nord Villepinte"},
  {id:2,title:"Revue fournisseur Michelin",date:"2026-06-18",endDate:"",type:"meeting",categories:["Flotte camion","Flotte automobile"],author:"Sam",location:"Clermont-Ferrand"},
  {id:3,title:"Negociation contrat energie",date:"2026-07-03",endDate:"",type:"meeting",categories:["Energie"],author:"Sam",location:"Paris"},
  {id:4,title:"Formation CSRD equipe",date:"2026-06-25",endDate:"",type:"training",categories:["EPI / Workwear"],author:"Equipe",location:"En ligne"},
];

const USERS_KEY="pi_users_v8";
const SUPP_KEY="pi_supp_v6";
const CAL_KEY="pi_cal_v6";
const RISKS_KEY="pi_risks_v4";
const NEWS_CACHE_KEY="pi_news_v4";
const CUSTOM_IDX_KEY="pi_custom_idx_v1";

async function stGet(k:string){try{const r=await (window as any).storage.get(k);return r?JSON.parse(r.value):null;}catch{return null;}}
async function stSet(k:string,v:unknown,shared=false){try{await (window as any).storage.set(k,JSON.stringify(v),shared);}catch{}}

const IC:Record<string,string>={high:"#F87171",medium:"#FBBF24",low:"#34D399"};
const RC:Record<string,string>={critical:"#F87171",high:"#FB923C",medium:"#FBBF24",low:"#34D399"};
const RL:Record<string,string>={critical:"Critique",high:"Eleve",medium:"Modere",low:"Faible"};
const TAGBG:Record<string,string>={Geopolitique:"#7C3AED",Reglementation:"#0284C7",Marche:"#059669",Energie:"#D97706",Fournisseur:"#DB2777",Indice:"#4338CA",Achat:"#0891B2",Logistique:"#0891B2",Transport:"#F97316","Supply Chain":"#8B5CF6",Innovation:"#06B6D4"};

const S:Record<string,React.CSSProperties>={
  input:{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 14px",color:"#E2E8F0",fontSize:13,outline:"none",boxSizing:"border-box"},
  btn:{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",borderRadius:8,padding:"10px 20px",color:"white",fontSize:13,fontWeight:600,cursor:"pointer"},
  bsm:{background:"rgba(129,140,248,0.12)",border:"1px solid rgba(129,140,248,0.25)",borderRadius:6,padding:"5px 12px",color:"#818CF8",fontSize:12,fontWeight:600,cursor:"pointer"},
  card:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,overflow:"hidden"},
};

async function fetchFxRates():Promise<Record<string,number>|null>{
  if(!FX_KEY)return null;
  try{const r=await fetch(`https://v6.exchangerate-api.com/v6/${FX_KEY}/latest/EUR`);const d=await r.json();return d.result==="success"?d.conversion_rates:null;}catch{return null;}
}
async function fetchGNews(query:string):Promise<any[]>{
  if(!GNEWS_KEY)return[];
  try{const r=await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=fr&max=6&token=${GNEWS_KEY}`);const d=await r.json();return d.articles||[];}catch{return[];}
}

function Spark({values,color="#818CF8",w=72,h=28}:{values:number[];color?:string;w?:number;h?:number}){
  if(!values||values.length<2)return<svg width={w} height={h}/>;
  const mn=Math.min(...values),mx=Math.max(...values),rng=mx-mn||1;
  const pts=values.map((v,i)=>`${(i/(values.length-1))*w},${h-((v-mn)/rng)*(h-4)-2}`).join(" ");
  const uid="s"+color.replace(/[^a-z0-9]/gi,"")+(w+h);
  return(
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${uid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {values.map((v,i)=>i===values.length-1?<circle key={i} cx={(i/(values.length-1))*w} cy={h-((v-mn)/rng)*(h-4)-2} r="2.5" fill={color}/>:null)}
    </svg>
  );
}

function AIModal({title,prompt,onClose}:{title:string;prompt:string;onClose:()=>void}){
  const [text,setText]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{callGemini(prompt).then(t=>{setText(t);setLoading(false);});},[]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F172A",border:"1px solid rgba(129,140,248,0.4)",borderRadius:16,maxWidth:580,width:"100%",padding:28,maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:11,color:"#818CF8",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Analyse IA</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:24,lineHeight:1}}>x</button>
        </div>
        <div style={{fontSize:14,fontWeight:600,color:"#E2E8F0",marginBottom:16,lineHeight:1.5}}>{title}</div>
        <div style={{background:"rgba(129,140,248,0.05)",border:"1px solid rgba(129,140,248,0.15)",borderRadius:10,padding:16,minHeight:80}}>
          {loading?<div style={{color:"#64748B",fontSize:13}}>Analyse en cours...</div>:<div style={{color:"#CBD5E1",fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{text}</div>}
        </div>
        <button onClick={onClose} style={{...S.bsm,marginTop:16,width:"100%",textAlign:"center"}}>Fermer</button>
      </div>
    </div>
  );
}

function ForecastModal({idx,onClose}:{idx:Record<string,any>;onClose:()=>void}){
  const [hz,setHz]=useState("3m");const [res,setRes]=useState<any>(null);const [loading,setLoading]=useState(false);
  const [showJ,setShowJ]=useState(false);const [justif,setJustif]=useState("");const [jLoad,setJLoad]=useState(false);
  const HZ:Record<string,string>={"3m":"3 mois","6m":"6 mois","1y":"1 an"};
  const SC=[{key:"scenario_optimiste",label:"Optimiste",c:"#34D399"},{key:"scenario_central",label:"Central",c:"#FBBF24"},{key:"scenario_pessimiste",label:"Pessimiste",c:"#F87171"}];
  const run=async()=>{
    setLoading(true);setRes(null);setShowJ(false);setJustif("");
    const last=idx.values[idx.values.length-1];
    const p=`Tu es expert analyse marches et achats. Indice : ${idx.label} (${idx.unit}), source : ${idx.source}. Valeurs recentes : ${idx.values.join(", ")}. Tendance : ${idx.trend>=0?"+":""}${idx.trend}%. Valeur actuelle : ${last}. Horizon : ${HZ[hz]}. Reponds UNIQUEMENT en JSON valide sans markdown ni texte : {"scenario_optimiste":{"valeur":0,"variation_pct":0,"moteurs":["",""]},"scenario_central":{"valeur":0,"variation_pct":0,"moteurs":["",""]},"scenario_pessimiste":{"valeur":0,"variation_pct":0,"moteurs":["",""]},"niveau_confiance":"modere","signal_acheteur":""}`;
    const txt=await callGemini(p);
    try{
      let clean=txt.replace(/```json|```/g,"").trim();
      const start=clean.indexOf("{");const end=clean.lastIndexOf("}");
      if(start>=0&&end>=0) clean=clean.slice(start,end+1);
      setRes(JSON.parse(clean));
    }catch{setRes(null);}
    setLoading(false);
  };
  const runJ=async()=>{
    if(!res)return;setJLoad(true);setShowJ(true);setJustif("");
    const p=`Expert marches et achats. Indice ${idx.label}, prevision a ${HZ[hz]}. Optimiste: ${res.scenario_optimiste?.valeur} ${idx.unit}. Central: ${res.scenario_central?.valeur}. Pessimiste: ${res.scenario_pessimiste?.valeur}. Explique en 6 phrases la methodologie, facteurs cles, risques et indicateurs a surveiller.`;
    setJustif(await callGemini(p));setJLoad(false);
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24,overflowY:"auto"}}>
      <div style={{background:"#0F172A",border:"1px solid rgba(129,140,248,0.35)",borderRadius:16,width:"100%",maxWidth:560,padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:11,color:"#818CF8",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Prevision IA</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:24}}>x</button>
        </div>
        <div style={{fontSize:16,fontWeight:700,color:"#F8FAFC",marginBottom:18}}>{idx.label}</div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {Object.entries(HZ).map(([k,v])=>(
            <button key={k} onClick={()=>setHz(k)} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1px solid ${hz===k?"#818CF8":"rgba(255,255,255,0.08)"}`,background:hz===k?"rgba(129,140,248,0.15)":"transparent",color:hz===k?"#818CF8":"#64748B",fontSize:12,fontWeight:600,cursor:"pointer"}}>{v}</button>
          ))}
        </div>
        <button onClick={run} disabled={loading} style={{...S.btn,width:"100%",marginBottom:18,opacity:loading?0.6:1}}>{loading?"Calcul en cours...":"Generer les scenarios"}</button>
        {res&&(<div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            {SC.map(({key,label,c})=>{const sc=res[key];if(!sc)return null;return(
              <div key={key} style={{background:c+"08",border:"1px solid "+c+"25",borderRadius:10,padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}><div style={{fontSize:12,fontWeight:600,color:c}}>{label}</div><div style={{fontSize:11,color:"#64748B"}}>{sc.variation_pct>=0?"+":""}{sc.variation_pct}%</div></div>
                <div style={{fontSize:20,fontWeight:700,color:"#F8FAFC",margin:"4px 0"}}>{sc.valeur?.toLocaleString("fr-FR")} <span style={{fontSize:11,color:"#64748B"}}>{idx.unit}</span></div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:5}}>{sc.moteurs?.map((m:string,i:number)=><span key={i} style={{fontSize:10,color:"#94A3B8",background:"rgba(255,255,255,0.04)",padding:"2px 8px",borderRadius:8}}>{m}</span>)}</div>
              </div>
            );})}
          </div>
          {res.signal_acheteur&&<div style={{padding:"10px 14px",background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:8,fontSize:12,color:"#CBD5E1",lineHeight:1.6,marginBottom:12}}><span style={{color:"#818CF8",fontWeight:600}}>Signal acheteur : </span>{res.signal_acheteur}</div>}
          <button onClick={()=>{if(showJ)setShowJ(false);else runJ();}} style={{...S.bsm,width:"100%",padding:"8px 0",textAlign:"center"}}>{showJ?"Masquer":"Voir la justification"}</button>
          {showJ&&<div style={{marginTop:10,padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,fontSize:12,color:"#94A3B8",lineHeight:1.8}}>{jLoad?"Chargement...":justif}</div>}
        </div>)}
      </div>
    </div>
  );
}

function IndexSearchModal({userIndices,onAdd,onClose,customIndices,onAddCustom}:{userIndices:string[];onAdd:(id:string)=>void;onClose:()=>void;customIndices:Record<string,any>[];onAddCustom:(idx:Record<string,any>)=>void}){
  const [q,setQ]=useState("");
  const [aiSearch,setAiSearch]=useState("");
  const [aiResults,setAiResults]=useState<any[]>([]);
  const [aiLoading,setAiLoading]=useState(false);
  const allIds=[...userIndices,...customIndices.map((c:any)=>c.id)];
  const avail=ALL_INDICES.filter(i=>!allIds.includes(i.id)&&(i.label.toLowerCase().includes(q.toLowerCase())||i.category.toLowerCase().includes(q.toLowerCase())));

  const searchAI=async()=>{
    if(!aiSearch.trim())return;
    setAiLoading(true);setAiResults([]);
    const p=`Tu es expert en marches financiers et indices economiques. L'utilisateur cherche des indices relatifs a : "${aiSearch}". Propose 3-4 indices pertinents qui n'existent pas encore dans cette liste : ${ALL_INDICES.map(i=>i.label).join(", ")}. Reponds UNIQUEMENT en JSON valide sans markdown : [{"id":"custom_xxx","label":"Nom de l'indice","category":"Categorie","unit":"Unite","source":"Source officielle","description":"Description courte","trend":0.5}]`;
    const txt=await callGemini(p);
    try{const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());setAiResults(Array.isArray(parsed)?parsed:[]);}catch{setAiResults([]);}
    setAiLoading(false);
  };

  const addCustom=(idx:any)=>{
    const newIdx={...idx,values:[100,101,102,103,104,105,106],id:idx.id+"_"+Date.now()};
    onAddCustom(newIdx);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F172A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,width:"100%",maxWidth:560,padding:24,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:600,color:"#E2E8F0"}}>Ajouter un indice</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:24}}>x</button>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Recherche dans la base</div>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher..." style={{...S.input,marginBottom:8}} autoFocus/>
          <div style={{maxHeight:140,overflowY:"auto"}}>
            {avail.length===0&&q&&<div style={{color:"#475569",fontSize:12,padding:8}}>Aucun resultat dans la base</div>}
            {avail.map(idx=>(
              <div key={idx.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,marginBottom:4,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{flex:1}}><div style={{fontSize:12,color:"#E2E8F0",fontWeight:500}}>{idx.label}</div><div style={{fontSize:10,color:"#475569"}}>{idx.category} - {idx.source} - {idx.unit}</div></div>
                <button onClick={()=>onAdd(idx.id)} style={S.bsm}>+ Ajouter</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",paddingTop:16}}>
          <div style={{fontSize:11,color:"#818CF8",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Recherche IA - trouver d'autres indices</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={aiSearch} onChange={e=>setAiSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchAI()} placeholder="Ex: indice prix acier Europe, fret aerien..." style={{...S.input,flex:1}}/>
            <button onClick={searchAI} disabled={aiLoading} style={{...S.btn,flexShrink:0,opacity:aiLoading?0.6:1,padding:"10px 14px"}}>{aiLoading?"...":"Chercher"}</button>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {aiResults.map((idx,i)=>(
              <div key={i} style={{padding:"10px 12px",borderRadius:8,marginBottom:6,background:"rgba(129,140,248,0.05)",border:"1px solid rgba(129,140,248,0.15)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div>
                    <div style={{fontSize:13,color:"#E2E8F0",fontWeight:600}}>{idx.label}</div>
                    <div style={{fontSize:11,color:"#475569"}}>{idx.category} - {idx.source} - {idx.unit}</div>
                  </div>
                  <button onClick={()=>addCustom(idx)} style={{...S.bsm,fontSize:10,padding:"3px 10px",flexShrink:0}}>+ Ajouter</button>
                </div>
                {idx.description&&<div style={{fontSize:11,color:"#64748B"}}>{idx.description}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexDetailModal({idx,liveValue,onClose}:{idx:Record<string,any>;liveValue?:number;onClose:()=>void}){
  const color=Object.values(CATS).find(c=>c.indices.includes(idx.id))?.color||"#818CF8";
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const rawValues=liveValue?[...idx.values.slice(0,-1),liveValue]:idx.values;
  const displayValues=rawValues;
  const last=displayValues[displayValues.length-1];
  const totalVar=((last-displayValues[0])/displayValues[0]*100).toFixed(1);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0F172A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,width:"100%",maxWidth:600,padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
          <div>
            <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{idx.category} - {idx.source}</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F8FAFC"}}>{idx.label}</div>
            {liveValue&&<div style={{fontSize:11,color:"#34D399",marginTop:2}}>Valeur live disponible</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:24}}>x</button>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,color:"#475569"}}>Periode debut</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{...S.input,width:150,padding:"6px 10px",fontSize:12}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <div style={{fontSize:10,color:"#475569"}}>Periode fin</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{...S.input,width:150,padding:"6px 10px",fontSize:12}}/>
          </div>
          {(dateFrom||dateTo)&&<div style={{display:"flex",alignItems:"flex-end"}}><button onClick={()=>{setDateFrom("");setDateTo("");}} style={{...S.bsm,fontSize:11}}>Reinitialiser</button></div>}
        </div>
        {(dateFrom||dateTo)&&<div style={{fontSize:11,color:"#FBBF24",marginBottom:10,padding:"6px 10px",background:"rgba(251,191,36,0.08)",borderRadius:6}}>
          Periode affichee : {dateFrom?new Date(dateFrom).toLocaleDateString("fr-FR",{month:"short",year:"numeric"}):"debut"} → {dateTo?new Date(dateTo).toLocaleDateString("fr-FR",{month:"short",year:"numeric"}):"aujourd'hui"} — Historique etendu disponible via APIs CNR, INSEE, LME ou ECB.
        </div>}
        {(!dateFrom&&!dateTo)&&<div style={{fontSize:10,color:"#475569",marginBottom:10}}>Donnees sur 7 mois — utilisez les filtres de periode ci-dessus pour une vue personnalisee</div>}

        <Spark values={displayValues} color={color} w={520} h={90}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:16}}>
          {[
            {l:"Valeur actuelle",v:`${last.toLocaleString("fr-FR")} ${idx.unit}`},
            {l:"Variation periode",v:`${Number(totalVar)>=0?"+":""}${totalVar}%`},
            {l:"Min",v:Math.min(...displayValues).toLocaleString("fr-FR")},
            {l:"Max",v:Math.max(...displayValues).toLocaleString("fr-FR")},
          ].map(k=>(
            <div key={k.l} style={{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:4}}>{k.l}</div>
              <div style={{fontSize:13,fontWeight:700,color:"#F8FAFC"}}>{k.v}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{...S.bsm,marginTop:16,width:"100%",textAlign:"center"}}>Fermer</button>
      </div>
    </div>
  );
}

function ResumeButton({items,label}:{items:any[];label:string}){
  const [modal,setModal]=useState(false);
  const prompt=`Tu es expert achats. Voici ${items.length} actualites recentes pour une equipe d'acheteurs :\n${items.map((n,i)=>`${i+1}. ${n.title}${n.summary?" - "+n.summary:""}`).join("\n")}\n\nFais un resume executif en 5 points cles pour un directeur des achats. Identifie les signaux forts, les risques immediats et les opportunites. Style direct et professionnel.`;
  return(<>
    <button onClick={()=>setModal(true)} style={{...S.bsm,fontSize:11}}>{label}</button>
    {modal&&<AIModal title={"Resume IA - "+label} prompt={prompt} onClose={()=>setModal(false)}/>}
  </>);
}

function RisksUpdateButton({categories,onUpdate}:{categories:string[];onUpdate:(risks:any[])=>void}){
  const [loading,setLoading]=useState(false);
  const update=async()=>{
    setLoading(true);
    const cats=categories.join(", ");
    const prompt=`Tu es expert risk management et achats. Categories gerees : ${cats}. Date : ${new Date().toLocaleDateString("fr-FR")}. Genere une liste de 5 risques geopolitiques et supply chain actuels pertinents pour ces categories. Reponds UNIQUEMENT en JSON valide sans markdown : [{"id":1,"zone":"Zone geographique","level":"critical|high|medium|low","type":"Geopolitique|Supply chain|Reglementaire","categories":["cat1"],"desc":"Description concrete 1-2 phrases","since":"Date approximative","evol":"stable|degradation|amelioration"}]. Bases-toi sur l'actualite mondiale recente.`;
    const txt=await callGemini(prompt);
    try{const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());if(Array.isArray(parsed)){onUpdate(parsed);await stSet(RISKS_KEY,parsed);}}catch{}
    setLoading(false);
  };
  return(<button onClick={update} disabled={loading} style={{...S.bsm,opacity:loading?0.6:1}}>{loading?"Mise a jour...":"Actualiser avec IA"}</button>);
}


function Onboarding({onComplete}:{onComplete:(u:Record<string,any>)=>void}){
  const [step,setStep]=useState(0);const [name,setName]=useState("");const [email,setEmail]=useState("");
  const [cats,setCats]=useState<string[]>([]);const [idxs,setIdxs]=useState<string[]>([]);
  const toggleCat=(c:string)=>{const next=cats.includes(c)?cats.filter(x=>x!==c):[...cats,c];setCats(next);setIdxs([...new Set(next.flatMap(x=>CATS[x]?.indices||[]))]);};
  const toggleIdx=(id:string)=>setIdxs(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const grouped=ALL_INDICES.reduce((a:{[k:string]:typeof ALL_INDICES},i)=>({...a,[i.category]:[...(a[i.category]||[]),i]}),{});
  return(
    <div style={{minHeight:"100vh",background:"#070D1A",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif",color:"#E2E8F0"}}>
      <div style={{width:"100%",maxWidth:620}}>
        <div style={{display:"flex",gap:6,marginBottom:40}}>{[0,1,2].map(i=><div key={i} style={{height:3,flex:1,borderRadius:2,background:i<=step?"#818CF8":"rgba(255,255,255,0.07)",transition:"background .3s"}}/>)}</div>
        {step===0&&(<div>
          <div style={{fontSize:11,color:"#818CF8",letterSpacing:2,textTransform:"uppercase",marginBottom:12,fontWeight:700}}>INTEL - Veille Marches Achats</div>
          <div style={{fontSize:26,fontWeight:700,color:"#F8FAFC",marginBottom:6}}>Creer votre compte</div>
          <div style={{fontSize:13,color:"#475569",marginBottom:32}}>Plateforme de veille personnalisee pour equipes achat</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom et Prenom" style={S.input}/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email professionnel" type="email" style={S.input}/></div>
          <button onClick={()=>name&&email&&setStep(1)} style={{...S.btn,width:"100%",marginTop:24,padding:"13px 20px",opacity:name&&email?1:0.4}}>Continuer</button>
        </div>)}
        {step===1&&(<div>
          <div style={{fontSize:22,fontWeight:700,color:"#F8FAFC",marginBottom:6}}>Vos categories</div>
          <div style={{fontSize:13,color:"#475569",marginBottom:24}}>Selectionnez les marches que vous gerez</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {Object.entries(CATS).map(([cat,m])=>{const sel=cats.includes(cat);return(
              <div key={cat} onClick={()=>toggleCat(cat)} style={{padding:"14px 16px",borderRadius:12,cursor:"pointer",border:`1px solid ${sel?m.color:"rgba(255,255,255,0.08)"}`,background:sel?m.color+"12":"rgba(255,255,255,0.02)",transition:"all .2s"}}>
                <div style={{fontSize:22,marginBottom:6}}>{m.icon}</div><div style={{fontSize:12,fontWeight:600,color:sel?m.color:"#94A3B8"}}>{cat}</div>
              </div>
            );})}
          </div>
          <button onClick={()=>cats.length&&setStep(2)} style={{...S.btn,width:"100%",marginTop:24,padding:"13px 20px",opacity:cats.length?1:0.4}}>Continuer ({cats.length})</button>
        </div>)}
        {step===2&&(<div>
          <div style={{fontSize:22,fontWeight:700,color:"#F8FAFC",marginBottom:6}}>Vos indices</div>
          <div style={{fontSize:13,color:"#475569",marginBottom:24}}>Preselection basee sur vos categories</div>
          <div style={{maxHeight:420,overflowY:"auto",paddingRight:4}}>
            {Object.entries(grouped).map(([cat,items])=>(
              <div key={cat} style={{marginBottom:18}}>
                <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{cat}</div>
                {items.map(idx=>{const sel=idxs.includes(idx.id);return(
                  <div key={idx.id} onClick={()=>toggleIdx(idx.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,cursor:"pointer",marginBottom:5,background:sel?"rgba(129,140,248,0.07)":"rgba(255,255,255,0.02)",border:`1px solid ${sel?"rgba(129,140,248,0.25)":"rgba(255,255,255,0.05)"}`,transition:"all .15s"}}>
                    <div style={{width:15,height:15,borderRadius:4,border:`2px solid ${sel?"#818CF8":"#334155"}`,background:sel?"#818CF8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<span style={{color:"white",fontSize:9}}>v</span>}</div>
                    <span style={{flex:1,fontSize:12,color:sel?"#E2E8F0":"#94A3B8",fontWeight:sel?500:400}}>{idx.label}</span>
                    <span style={{fontSize:10,color:"#475569"}}>{idx.unit}</span>
                    <span style={{fontSize:11,fontWeight:600,color:idx.trend>=0?"#F87171":"#34D399"}}>{idx.trend>=0?"^":"v"} {Math.abs(idx.trend)}%</span>
                  </div>
                );})}
              </div>
            ))}
          </div>
          <button onClick={()=>onComplete({name,email,categories:cats,indices:idxs})} style={{...S.btn,width:"100%",marginTop:16,padding:"13px 20px"}}>Acceder au dashboard</button>
        </div>)}
      </div>
    </div>
  );
}

function SuppliersTab({userCats}:{userCats:string[]}){
  const [suppliers,setSuppliers]=useState<Record<string,any>[]>([]);
  const [step,setStep]=useState<"list"|"search"|"verify"|"add">("list");
  const [searchQuery,setSearchQuery]=useState("");
  const [searchResults,setSearchResults]=useState<any[]>([]);
  const [searching,setSearching]=useState(false);
  const [selectedResult,setSelectedResult]=useState<any>(null);
  const [analyzing,setAnalyzing]=useState<Record<string,any>|null>(null);
  const [financialData,setFinancialData]=useState<Record<string,any>|null>(null);
  const [loadingFin,setLoadingFin]=useState(false);
  const [form,setForm]=useState({name:"",category:"",country:"",criticality:"medium",website:""});
  const CL:Record<string,string>={high:"#F87171",medium:"#FBBF24",low:"#34D399"};
  const CLab:Record<string,string>={high:"Critique",medium:"Important",low:"Standard"};

  useEffect(()=>{stGet(SUPP_KEY).then(d=>setSuppliers(d||[]));},[]);
  const save=async(l:Record<string,any>[])=>{setSuppliers(l);await stSet(SUPP_KEY,l,true);};

  const searchSupplier=async()=>{
    if(!searchQuery.trim())return;
    setSearching(true);setSearchResults([]);
    const prompt=`Tu es un assistant expert en fournisseurs industriels et logistiques. L'utilisateur recherche : "${searchQuery}". Meme pour les grands groupes connus (Toyota Industries, KION Group, Jungheinrich, Michelin, Lyreco, Legrand, Schneider Electric, Crown Equipment, Hyster-Yale, etc.), fournis leurs informations reelles et precises. Reponds UNIQUEMENT en JSON valide sans markdown : {"found":true,"results":[{"name":"Nom officiel complet","country":"Pays siege social","website":"https://site-officiel.com","sector":"Secteur precis","description":"Description 1 phrase avec positionnement marche","employees":"Effectifs approximatifs","revenue":"CA annuel approximatif"}]} avec 2-3 resultats dont le principal en premier.`;
    const txt=await callGemini(prompt);
    try{const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());setSearchResults(parsed.results||[]);}catch{setSearchResults([]);}
    setSearching(false);setStep("verify");
  };

  const confirmSupplier=async(result:any)=>{
    setSelectedResult(result);
    setForm({name:result.name,category:form.category||"",country:result.country||"",criticality:"medium",website:result.website||""});
    setStep("add");
  };

  const add=async()=>{
    if(!form.name||!form.category)return;
    const newSupplier={...form,id:Date.now(),addedAt:new Date().toLocaleDateString("fr-FR"),verified:!!selectedResult,aiData:selectedResult||null};
    await save([...suppliers,newSupplier]);
    setForm({name:"",category:"",country:"",criticality:"medium",website:""});
    setSelectedResult(null);setSearchQuery("");setStep("list");
  };

  const loadFinancial=async(s:Record<string,any>)=>{
    setLoadingFin(true);setFinancialData(null);
    const prompt=`Tu es expert en analyse financiere. Fournisseur : ${s.name} (${s.country||"pays inconnu"}, secteur : ${s.category}). Recherche et fournis les donnees financieres publiques disponibles. Reponds en JSON valide sans markdown : {"ca":"Chiffre d'affaires annuel si public","resultat_net":"Resultat net si public","effectifs":"Nombre d'employes","notation":"Notation de risque (Excellent/Bon/Moyen/Risque) basee sur informations publiques","endettement":"Niveau d'endettement si connu","source":"Source des donnees","disponible":true,"message":"Message si donnees non disponibles publiquement"}. Si les donnees ne sont pas disponibles publiquement, indique disponible:false et explique dans message.`;
    const txt=await callGemini(prompt);
    try{const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());setFinancialData(parsed);}catch{setFinancialData({disponible:false,message:"Impossible de recuperer les donnees. Recherche manuelle recommandee sur Societe.com, Infogreffe ou Kompass."});}
    setLoadingFin(false);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>Fournisseurs</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>Referentiel partage - {suppliers.length} fournisseurs</div></div>
        {step==="list"&&<button onClick={()=>setStep("search")} style={S.btn}>+ Ajouter</button>}
        {step!=="list"&&<button onClick={()=>{setStep("list");setSearchQuery("");setSearchResults([]);setSelectedResult(null);}} style={S.bsm}>Annuler</button>}
      </div>

      {step==="search"&&(<div style={{...S.card,padding:20,marginBottom:20,border:"1px solid rgba(129,140,248,0.3)"}}>
        <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:6}}>Rechercher un fournisseur</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:16}}>Entrez le nom — l'IA va le rechercher et valider ses informations</div>
        <div style={{display:"flex",gap:10}}>
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchSupplier()} placeholder="Ex: Michelin, Toyota Industries, Lyreco..." style={{...S.input,flex:1}}/>
          <button onClick={searchSupplier} disabled={searching} style={{...S.btn,opacity:searching?0.6:1,flexShrink:0}}>{searching?"Recherche...":"Rechercher"}</button>
        </div>
      </div>)}

      {step==="verify"&&(<div style={{...S.card,padding:20,marginBottom:20,border:"1px solid rgba(129,140,248,0.3)"}}>
        <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:6}}>Resultats pour "{searchQuery}"</div>
        <div style={{fontSize:12,color:"#475569",marginBottom:16}}>Selectionnez le bon fournisseur ou affinez votre recherche</div>
        {searchResults.length===0&&<div style={{color:"#475569",fontSize:13,textAlign:"center",padding:16}}>Aucun resultat - essayez un nom plus precis</div>}
        {searchResults.map((r,i)=>(
          <div key={i} style={{padding:"14px 16px",borderRadius:10,marginBottom:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div><div style={{fontSize:14,fontWeight:700,color:"#F8FAFC"}}>{r.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:2}}>📍 {r.country} - {r.sector}</div></div>
              <button onClick={()=>confirmSupplier(r)} style={{...S.btn,fontSize:11,padding:"6px 14px",flexShrink:0}}>C'est lui</button>
            </div>
            <div style={{fontSize:12,color:"#94A3B8",marginBottom:4}}>{r.description}</div>
            {r.website&&<div style={{fontSize:11,color:"#818CF8"}}>{r.website}</div>}
          </div>
        ))}
        <button onClick={()=>setStep("search")} style={{...S.bsm,marginTop:8}}>Nouvelle recherche</button>
      </div>)}

      {step==="add"&&(<div style={{...S.card,padding:20,marginBottom:20,border:"1px solid rgba(129,140,248,0.3)"}}>
        <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:4}}>Confirmer le fournisseur</div>
        {selectedResult&&<div style={{fontSize:12,color:"#34D399",marginBottom:16}}>Fournisseur verifie : {selectedResult.name}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Nom *" style={S.input}/>
          <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={S.input}><option value="">Categorie *</option>{Object.keys(CATS).map(c=><option key={c} value={c}>{c}</option>)}</select>
          <input value={form.country} onChange={e=>setForm(p=>({...p,country:e.target.value}))} placeholder="Pays" style={S.input}/>
          <select value={form.criticality} onChange={e=>setForm(p=>({...p,criticality:e.target.value}))} style={S.input}><option value="high">Critique</option><option value="medium">Important</option><option value="low">Standard</option></select>
          <input value={form.website} onChange={e=>setForm(p=>({...p,website:e.target.value}))} placeholder="Site web" style={{...S.input,gridColumn:"1/-1"}}/>
        </div>
        <div style={{display:"flex",gap:10}}><button onClick={add} disabled={!form.category} style={{...S.btn,opacity:form.category?1:0.4}}>Enregistrer</button><button onClick={()=>setStep("verify")} style={S.bsm}>Retour</button></div>
      </div>)}

      {suppliers.length===0&&step==="list"&&(<div style={{...S.card,padding:48,textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>🏢</div><div style={{fontSize:14,color:"#475569"}}>Aucun fournisseur enregistre</div></div>)}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {suppliers.map(s=>{const meta=CATS[s.category];return(
          <div key={s.id} style={{...S.card,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#F8FAFC"}}>{s.name}</div>
                  {s.verified&&<span style={{fontSize:9,color:"#34D399",background:"rgba(52,211,153,0.1)",padding:"1px 6px",borderRadius:8}}>Verifie</span>}
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                  {meta&&<span style={{fontSize:10,color:meta.color,background:meta.color+"15",padding:"2px 8px",borderRadius:10}}>{meta.icon} {s.category}</span>}
                  {s.country&&<span style={{fontSize:10,color:"#64748B"}}>📍 {s.country}</span>}
                </div>
              </div>
              <span style={{fontSize:10,fontWeight:600,color:CL[s.criticality],background:CL[s.criticality]+"15",padding:"3px 10px",borderRadius:10,flexShrink:0}}>{CLab[s.criticality]}</span>
            </div>
            {s.website&&<div style={{fontSize:11,color:"#818CF8",marginBottom:6}}>{s.website}</div>}
            <div style={{fontSize:11,color:"#334155",marginBottom:10}}>Ajoute le {s.addedAt}</div>

            {s.aiData&&(<div style={{padding:"8px 12px",background:"rgba(129,140,248,0.05)",borderRadius:8,marginBottom:10,fontSize:11,color:"#94A3B8"}}>
              {s.aiData.description&&<div style={{marginBottom:3}}>{s.aiData.description}</div>}
              {s.aiData.employees&&<div style={{color:"#64748B"}}>Effectifs : {s.aiData.employees}</div>}
            </div>)}

            {financialData&&analyzing?.id===s.id&&(
              <div style={{padding:"10px 12px",background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.15)",borderRadius:8,marginBottom:10,fontSize:11}}>
                {financialData.disponible===false
                  ?<div style={{color:"#FBBF24"}}>{financialData.message}</div>
                  :<div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {financialData.ca&&<div style={{color:"#94A3B8"}}>CA : <span style={{color:"#E2E8F0",fontWeight:600}}>{financialData.ca}</span></div>}
                    {financialData.resultat_net&&<div style={{color:"#94A3B8"}}>Resultat net : <span style={{color:"#E2E8F0",fontWeight:600}}>{financialData.resultat_net}</span></div>}
                    {financialData.effectifs&&<div style={{color:"#94A3B8"}}>Effectifs : <span style={{color:"#E2E8F0",fontWeight:600}}>{financialData.effectifs}</span></div>}
                    {financialData.notation&&<div style={{color:"#94A3B8"}}>Notation risque : <span style={{color:financialData.notation==="Excellent"?"#34D399":financialData.notation==="Bon"?"#FBBF24":"#F87171",fontWeight:600}}>{financialData.notation}</span></div>}
                    {financialData.source&&<div style={{color:"#334155",marginTop:4}}>Source : {financialData.source}</div>}
                  </div>
                }
              </div>
            )}

            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setAnalyzing(s)} style={{...S.bsm,flex:1,textAlign:"center",fontSize:11}}>Analyser (IA)</button>
              <button onClick={()=>{setAnalyzing(s);loadFinancial(s);}} disabled={loadingFin&&analyzing?.id===s.id} style={{...S.bsm,fontSize:11,color:"#34D399",borderColor:"rgba(52,211,153,0.3)",background:"rgba(52,211,153,0.08)"}}>
                {loadingFin&&analyzing?.id===s.id?"Chargement...":"Donnees fin."}
              </button>
              <button onClick={()=>save(suppliers.filter(x=>x.id!==s.id))} style={{...S.bsm,color:"#F87171",borderColor:"rgba(248,113,113,0.3)",background:"rgba(248,113,113,0.08)",fontSize:11}}>Suppr.</button>
            </div>
          </div>
        );})}
      </div>
      {analyzing&&step==="list"&&<AIModal title={"Analyse : "+analyzing.name} prompt={"Tu es expert achats et risk management. Analyse ce fournisseur : Nom : "+analyzing.name+" | Categorie : "+analyzing.category+" | Pays : "+(analyzing.country||"non precise")+" | Criticite : "+analyzing.criticality+(analyzing.website?" | Site : "+analyzing.website:"")+". Fournis une analyse en 5 points : 1) Profil et positionnement marche 2) Risques identifiables 3) Points de vigilance specifiques a la categorie "+analyzing.category+" 4) Actualite recente et signaux a surveiller 5) Recommandation acheteur."} onClose={()=>setAnalyzing(null)}/>}
    </div>
  );
}

function CalendarTab({user}:{user:Record<string,any>}){
  const [events,setEvents]=useState<Record<string,any>[]>([]);
  const [showAdd,setShowAdd]=useState(false);const [editing,setEditing]=useState<Record<string,any>|null>(null);
  const [form,setForm]=useState<{title:string;date:string;endDate:string;type:string;categories:string[];location:string}>({title:"",date:"",endDate:"",type:"meeting",categories:[],location:""});
  const TC:Record<string,string>={meeting:"#818CF8",event:"#F97316",training:"#34D399",deadline:"#F87171"};
  const TL:Record<string,string>={meeting:"Reunion",event:"Evenement",training:"Formation",deadline:"Echeance"};
  const TI:Record<string,string>={meeting:"\uD83E\uDD1D",event:"\uD83D\uDCC5",training:"\uD83D\uDCDA",deadline:"\u23F0"};
  useEffect(()=>{stGet(CAL_KEY).then(d=>setEvents(d||CAL_DEFAULT));},[]);
  const save=async(l:Record<string,any>[])=>{setEvents(l);await stSet(CAL_KEY,l,true);};
  const submit=async()=>{
    if(!form.title||!form.date)return;
    if(editing){await save(events.map(e=>e.id===editing.id?{...e,...form}:e));setEditing(null);}
    else{await save([...events,{...form,id:Date.now(),author:user.name}]);}
    setForm({title:"",date:"",endDate:"",type:"meeting",categories:[],location:""});setShowAdd(false);
  };
  const startEdit=(e:Record<string,any>)=>{setEditing(e);setForm({title:e.title,date:e.date,endDate:e.endDate||"",type:e.type,categories:e.categories||[],location:e.location||""});setShowAdd(true);};
  const toggleCat=(c:string)=>setForm(p=>({...p,categories:p.categories.includes(c)?p.categories.filter(x=>x!==c):[...p.categories,c]}));
  const now=new Date();
  const upcoming=[...events].sort((a,b)=>new Date(a.date).getTime()-new Date(b.date).getTime()).filter(e=>new Date(e.date)>=new Date(now.toDateString()));
  const past=[...events].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).filter(e=>new Date(e.date)<new Date(now.toDateString()));
  const ECard=({e}:{e:Record<string,any>})=>(
    <div style={{...S.card,padding:16,marginBottom:10}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{width:38,height:38,borderRadius:10,background:TC[e.type]+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{TI[e.type]}</div>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>{e.title}</div>
            <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:8}}>
              <button onClick={()=>startEdit(e)} style={{background:"none",border:"none",color:"#818CF8",cursor:"pointer",fontSize:11,padding:0}}>Modifier</button>
              <button onClick={()=>save(events.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:11,padding:0}}>Suppr.</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:TC[e.type],fontWeight:600}}>{TL[e.type]}</span>
            <span style={{fontSize:11,color:"#475569"}}>📅 {new Date(e.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}{e.endDate?" > "+new Date(e.endDate).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):""}</span>
            {e.location&&<span style={{fontSize:11,color:"#475569"}}>📍 {e.location}</span>}
            <span style={{fontSize:11,color:"#334155"}}>👤 {e.author}</span>
          </div>
          {e.categories?.length>0&&<div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>{e.categories.map((c:string)=><span key={c} style={{fontSize:10,color:CATS[c]?.color||"#64748B",background:(CATS[c]?.color||"#64748B")+"15",padding:"1px 7px",borderRadius:8}}>{CATS[c]?.icon} {c}</span>)}</div>}
        </div>
      </div>
    </div>
  );
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>Calendrier equipe</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>Deplacements et evenements partages</div></div>
        <button onClick={()=>{setEditing(null);setForm({title:"",date:"",endDate:"",type:"meeting",categories:[],location:""});setShowAdd(true);}} style={S.btn}>+ Ajouter</button>
      </div>
      {showAdd&&(<div style={{...S.card,padding:20,marginBottom:20,border:"1px solid rgba(129,140,248,0.3)"}}>
        <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:14}}>{editing?"Modifier l'evenement":"Nouvel evenement"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Titre *" style={{...S.input,gridColumn:"1/-1"}}/>
          <div><div style={{fontSize:11,color:"#475569",marginBottom:5}}>Date debut *</div><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={S.input}/></div>
          <div><div style={{fontSize:11,color:"#475569",marginBottom:5}}>Date fin</div><input type="date" value={form.endDate} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))} style={S.input}/></div>
          <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={S.input}><option value="meeting">Reunion / Visite fournisseur</option><option value="event">Salon / Evenement</option><option value="training">Formation</option><option value="deadline">Echeance contractuelle</option></select>
          <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="Lieu" style={S.input}/>
        </div>
        <div style={{marginBottom:12}}><div style={{fontSize:11,color:"#475569",marginBottom:8}}>Categories</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(CATS).map(([c,m])=><div key={c} onClick={()=>toggleCat(c)} style={{fontSize:11,padding:"4px 10px",borderRadius:8,cursor:"pointer",border:`1px solid ${form.categories.includes(c)?m.color:"rgba(255,255,255,0.08)"}`,background:form.categories.includes(c)?m.color+"15":"transparent",color:form.categories.includes(c)?m.color:"#64748B"}}>{m.icon} {c}</div>)}</div></div>
        <div style={{display:"flex",gap:10}}><button onClick={submit} style={S.btn}>{editing?"Enregistrer les modifications":"Ajouter"}</button><button onClick={()=>{setShowAdd(false);setEditing(null);}} style={S.bsm}>Annuler</button></div>
      </div>)}
      {upcoming.length>0&&<div style={{marginBottom:24}}><div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>A venir ({upcoming.length})</div>{upcoming.map(e=><ECard key={e.id} e={e}/>)}</div>}
      {past.length>0&&<div style={{opacity:.45}}><div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Passes</div>{past.map(e=><ECard key={e.id} e={e}/>)}</div>}
      {events.length===0&&<div style={{...S.card,padding:48,textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>📅</div><div style={{fontSize:14,color:"#475569"}}>Aucun evenement planifie</div></div>}
    </div>
  );
}

function Dashboard({user,onLogout,onUpdate}:{user:Record<string,any>;onLogout:()=>void;onUpdate:(u:Record<string,any>)=>void}){
  const [tab,setTab]=useState("dashboard");
  const [u,setU]=useState(user);
  const [aiModal,setAiModal]=useState<{title:string;prompt:string}|null>(null);
  const [forecastIdx,setForecastIdx]=useState<Record<string,any>|null>(null);
  const [detailIdx,setDetailIdx]=useState<Record<string,any>|null>(null);
  const [idxSearch,setIdxSearch]=useState(false);
  const [customIndices,setCustomIndices]=useState<Record<string,any>[]>([]);
  const [newsFilter,setNewsFilter]=useState("all");
  const [newsDateFrom,setNewsDateFrom]=useState("");
  const [techFilter,setTechFilter]=useState("all");
  const [techDateFrom,setTechDateFrom]=useState("");
  const [showGlobal,setShowGlobal]=useState(true);
  const [risks,setRisks]=useState<Record<string,any>[]>([]);
  const [liveNews,setLiveNews]=useState<Record<string,any>[]>([]);
  const [loadingNews,setLoadingNews]=useState(false);
  const [liveValues,setLiveValues]=useState<Record<string,number>>({});
  const [lastRefresh,setLastRefresh]=useState<Date|null>(null);

  useEffect(()=>{
    stGet(RISKS_KEY).then(d=>setRisks(d||RISKS_DEFAULT));
    stGet(CUSTOM_IDX_KEY).then(d=>setCustomIndices(d||[]));
  },[]);

  const refreshData=useCallback(async()=>{
    setLoadingNews(true);
    const cached=await stGet(NEWS_CACHE_KEY);
    const cacheAge=cached?.timestamp?Date.now()-cached.timestamp:Infinity;
    if(cacheAge<3600000&&cached?.articles?.length>0){setLiveNews(cached.articles);setLoadingNews(false);setLastRefresh(new Date(cached.timestamp));return;}
    if(GNEWS_KEY){
      const keywords=u.categories.flatMap((c:string)=>CATS[c]?.keywords?.split(" ")||[]).slice(0,5).join(" OR ");
      const articles=await fetchGNews(keywords);
      const mapped=articles.map((a:any,i:number)=>({id:"live_"+i,title:a.title,source:a.source?.name||"Source",date:a.publishedAt?.split("T")[0]||new Date().toISOString().split("T")[0],impact:i<2?"high":i<4?"medium":"low",categories:u.categories.slice(0,2),tag:"Achat",summary:a.description||"",url:a.url}));
      await stSet(NEWS_CACHE_KEY,{articles:mapped,timestamp:Date.now()});
      setLiveNews(mapped);setLastRefresh(new Date());
    }
    setLoadingNews(false);
    if(FX_KEY){const rates=await fetchFxRates();if(rates){const fxMap:Record<string,number>={eur_usd:rates.USD,eur_cny:rates.CNY,eur_gbp:rates.GBP,eur_jpy:rates.JPY};setLiveValues(prev=>({...prev,...fxMap}));}}
  },[u.categories]);

  useEffect(()=>{refreshData();},[]);

  const allBaseIndices=[...ALL_INDICES,...customIndices];
  const myIdx=allBaseIndices.filter(i=>u.indices.includes(i.id));

  const staticNews=[
    {id:1,title:"Tensions en mer Rouge : surcouts logistiques persistants Q2 2026",source:"Reuters",date:"2026-05-28",impact:"high",categories:["Flotte camion","Engins de manutention","Automatisation entrepot"],tag:"Geopolitique",summary:"Les attaques Houthis en mer Rouge forcent les armateurs a contourner par le Cap de Bonne Esperance, allongeant les delais de 12-15 jours et augmentant les couts de fret de 35 a 60%.",url:"https://reuters.com"},
    {id:2,title:"Directive CSRD : nouvelles obligations reporting RSE",source:"Journal Officiel UE",date:"2026-05-27",impact:"medium",categories:["EPI / Workwear","Flotte automobile"],tag:"Reglementation",summary:"La directive CSRD impose de nouveaux standards de reporting extra-financier avec des obligations renforcees sur la chaine d'approvisionnement.",url:"https://eur-lex.europa.eu"},
    {id:3,title:"Prix de l'acier en hausse : relance industrie automobile chinoise",source:"Bloomberg",date:"2026-05-26",impact:"high",categories:["Engins de manutention","Automatisation entrepot","Bornes de recharge"],tag:"Marche",summary:"La reprise de la production automobile en Chine tire la demande en acier vers le haut avec une hausse de 4% sur le mois.",url:"https://bloomberg.com"},
    {id:4,title:"EPEX Spot : pic de demande estival anticipe +12%",source:"RTE",date:"2026-05-25",impact:"medium",categories:["Energie","Bornes de recharge"],tag:"Energie",summary:"RTE prevoit une hausse de la consommation electrique de 12% en juin. Les prix spot pourraient atteindre 90 EUR/MWh en periode de pointe.",url:"https://rte-france.com"},
    {id:5,title:"Tarifs douaniers US sur vehicules electriques chinois a 100%",source:"WSJ",date:"2026-05-22",impact:"high",categories:["Bornes de recharge","Flotte automobile","Automatisation entrepot"],tag:"Geopolitique",summary:"Washington double les droits de douane sur vehicules et equipements electriques chinois. Impact direct sur les bornes de recharge.",url:"https://wsj.com"},
  ];

  const allNews=[...liveNews,...(liveNews.length<3?staticNews:[])];
  const myNews=allNews.filter(n=>n.categories.some((c:string)=>u.categories.includes(c)));
  const globalNewsFiltered=showGlobal?GLOBAL_NEWS:[];
  const combinedNews=[...myNews,...globalNewsFiltered.filter(n=>!myNews.find(m=>m.id===n.id))];
  const alerts=combinedNews.filter(n=>n.impact==="high");

  const staticTR=[
    {id:1,type:"tech",title:"Chariots elevateurs autonomes : nouvelle generation LIDAR 3D",source:"Intralogistics Europe",date:"2026-05-28",impact:"high",categories:["Engins de manutention","Automatisation entrepot"],summary:"Les nouveaux systemes LIDAR permettent une precision de 2mm, ouvrant la voie a des entrepots sans operateur.",url:"https://intralogisticseurope.com"},
    {id:2,type:"reg",title:"Reglement EU 2025/847 : emissions CO2 PL neufs -45% des 2030",source:"JOUE",date:"2026-05-27",impact:"high",categories:["Flotte camion"],summary:"Les constructeurs doivent atteindre -45% emissions CO2 sur PL neufs d'ici 2030 vs base 2019.",url:"https://eur-lex.europa.eu"},
    {id:3,type:"tech",title:"Bornes V2G : deploiement commercial accelere",source:"Green Tech Media",date:"2026-05-26",impact:"medium",categories:["Bornes de recharge","Flotte automobile"],summary:"Le V2G permet aux flottes de revendre l'electricite au reseau aux heures de pointe.",url:"https://greentechmedia.com"},
    {id:4,type:"reg",title:"Norme EN ISO 20471:2025 : mise a jour EPI haute visibilite",source:"AFNOR",date:"2026-05-25",impact:"medium",categories:["EPI / Workwear"],summary:"Revision des criteres de retroreflexion. Mise en conformite requise avant janvier 2026.",url:"https://afnor.org"},
    {id:5,type:"tech",title:"IA predictive maintenance : ROI demontre flottes > 50 vehicules",source:"Fleet Europe",date:"2026-05-24",impact:"medium",categories:["Flotte camion","Flotte automobile"],summary:"23% de reduction des pannes et 18% d'economie sur les pieces via maintenance predictive IA.",url:"https://fleeteurope.com"},
    {id:6,type:"reg",title:"CSRD : referentiels sectoriels transport et logistique publies",source:"EFRAG",date:"2026-05-22",impact:"high",categories:["Flotte camion","Automatisation entrepot"],summary:"Les referentiels precisent les indicateurs obligatoires. Applicable exercice 2026.",url:"https://efrag.org"},
    {id:7,type:"tech",title:"Logistique 4.0 : integration IA dans les TMS et WMS nouvelle generation",source:"Supply Chain Magazine",date:"2026-05-20",impact:"medium",categories:["Automatisation entrepot","Flotte camion"],summary:"Les nouveaux TMS integrent des modules IA pour l'optimisation des tournees et la prediction de la demande en temps reel.",url:"https://supplychainmagazine.fr"},
    {id:8,type:"reg",title:"Reglementation IRVE : nouvelles obligations d'equipement pour parkings entreprises",source:"Ministere de la Transition",date:"2026-05-18",impact:"high",categories:["Bornes de recharge","Flotte automobile"],summary:"Obligation d'equiper 20% des places de parking des entreprises de plus de 20 salaries en bornes de recharge d'ici 2025.",url:"https://ecologie.gouv.fr"},
  ];
  const myTR=staticTR.filter(n=>n.categories.some((c:string)=>u.categories.includes(c)));
  const myRisks=risks.filter(r=>r.categories.some((c:string)=>u.categories.includes(c)));

  const updateU=async(nu:Record<string,any>)=>{setU(nu);const users=await stGet(USERS_KEY)||{};users[nu.email]=nu;await stSet(USERS_KEY,users);onUpdate(nu);};
  const updateRiskLevel=async(id:number,level:string)=>{const updated=risks.map(r=>r.id===id?{...r,level}:r);setRisks(updated);await stSet(RISKS_KEY,updated,false);};

  const addCustomIndex=async(idx:Record<string,any>)=>{
    const newList=[...customIndices,idx];
    setCustomIndices(newList);
    await stSet(CUSTOM_IDX_KEY,newList);
    updateU({...u,indices:[...u.indices,idx.id]});
    setIdxSearch(false);
  };

  const filteredNews=combinedNews.filter(n=>{const imp=newsFilter==="all"||n.impact===newsFilter;const dt=!newsDateFrom||n.date>=newsDateFrom;return imp&&dt;});
  const filteredTR=myTR.filter(n=>{const tp=techFilter==="all"||n.type===techFilter;const dt=!techDateFrom||n.date>=techDateFrom;return tp&&dt;});
  const getIdxValue=(idx:Record<string,any>)=>liveValues[idx.id]||idx.values[idx.values.length-1];

  const TABS=[
    {id:"dashboard",label:"Dashboard",icon:"◈"},
    {id:"indices",label:"Indices et Marches",icon:"◉"},
    {id:"news",label:"News marches",icon:"◎",badge:alerts.length},
    {id:"techReg",label:"Veille tech et regl.",icon:"\u2B21"},
    {id:"risks",label:"Crise et Risque",icon:"!",badge:myRisks.filter(r=>r.level==="critical").length},
    {id:"suppliers",label:"Fournisseurs",icon:"\uD83C\uDFE2"},
    {id:"calendar",label:"Calendrier equipe",icon:"\uD83D\uDCC5"},
    {id:"settings",label:"Abonnements",icon:"+"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#070D1A",fontFamily:"system-ui,sans-serif",color:"#E2E8F0",display:"flex"}}>
      <style>{"*{box-sizing:border-box;}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}input::placeholder{color:#334155}select option{background:#0F172A;color:#E2E8F0}"}</style>
      <div style={{width:220,background:"#0A111E",borderRight:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",padding:"20px 0",position:"fixed",top:0,bottom:0,left:0,zIndex:50,overflowY:"auto"}}>
        <div style={{padding:"0 18px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:13,fontWeight:700,color:"#818CF8",letterSpacing:2,textTransform:"uppercase"}}>INTEL</div><div style={{fontSize:10,color:"#1E3A5F",marginTop:2}}>Veille Marches Achats</div></div>
        <div style={{padding:"12px 8px",flex:1}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:7,border:"none",cursor:"pointer",marginBottom:2,background:tab===t.id?"rgba(129,140,248,0.12)":"transparent",color:tab===t.id?"#818CF8":"#64748B",fontSize:12,fontWeight:tab===t.id?600:400,transition:"all .15s",textAlign:"left"}}>
              <span style={{fontSize:13,width:18,textAlign:"center",flexShrink:0}}>{t.icon}</span>
              <span style={{flex:1,lineHeight:1.3}}>{t.label}</span>
              {(t.badge??0)>0&&<span style={{fontSize:9,background:"#F87171",color:"white",borderRadius:8,padding:"1px 5px",fontWeight:700}}>{t.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"14px 18px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:12,fontWeight:600,color:"#475569"}}>{u.name}</div>
          <div style={{fontSize:10,color:"#1E3A5F",marginBottom:8}}>{u.categories.length} cat. - {u.indices.length} indices</div>
          <button onClick={refreshData} style={{fontSize:10,color:"#818CF8",background:"none",border:"none",cursor:"pointer",padding:0,display:"block",marginBottom:4}}>Actualiser</button>
          {lastRefresh&&<div style={{fontSize:9,color:"#334155",marginBottom:6}}>{lastRefresh.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>}
          <button onClick={onLogout} style={{fontSize:11,color:"#334155",background:"none",border:"none",cursor:"pointer",padding:0}}>Deconnexion</button>
        </div>
      </div>

      <div style={{marginLeft:220,flex:1,padding:"28px",minHeight:"100vh"}}>

        {tab==="dashboard"&&(<div>
          <div style={{marginBottom:28}}>
            <div style={{fontSize:22,fontWeight:700,color:"#F8FAFC"}}>Bonjour, {u.name.split(" ")[0]}</div>
            <div style={{fontSize:12,color:"#334155",marginTop:2}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
            {loadingNews&&<div style={{fontSize:11,color:"#818CF8",marginTop:6}}>Actualisation en cours...</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
            {[{l:"Indices suivis",v:myIdx.length,c:"#818CF8"},{l:"Alertes actives",v:alerts.length,c:"#F87171"},{l:"Risques identifies",v:myRisks.length,c:"#FB923C"},{l:"Signaux tech/regl.",v:myTR.length,c:"#34D399"}].map(k=>(
              <div key={k.l} style={{...S.card,padding:"16px 18px"}}><div style={{fontSize:26,fontWeight:700,color:"#F8FAFC",marginBottom:4}}>{k.v}</div><div style={{fontSize:11,color:k.c}}>{k.l}</div></div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
            <div style={{...S.card,border:"1px solid rgba(248,113,113,0.15)"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between"}}><div style={{fontSize:12,fontWeight:600,color:"#F87171"}}>Alertes impact eleve</div><div style={{fontSize:11,color:"#475569"}}>{alerts.length}</div></div>
              {alerts.length===0?<div style={{padding:24,color:"#475569",fontSize:12,textAlign:"center"}}>Aucune alerte</div>:alerts.slice(0,4).map(n=>(
                <div key={n.id} style={{padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}><div style={{fontSize:12,color:"#CBD5E1",lineHeight:1.4}}>{n.title}</div><div style={{fontSize:11,color:"#475569",marginTop:3}}>{n.source} - {n.date}</div></div>
              ))}
            </div>
            <div style={S.card}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between"}}>
                <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0"}}>Indices en mouvement</div>
                {Object.keys(liveValues).length>0&&<div style={{fontSize:10,color:"#34D399"}}>Live</div>}
              </div>
              {myIdx.slice(0,6).map(idx=>{
                const color=Object.values(CATS).find(c=>c.indices.includes(idx.id))?.color||"#818CF8";
                const val=getIdxValue(idx);const isLive=!!liveValues[idx.id];
                return(<div key={idx.id} style={{padding:"9px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}><div style={{fontSize:12,color:"#CBD5E1",fontWeight:500}}>{idx.label}{isLive&&<span style={{fontSize:9,color:"#34D399",marginLeft:5}}>LIVE</span>}</div><div style={{fontSize:10,color:"#475569"}}>{val.toLocaleString("fr-FR")} {idx.unit}</div></div>
                  <Spark values={idx.values} color={color} w={56} h={22}/>
                  <div style={{fontSize:11,fontWeight:600,color:idx.trend>=0?"#F87171":"#34D399",minWidth:44,textAlign:"right"}}>{idx.trend>=0?"^":"v"} {Math.abs(idx.trend)}%</div>
                </div>);
              })}
            </div>
          </div>
          <div style={{...S.card,padding:"16px 18px"}}><div style={{fontSize:12,fontWeight:600,color:"#E2E8F0",marginBottom:14}}>Mes categories</div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{u.categories.map((cat:string)=>{const meta=CATS[cat];const nb=myNews.filter(n=>n.categories.includes(cat)).length;const hasAlert=myNews.some(n=>n.categories.includes(cat)&&n.impact==="high");return<div key={cat} style={{padding:"10px 14px",borderRadius:10,background:meta.color+"10",border:"1px solid "+meta.color+"25",position:"relative",minWidth:110}}>{hasAlert&&<div style={{position:"absolute",top:6,right:6,width:6,height:6,borderRadius:"50%",background:"#F87171"}}/>}<div style={{fontSize:20}}>{meta.icon}</div><div style={{fontSize:11,color:meta.color,fontWeight:600,marginTop:4}}>{cat}</div><div style={{fontSize:10,color:"#475569"}}>{nb} news</div></div>;})}
          </div></div>
        </div>)}

        {tab==="indices"&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>Indices et Marches</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>{myIdx.length} indices — cliquez pour detail et periode</div></div>
            <button onClick={()=>setIdxSearch(true)} style={S.bsm}>+ Rechercher / Ajouter</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {myIdx.map(idx=>{
              const color=Object.values(CATS).find(c=>c.indices.includes(idx.id))?.color||"#818CF8";
              const val=getIdxValue(idx);const isLive=!!liveValues[idx.id];
              return(<div key={idx.id} style={{...S.card,padding:16,cursor:"pointer"}} onClick={()=>setDetailIdx(idx)}>
                <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{idx.category} - {idx.source}{isLive&&<span style={{color:"#34D399",marginLeft:6}}>LIVE</span>}</div>
                <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0",marginBottom:10}}>{idx.label}</div>
                <Spark values={idx.values} color={color} w={180} h={42}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:8}}>
                  <div><div style={{fontSize:19,fontWeight:700,color:"#F8FAFC"}}>{val.toLocaleString("fr-FR")}</div><div style={{fontSize:11,color:"#475569"}}>{idx.unit}</div></div>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <div style={{fontSize:12,fontWeight:600,color:idx.trend>=0?"#F87171":"#34D399",background:idx.trend>=0?"rgba(248,113,113,0.1)":"rgba(52,211,153,0.1)",padding:"2px 8px",borderRadius:20}}>{idx.trend>=0?"^":"v"} {Math.abs(idx.trend)}%</div>
                    <button onClick={e=>{e.stopPropagation();setForecastIdx(idx);}} style={{...S.bsm,fontSize:10,padding:"3px 9px"}}>Prevoir</button>
                  </div>
                </div>
              </div>);
            })}
          </div>
          {idxSearch&&<IndexSearchModal userIndices={u.indices} onAdd={id=>{updateU({...u,indices:[...u.indices,id]});setIdxSearch(false);}} onClose={()=>setIdxSearch(false)} customIndices={customIndices} onAddCustom={addCustomIndex}/>}
          {forecastIdx&&<ForecastModal idx={forecastIdx} onClose={()=>setForecastIdx(null)}/>}
          {detailIdx&&<IndexDetailModal idx={detailIdx} liveValue={liveValues[detailIdx.id]} onClose={()=>setDetailIdx(null)}/>}
        </div>)}

        {tab==="news"&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>News marches</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>{filteredNews.length} articles{liveNews.length>0&&<span style={{color:"#34D399",marginLeft:8,fontSize:11}}>{liveNews.length} en temps reel</span>}</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}><div style={{fontSize:10,color:"#475569"}}>Depuis le</div><input type="date" value={newsDateFrom} onChange={e=>setNewsDateFrom(e.target.value)} style={{...S.input,width:150,padding:"6px 10px",fontSize:12}}/></div>
              <div style={{display:"flex",gap:6}}>{["all","high","medium","low"].map(f=><button key={f} onClick={()=>setNewsFilter(f)} style={{...S.bsm,background:newsFilter===f?"rgba(129,140,248,0.2)":"transparent",color:newsFilter===f?"#818CF8":"#64748B",fontSize:11}}>{f==="all"?"Tous":f==="high"?"Eleve":f==="medium"?"Moyen":"Faible"}</button>)}</div>
              <button onClick={()=>setShowGlobal(p=>!p)} style={{...S.bsm,fontSize:11,color:showGlobal?"#34D399":"#64748B",borderColor:showGlobal?"rgba(52,211,153,0.3)":"rgba(129,140,248,0.25)"}}>{showGlobal?"Geodis/Global ON":"Geodis/Global OFF"}</button>
              <ResumeButton items={filteredNews} label="Resume IA"/>
              <button onClick={refreshData} style={{...S.bsm,fontSize:11}}>Actualiser</button>
            </div>
          </div>
          <div style={S.card}>
            {loadingNews&&<div style={{padding:24,textAlign:"center",color:"#475569",fontSize:13}}>Chargement...</div>}
            {filteredNews.map(n=>(
              <div key={n.id} style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontWeight:700,background:TAGBG[n.tag]||"#475569",color:"white",padding:"2px 8px",borderRadius:20,textTransform:"uppercase",letterSpacing:.5}}>{n.tag}</span>
                  <span style={{width:6,height:6,borderRadius:"50%",background:IC[n.impact],flexShrink:0}}/>
                  <span style={{fontSize:11,color:"#64748B"}}>{n.source} - {new Date(n.date).toLocaleDateString("fr-FR")}</span>
                  {n.categories.includes("global")&&<span style={{fontSize:9,color:"#34D399",background:"rgba(52,211,153,0.1)",padding:"1px 6px",borderRadius:8}}>Geodis/Global</span>}
                </div>
                <div style={{fontSize:13,color:"#CBD5E1",fontWeight:600,lineHeight:1.4,marginBottom:6}}>{n.title}</div>
                {n.summary&&<div style={{fontSize:12,color:"#94A3B8",lineHeight:1.6,marginBottom:10}}>{n.summary}</div>}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                  {n.categories.filter((c:string)=>c!=="global").map((c:string)=><span key={c} style={{fontSize:10,color:CATS[c]?.color||"#64748B",background:(CATS[c]?.color||"#64748B")+"15",padding:"1px 6px",borderRadius:8}}>{CATS[c]?.icon} {c}</span>)}
                  {n.url&&<a href={n.url} target="_blank" rel="noreferrer" style={{marginLeft:"auto",fontSize:10,color:"#818CF8",textDecoration:"none",border:"1px solid rgba(129,140,248,0.25)",borderRadius:6,padding:"2px 10px",background:"rgba(129,140,248,0.08)"}}>Lire</a>}
                  <button onClick={()=>setAiModal({title:n.title,prompt:"Tu es expert achats. News : "+n.title+". Resume : "+(n.summary||"")+". Analyse en 4 phrases : consequences operationnelles pour un acheteur, ce qu'il doit surveiller, recommandation d'action."})} style={{...S.bsm,fontSize:10,padding:"2px 10px"}}>Analyser</button>
                </div>
              </div>
            ))}
          </div>
        </div>)}

        {tab==="techReg"&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>Veille technologique et reglementaire</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>{filteredTR.length} signaux</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}><div style={{fontSize:10,color:"#475569"}}>Depuis le</div><input type="date" value={techDateFrom} onChange={e=>setTechDateFrom(e.target.value)} style={{...S.input,width:150,padding:"6px 10px",fontSize:12}}/></div>
              <div style={{display:"flex",gap:6}}>{["all","tech","reg"].map(f=><button key={f} onClick={()=>setTechFilter(f)} style={{...S.bsm,background:techFilter===f?"rgba(129,140,248,0.2)":"transparent",color:techFilter===f?"#818CF8":"#64748B",fontSize:11}}>{f==="all"?"Tous":f==="tech"?"Technologie":"Reglementation"}</button>)}</div>
              <ResumeButton items={filteredTR} label="Resume IA"/>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filteredTR.map(n=>(
              <div key={n.id} style={{...S.card,padding:18}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:36,height:36,borderRadius:8,background:n.type==="tech"?"rgba(6,182,212,0.15)":"rgba(129,140,248,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{n.type==="tech"?"⚙️":"📋"}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,fontWeight:700,color:n.type==="tech"?"#06B6D4":"#818CF8",background:n.type==="tech"?"rgba(6,182,212,0.12)":"rgba(129,140,248,0.12)",padding:"2px 8px",borderRadius:10,textTransform:"uppercase",letterSpacing:.5}}>{n.type==="tech"?"Technologie":"Reglementation"}</span>
                      <span style={{width:5,height:5,borderRadius:"50%",background:IC[n.impact],flexShrink:0}}/>
                      <span style={{fontSize:11,color:"#64748B"}}>{n.source} - {new Date(n.date).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div style={{fontSize:14,fontWeight:600,color:"#E2E8F0",marginBottom:6,lineHeight:1.4}}>{n.title}</div>
                    <div style={{fontSize:12,color:"#94A3B8",lineHeight:1.6,marginBottom:10}}>{n.summary}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      {n.categories.map((c:string)=><span key={c} style={{fontSize:10,color:CATS[c]?.color||"#64748B",background:(CATS[c]?.color||"#64748B")+"15",padding:"1px 6px",borderRadius:8}}>{CATS[c]?.icon} {c}</span>)}
                      <a href={n.url} target="_blank" rel="noreferrer" style={{marginLeft:"auto",fontSize:10,color:"#818CF8",textDecoration:"none",border:"1px solid rgba(129,140,248,0.25)",borderRadius:6,padding:"2px 10px",background:"rgba(129,140,248,0.08)"}}>Lire</a>
                      <button onClick={()=>setAiModal({title:n.title,prompt:"Expert achats. Signal "+n.type+" : "+n.title+". Resume : "+n.summary+". Analyse en 5 phrases : impact achats, delai d'action, points vigilance, recommandation."})} style={{...S.bsm,fontSize:10,padding:"2px 10px"}}>Analyser</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>)}

        {tab==="risks"&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div><div style={{fontSize:20,fontWeight:700,color:"#F8FAFC"}}>Crise et Risque</div><div style={{fontSize:13,color:"#475569",marginTop:2}}>Criticite modifiable - mise a jour IA disponible</div></div>
            <RisksUpdateButton categories={u.categories} onUpdate={(r)=>setRisks(r)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
            {["critical","high","medium","low"].map(l=>(
              <div key={l} style={{...S.card,padding:"12px 16px",borderLeft:"3px solid "+RC[l]}}><div style={{fontSize:22,fontWeight:700,color:"#F8FAFC"}}>{myRisks.filter(r=>r.level===l).length}</div><div style={{fontSize:11,color:RC[l],fontWeight:600,marginTop:2}}>{RL[l]}</div></div>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {risks.filter(r=>r.categories.some((c:string)=>u.categories.includes(c))).map(r=>(
              <div key={r.id} style={{...S.card,padding:18,borderLeft:"3px solid "+RC[r.level]}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#F8FAFC",marginBottom:5}}>{r.zone}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <select value={r.level} onChange={e=>updateRiskLevel(r.id,e.target.value)} style={{fontSize:10,fontWeight:700,color:RC[r.level],background:RC[r.level]+"20",padding:"3px 10px",borderRadius:10,border:"1px solid "+RC[r.level]+"40",cursor:"pointer",outline:"none"}}>
                        <option value="critical">Critique</option><option value="high">Eleve</option><option value="medium">Modere</option><option value="low">Faible</option>
                      </select>
                      <span style={{fontSize:11,color:"#64748B"}}>{r.type}</span>
                      <span style={{fontSize:11,color:"#475569"}}>Depuis {r.since}</span>
                      <span style={{fontSize:10,color:r.evol==="degradation"?"#F87171":r.evol==="amelioration"?"#34D399":"#FBBF24"}}>{r.evol==="degradation"?"Degradation":r.evol==="amelioration"?"Amelioration":"Stable"}</span>
                    </div>
                  </div>
                  <button onClick={()=>setAiModal({title:"Risque : "+r.zone,prompt:"Tu es expert risk management et achats. Zone : "+r.zone+" (type: "+r.type+", niveau: "+r.level+"). Description : "+r.desc+". Categories : "+r.categories.filter((c:string)=>u.categories.includes(c)).join(", ")+". Analyse en 5 phrases : nature du risque, impacts concrets achats, strategies de mitigation, indicateurs de suivi."})} style={S.bsm}>Analyser</button>
                </div>
                <div style={{fontSize:13,color:"#94A3B8",lineHeight:1.6,marginBottom:10}}>{r.desc}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{r.categories.map((c:string)=><span key={c} style={{fontSize:10,color:CATS[c]?.color||"#64748B",background:(CATS[c]?.color||"#64748B")+"15",padding:"1px 6px",borderRadius:8}}>{CATS[c]?.icon} {c}</span>)}</div>
              </div>
            ))}
          </div>
        </div>)}

        {tab==="suppliers"&&<SuppliersTab userCats={u.categories}/>}
        {tab==="calendar"&&<CalendarTab user={u}/>}

        {tab==="settings"&&(<div>
          <div style={{fontSize:20,fontWeight:700,color:"#F8FAFC",marginBottom:8}}>Mes abonnements</div>
          <div style={{fontSize:13,color:"#475569",marginBottom:24}}>Variables Vercel : VITE_GEMINI_KEY / VITE_GNEWS_KEY / VITE_FX_KEY / VITE_AV_KEY</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
            <div>
              <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Categories ({u.categories.length})</div>
              {Object.entries(CATS).map(([cat,meta])=>{const sel=u.categories.includes(cat);return(
                <div key={cat} onClick={()=>{const next=sel?u.categories.filter((c:string)=>c!==cat):[...u.categories,cat];updateU({...u,categories:next});}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer",marginBottom:6,border:"1px solid "+(sel?meta.color+"35":"rgba(255,255,255,0.06)"),background:sel?meta.color+"08":"transparent",transition:"all .15s"}}>
                  <span style={{fontSize:16}}>{meta.icon}</span><span style={{flex:1,fontSize:12,color:sel?meta.color:"#64748B",fontWeight:sel?600:400}}>{cat}</span>{sel&&<span style={{color:meta.color,fontSize:13}}>v</span>}
                </div>
              );})}
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:11,color:"#475569",textTransform:"uppercase",letterSpacing:1.5}}>Indices ({u.indices.length})</div>
                <button onClick={()=>setIdxSearch(true)} style={{...S.bsm,fontSize:10,padding:"3px 10px"}}>+ Ajouter</button>
              </div>
              {allBaseIndices.filter(idx=>u.indices.includes(idx.id)).map(idx=>{return(
                <div key={idx.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:7,marginBottom:4,background:"rgba(129,140,248,0.06)",border:"1px solid rgba(129,140,248,0.2)"}}>
                  <span style={{flex:1,fontSize:11,color:"#CBD5E1"}}>{idx.label}</span>
                  <span style={{fontSize:10,color:"#334155"}}>{idx.unit}</span>
                  <button onClick={()=>{const next=u.indices.filter((x:string)=>x!==idx.id);updateU({...u,indices:next});}} style={{background:"none",border:"none",color:"#F87171",cursor:"pointer",fontSize:14,padding:0}}>x</button>
                </div>
              );})}
              {idxSearch&&<IndexSearchModal userIndices={u.indices} onAdd={id=>{updateU({...u,indices:[...u.indices,id]});setIdxSearch(false);}} onClose={()=>setIdxSearch(false)} customIndices={customIndices} onAddCustom={addCustomIndex}/>}
            </div>
          </div>
        </div>)}
      </div>
      {aiModal&&<AIModal title={aiModal.title} prompt={aiModal.prompt} onClose={()=>setAiModal(null)}/>}
    </div>
  );
}

export default function App(){
  const [screen,setScreen]=useState("loading");const [user,setUser]=useState<Record<string,any>|null>(null);
  useEffect(()=>{(async()=>{const users=await stGet(USERS_KEY)||{};let last:string|null=null;try{last=localStorage.getItem("intel_v8");}catch{}if(last&&users[last]){setUser(users[last]);setScreen("app");}else setScreen("onboarding");})();},[]);
  const handleComplete=async(p:Record<string,any>)=>{const users=await stGet(USERS_KEY)||{};users[p.email]=p;await stSet(USERS_KEY,users);try{localStorage.setItem("intel_v8",p.email);}catch{}setUser(p);setScreen("app");};
  const handleLogout=()=>{try{localStorage.removeItem("intel_v8");}catch{}setUser(null);setScreen("onboarding");};
  if(screen==="loading")return<div style={{minHeight:"100vh",background:"#070D1A",display:"flex",alignItems:"center",justifyContent:"center",color:"#334155",fontSize:12}}>Chargement...</div>;
  if(screen==="onboarding")return<Onboarding onComplete={handleComplete}/>;
  return<Dashboard user={user!} onLogout={handleLogout} onUpdate={setUser}/>;
}
