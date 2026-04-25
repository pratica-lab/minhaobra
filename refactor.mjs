import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

const crudStart = '  /* ═══════════════════════════════════\n     CRUD OPERATIONS\n  ═══════════════════════════════════ */';
const crudEnd = '  /* ═══════════════════════════════════\n     MODAL RENDERER\n  ═══════════════════════════════════ */';

const startIndex = content.indexOf(crudStart);
const endIndex = content.indexOf(crudEnd);

const newCrud = `  /* ═══════════════════════════════════
     CRUD OPERATIONS
  ═══════════════════════════════════ */

  const saveEtapa = async () => {
    if(!d.nome?.trim()) return alert("Nome é obrigatório");
    const item = {
      ...d, orc:parseFloat(d.orc)||0, pct:Math.min(100,parseInt(d.pct)||0), 
      dataIniEst: d.dataIniEst || todayYM(), durEst: Math.max(1, parseInt(d.durEst) || 1),
      dataIniReal: d.dataIniReal || "", durReal: parseInt(d.durReal) || 0,
      dep: d.dep?parseInt(d.dep):null
    };
    if(!modal.editing) { item.id = uid(); item.gastos = []; }
    await setDoc(doc(db, "etapas", item.id.toString()), item);
    logChange(modal.editing ? \`Editou a etapa "\${item.nome}"\` : \`Criou a etapa "\${item.nome}"\`); closeModal();
  };
  const deleteEtapa = async () => { await deleteDoc(doc(db, "etapas", d.id.toString())); logChange(\`Excluiu a etapa "\${d.nome}"\`); closeModal(); };

  const saveGasto = async () => {
    if(!d.desc?.trim()||!d.valor) return alert("Descrição e valor são obrigatórios");
    const etId = parseInt(d.etapaId);
    let v = parseFloat(d.valor)||0, pagador = d.pagador || 'G', vG = 0, vL = 0;
    if(pagador === 'G') vG = v; else if(pagador === 'L') vL = v; else { vG = parseFloat(d.valorG)||(v/2); vL = parseFloat(d.valorL)||(v/2); v = vG + vL; }
    const g = { id:d.id||uid(), desc:d.desc, valor:v, valorG:vG, valorL:vL, pagador, data:d.data||today(), recebedor:d.recebedor||"", tags:d.tags||"", obs:d.obs||"", comp:d.comp||"" };
    
    if (etId === 999) {
      await setDoc(doc(db, "outrosGastos", g.id.toString()), g);
    } else {
      const e = etapas.find(x=>x.id===etId);
      if(e) {
         const novosGastos = modal.editing ? e.gastos.map(x=>x.id===g.id?g:x) : [...e.gastos, g];
         await setDoc(doc(db, "etapas", e.id.toString()), {...e, gastos: novosGastos});
      }
    }
    logChange(modal.editing ? \`Editou o gasto "\${g.desc}"\` : \`Lançou o gasto "\${g.desc}"\`); closeModal();
  };
  
  const deleteGasto = async () => { 
    if (parseInt(d.etapaId) === 999) {
      await deleteDoc(doc(db, "outrosGastos", d.id.toString()));
    } else {
      const e = etapas.find(x=>x.id===parseInt(d.etapaId));
      if(e) await setDoc(doc(db, "etapas", e.id.toString()), {...e, gastos: e.gastos.filter(g=>g.id!==d.id)});
    }
    logChange(\`Excluiu o gasto "\${d.desc}"\`); closeModal(); 
  };

  const saveCheck = async () => {
    if(!d.t?.trim()) return alert("Tarefa é obrigatória");
    const item = {...d, depOk:!!d.depOk};
    if(!modal.editing) { item.id = uid(); item.done = false; }
    await setDoc(doc(db, "checklist", item.id.toString()), item);
    logChange(modal.editing ? \`Editou a dependência "\${item.t}"\` : \`Adicionou a dependência "\${item.t}"\`); closeModal();
  };
  const deleteCheck = async () => { await deleteDoc(doc(db, "checklist", d.id.toString())); logChange(\`Excluiu a dependência "\${d.t}"\`); closeModal(); };
  const toggleCheck = async (id) => { 
     const item = checklist.find(c=>c.id===id);
     if(item) {
        await setDoc(doc(db, "checklist", id.toString()), {...item, done: !item.done});
        logChange(\`Marcou a dependência "\${item.t}" como \${!item.done ? 'concluída' : 'pendente'}\`); 
     }
  };

  const saveDoc = async () => {
    if(!d.nome?.trim()) return alert("Selecione e anexe um arquivo antes de salvar!");
    const item = {...d, id:d.id||uid(), data:d.data||todayFmt()};
    if(docTab==="contratos") { await setDoc(doc(db, "contratos", item.id.toString()), item); }
    else { await setDoc(doc(db, "projetos", item.id.toString()), item); }
    logChange(modal.editing ? \`Editou o documento "\${item.nome}"\` : \`Adicionou o documento "\${item.nome}"\`); closeModal();
  };
  const deleteDoc = async () => { 
    if(docTab==="contratos") await deleteDoc(doc(db, "contratos", d.id.toString()));
    else await deleteDoc(doc(db, "projetos", d.id.toString()));
    logChange(\`Excluiu o documento "\${d.nome}"\`); closeModal(); 
  };
  const toggleSigned = async (id) => { 
     const item = contratos.find(c=>c.id===id);
     if(item) {
        await setDoc(doc(db, "contratos", id.toString()), {...item, ok: !item.ok});
        logChange(\`Marcou o contrato "\${item.nome}" como \${!item.ok ? 'assinado' : 'não assinado'}\`); 
     }
  };

  const saveCotacao = async () => {
    if(!d.titulo?.trim()) return alert("Título é obrigatório");
    const item = {...d, itens: d.itens || []};
    if(!modal.editing) { item.id = uid(); item.st = d.st||"aberta"; item.forn = []; }
    const cotAtual = cotacoes.find(c=>c.id===item.id) || {};
    await setDoc(doc(db, "cotacoes", item.id.toString()), {...cotAtual, ...item});
    logChange(modal.editing ? \`Editou a cotação "\${item.titulo}"\` : \`Criou a cotação "\${item.titulo}"\`); closeModal();
  };
  const deleteCotacao = async () => { await deleteDoc(doc(db, "cotacoes", d.id.toString())); logChange(\`Excluiu a cotação "\${d.titulo}"\`); closeModal(); };
  const concluirCotacao = async (e, qId) => { 
     e.stopPropagation(); 
     const item = cotacoes.find(c=>c.id===qId);
     if(item) {
        await setDoc(doc(db, "cotacoes", qId.toString()), {...item, st:"concluida"});
        logChange(\`Concluiu a cotação "\${item.titulo}"\`); 
     }
  };

  const saveForn = async () => {
    if(!d.nome?.trim()||!d.precoVista) return alert("Nome e preço à vista são obrigatórios");
    const f = {...d,id:d.id||uid(), precoVista:parseFloat(d.precoVista)||0, precoPrazo:parseFloat(d.precoPrazo)||""};
    const c = cotacoes.find(x=>x.id===modal.parentId);
    if(c) {
       const novosForn = modal.editing ? c.forn.map(x=>x.id===f.id?f:x) : [...c.forn,{...f,best:c.forn.length===0}];
       await setDoc(doc(db, "cotacoes", c.id.toString()), {...c, forn: novosForn});
    }
    logChange(modal.editing ? \`Editou o fornecedor "\${f.nome}"\` : \`Adicionou o fornecedor "\${f.nome}"\`); closeModal();
  };
  const deleteForn = async () => { 
    const c = cotacoes.find(x=>x.id===modal.parentId);
    if(c) {
       await setDoc(doc(db, "cotacoes", c.id.toString()), {...c, forn: c.forn.filter(f=>f.id!==d.id)});
    }
    logChange(\`Excluiu o fornecedor "\${d.nome}"\`); closeModal(); 
  };
  const setBest = async (cotId,fnId) => { 
     const c = cotacoes.find(x=>x.id===cotId);
     if(c) {
       const f = c.forn.find(x=>x.id===fnId);
       await setDoc(doc(db, "cotacoes", c.id.toString()), {...c, forn: c.forn.map(x=>({...x,best:x.id===fnId}))});
       logChange(\`Marcou o fornecedor "\${f?.nome}" como melhor opção\`); 
     }
  };

  const saveContato = async () => {
    if(!d.nome?.trim()) return alert("Nome é obrigatório");
    const item = {...d, ini:initials(d.nome), cor:d.cor||COR_OPTS[0], prestou:!!d.prestou, nota:d.prestou?parseInt(d.nota)||0:0, obs:d.obs||""};
    if(!modal.editing) item.id = uid();
    await setDoc(doc(db, "contatos", item.id.toString()), item);
    logChange(modal.editing ? \`Editou o contato "\${item.nome}"\` : \`Adicionou o contato "\${item.nome}"\`); closeModal();
  };
  const deleteContato = async () => { await deleteDoc(doc(db, "contatos", d.id.toString())); logChange(\`Excluiu o contato "\${d.nome}"\`); closeModal(); };

  const saveIdeia = async () => {
    if(!d.t?.trim()) return alert("Título é obrigatório");
    const safeCats = ideiaCats || [];
    const catFinal = d.cat || (safeCats.find(c=>c.ativa)?.nome || "Outros");
    const item = {...d, cor:d.cor||IDEIA_COLS[0], data:d.data||todayFmt(), tags:d.tags||[], links:d.links||[], cat:catFinal};
    if(!modal.editing) item.id = uid();
    await setDoc(doc(db, "ideias", item.id.toString()), item);
    logChange(modal.editing ? \`Editou a ideia "\${item.t}"\` : \`Adicionou a ideia "\${item.t}"\`); closeModal();
  };
  const deleteIdeia = async () => { await deleteDoc(doc(db, "ideias", d.id.toString())); logChange(\`Excluiu a ideia "\${d.t}"\`); closeModal(); };

`;

content = content.substring(0, startIndex) + newCrud + content.substring(endIndex);

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx modified!');
