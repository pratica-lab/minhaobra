import fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

content = content.replace(
  `            <button onClick={()=>{
              const val = newCatInput?.trim();
              if(val){
                if(!safeCats.find(c=>c?.nome?.toLowerCase() === val.toLowerCase())) {
                   setIdeiaCats([...safeCats, {id:uid(), nome:val, ativa:true}]);
                }
                setNewCatInput("");
              }
            }}`,
  `            <button onClick={async ()=>{
              const val = newCatInput?.trim();
              if(val){
                if(!safeCats.find(c=>c?.nome?.toLowerCase() === val.toLowerCase())) {
                   const item = {id:uid(), nome:val, ativa:true};
                   await setDoc(doc(db, "ideiaCats", item.id.toString()), item);
                }
                setNewCatInput("");
              }
            }}`
);

content = content.replace(
  `                <input value={c.nome} onChange={e=>{
                   setIdeiaCats(p=>p.map(x=>x.id===c.id?{...x,nome:e.target.value}:x));
                   setIdeias(p=>p.map(i=>i.cat===c.nome?{...i,cat:e.target.value}:i));
                }}`,
  `                <input value={c.nome} onChange={async e=>{
                   await setDoc(doc(db, "ideiaCats", c.id.toString()), {...c, nome:e.target.value});
                   ideias.forEach(async i => {
                     if(i.cat===c.nome) await setDoc(doc(db, "ideias", i.id.toString()), {...i, cat:e.target.value});
                   });
                }}`
);

content = content.replace(
  `                <button onClick={()=>setIdeiaCats(p=>p.map(x=>x.id===c.id?{...x,ativa:!x.ativa}:x))} style`,
  `                <button onClick={async ()=>await setDoc(doc(db, "ideiaCats", c.id.toString()), {...c, ativa:!c.ativa})} style`
);

content = content.replace(
  `      const addNewTag = (e) => {
        e.preventDefault();
        const nt = prompt("Digite a nova tag (ex: 🔴 Urgente):");
        if(nt && nt.trim() && !(ideiaTags||[]).includes(nt.trim())) {
           setIdeiaTags(p => [...p, nt.trim()]); toggleTag(nt.trim());
        } else if (nt && nt.trim()) { toggleTag(nt.trim()); }
      };`,
  `      const addNewTag = async (e) => {
        e.preventDefault();
        const nt = prompt("Digite a nova tag (ex: 🔴 Urgente):");
        if(nt && nt.trim() && !(ideiaTags||[]).includes(nt.trim())) {
           await setDoc(doc(db, "meta", "ideiaTags"), { tags: [...(ideiaTags||[]), nt.trim()] });
           toggleTag(nt.trim());
        } else if (nt && nt.trim()) { toggleTag(nt.trim()); }
      };`
);

content = content.replace(
  `         <Btn label="Salvar Tarefa" onClick={()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, done:!!d.done, obs:d.obs||""};
           if(editing) setTarefas(p=>p.map(x=>x.id===d.id?item:x)); else setTarefas(p=>[...p,{...item,id:uid()}]);
           logChange(editing ? \`Editou a tarefa "\${d.t}"\` : \`Criou a tarefa "\${d.t}"\`); closeModal();
         }}/>
         {editing && <Btn label="Excluir tarefa" onClick={()=>{setTarefas(p=>p.filter(x=>x.id!==d.id)); logChange(\`Excluiu a tarefa "\${d.t}"\`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}`,
  `         <Btn label="Salvar Tarefa" onClick={async ()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, done:!!d.done, obs:d.obs||""};
           if(!editing) item.id = uid();
           await setDoc(doc(db, "tarefas", item.id.toString()), item);
           logChange(editing ? \`Editou a tarefa "\${d.t}"\` : \`Criou a tarefa "\${d.t}"\`); closeModal();
         }}/>
         {editing && <Btn label="Excluir tarefa" onClick={async ()=>{await deleteDoc(doc(db, "tarefas", d.id.toString())); logChange(\`Excluiu a tarefa "\${d.t}"\`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}`
);

content = content.replace(
  `         <Btn label="Salvar Anotação" onClick={()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, data: d.data||todayFmt()};
           if(editing) setAnotacoes(p=>p.map(x=>x.id===d.id?item:x)); else setAnotacoes(p=>[...p,{...item,id:uid()}]);
           logChange(editing ? \`Editou a anotação "\${d.t}"\` : \`Criou a anotação "\${d.t}"\`); closeModal();
         }}/>
         {editing && <Btn label="Excluir anotação" onClick={()=>{setAnotacoes(p=>p.filter(x=>x.id!==d.id)); logChange(\`Excluiu a anotação "\${d.t}"\`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}`,
  `         <Btn label="Salvar Anotação" onClick={async ()=>{
           if(!d.t?.trim()) return alert("Título obrigatório");
           const item = {...d, data: d.data||todayFmt()};
           if(!editing) item.id = uid();
           await setDoc(doc(db, "anotacoes", item.id.toString()), item);
           logChange(editing ? \`Editou a anotação "\${d.t}"\` : \`Criou a anotação "\${d.t}"\`); closeModal();
         }}/>
         {editing && <Btn label="Excluir anotação" onClick={async ()=>{await deleteDoc(doc(db, "anotacoes", d.id.toString())); logChange(\`Excluiu a anotação "\${d.t}"\`); closeModal();}} color={C.danger} outline icon={<Trash2 size={15}/>}/>}`
);

fs.writeFileSync('src/App.jsx', content);
console.log('App.jsx further modified!');
