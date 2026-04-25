import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "minha-obra-bd",
  appId: "1:364025766803:web:95c30f7dfa083b5ed6be66",
  storageBucket: "minha-obra-bd.firebasestorage.app",
  apiKey: "AIzaSyBrEpv-yMfy14pcnNURK9hIyGQw-Chi4Wg",
  authDomain: "minha-obra-bd.firebaseapp.com",
  messagingSenderId: "364025766803"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = () => Date.now() + Math.floor(Math.random()*1000);

const INIT_ETAPAS = [
  {id:1,nome:"Fundação",emoji:"🏗️",orc:42000,gastos:[{id:uid(),desc:"Serviços de fundação completos",valor:42000,valorG:21000,valorL:21000,pagador:"A",data:"2025-05-30",recebedor:"Construtora Base",tags:"mão-de-obra",obs:"",comp:"recibo.pdf"}],pct:100,st:"ok",dataIniEst:"2025-04",durEst:2,dataIniReal:"2025-04",durReal:2,dep:null},
  {id:2,nome:"Estrutura",emoji:"🏛️",orc:60000,gastos:[{id:uid(),desc:"Concreto e aço estrutural",valor:38000,valorG:38000,valorL:0,pagador:"G",data:"2025-06-15",recebedor:"Aço Forte LTDA",tags:"material",obs:"",comp:"nf.pdf"},{id:uid(),desc:"Mão de obra",valor:25500,valorG:0,valorL:25500,pagador:"L",data:"2025-07-20",recebedor:"Empreiteiro Roberto",tags:"mão-de-obra",obs:"",comp:""}],pct:100,st:"ok",dataIniEst:"2025-05",durEst:3,dataIniReal:"2025-05",durReal:3,dep:1},
  {id:3,nome:"Alvenaria",emoji:"🧱",orc:38000,gastos:[{id:uid(),desc:"Tijolos e argamassa",valor:22000,valorG:11000,valorL:11000,pagador:"A",data:"2025-07-10",recebedor:"Depósito Central",tags:"material",obs:"",comp:"comp.jpg"}],pct:100,st:"ok",dataIniEst:"2025-07",durEst:2,dataIniReal:"2025-07",durReal:2,dep:2},
  {id:8,nome:"Revestimentos",emoji:"🪟",orc:72000,gastos:[{id:uid(),desc:"Porcelanato",valor:32000,valorG:32000,valorL:0,pagador:"G",data:"2026-02-10",recebedor:"Leroy",tags:"premium",obs:"",comp:""}],pct:75,st:"run",dataIniEst:"2026-01",durEst:4,dataIniReal:"2026-01",durReal:5,dep:null},
];
const INIT_OUTROS = [
  {id:uid(),desc:"ITBI e Registro do Lote",valor:4500,valorG:2250,valorL:2250,pagador:"A",data:"2025-01-15",recebedor:"Cartório",tags:"taxas,terreno",obs:"",comp:"recibo_cartorio.pdf"}
];
const INIT_CHECK = [{id:1,t:"Comprar e instalar porcelanato",dep:"Contrapiso concluído",depOk:true,etapa:"Revestimentos",urg:"alta",done:false}];
const INIT_CONTR = [{id:1,nome:"Contrato de Empreitada Geral",tam:"3.2 MB",comp:"1.1 MB",data:"15/03/2025",ok:true}];
const INIT_PROJ = [{id:10,nome:"Projeto Arquitetônico Completo",tam:"18.4 MB",comp:"6.2 MB",data:"15/01/2025"}];
const INIT_COT = [
  {id:1, titulo:"Pisos e Revestimentos", itens:[{id:1, nome:"Porcelanato 60x60 Bege Polido", qtd:"120 m²"}], cat:"Revestimentos", st:"aberta", forn:[
    {id:uid(),nome:"Cerâmica Brasil",precoVista:8990.00, precoPrazo: 9500.00, val:"30/04/2026",obs:"Frete grátis",best:true},
    {id:uid(),nome:"Leroy Merlin",precoVista:10490.00, precoPrazo: 10490.00, val:"30/04/2026",obs:"10x s/ juros",best:false},
  ]}
];
const INIT_CONT = [{id:1,nome:"Roberto Melo",papel:"Empreiteiro Geral",tel:"(11) 99823-4521",email:"roberto@meloconstrucoes.com.br",ini:"RM",cor:"#B8622A",prestou:true,nota:4,obs:"Bom de serviço, mas atrasa."}];
const INIT_IDEIAS = [{id:1,t:"Bancada mármore Carrara",desc:"Mármore branco com veios cinzas.",cat:"Cozinha",cor:"var(--pLight)",tags:["💎 Premium", "✅ Decidido"],links:["https://br.pinterest.com/"],data:"12/02"}];
const INIT_ANOTACOES = [{id:1, t:"Medidas e Padrões (Elétrica)", desc:"- Tomadas da cozinha: 20A\n- Restante: 10A", data:"10/05/2025"}];
const INIT_TAREFAS = [{id:1, t:"Aprovar projeto na prefeitura", executor:"Arquiteta Fernanda", prazo:"2026-04-24", done:false}];

const INIT_IDEIA_CATS = [
  {id:1, nome:"Cozinha", ativa:true}, {id:2, nome:"Sala", ativa:true},
  {id:3, nome:"Banheiro", ativa:true}, {id:4, nome:"Quarto", ativa:true},
  {id:5, nome:"Área Externa", ativa:true}, {id:6, nome:"Elétrica", ativa:true},
  {id:7, nome:"Outros", ativa:true}
];
const INIT_IDEIA_TAGS = ["💎 Premium", "✅ Decidido", "📋 Cotar", "❌ Descartado", "🔥 Urgente"];

async function seed() {
  console.log("Seeding database...");
  
  for (const item of INIT_ETAPAS) await setDoc(doc(db, "etapas", item.id.toString()), item);
  for (const item of INIT_OUTROS) await setDoc(doc(db, "outrosGastos", item.id.toString()), item);
  for (const item of INIT_CHECK) await setDoc(doc(db, "checklist", item.id.toString()), item);
  for (const item of INIT_CONTR) await setDoc(doc(db, "contratos", item.id.toString()), item);
  for (const item of INIT_PROJ) await setDoc(doc(db, "projetos", item.id.toString()), item);
  for (const item of INIT_COT) await setDoc(doc(db, "cotacoes", item.id.toString()), item);
  for (const item of INIT_CONT) await setDoc(doc(db, "contatos", item.id.toString()), item);
  for (const item of INIT_IDEIAS) await setDoc(doc(db, "ideias", item.id.toString()), item);
  for (const item of INIT_ANOTACOES) await setDoc(doc(db, "anotacoes", item.id.toString()), item);
  for (const item of INIT_TAREFAS) await setDoc(doc(db, "tarefas", item.id.toString()), item);
  for (const item of INIT_IDEIA_CATS) await setDoc(doc(db, "ideiaCats", item.id.toString()), item);
  
  // Tags array is stored as a single document
  await setDoc(doc(db, "meta", "ideiaTags"), { tags: INIT_IDEIA_TAGS });

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
