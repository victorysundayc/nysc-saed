(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'georeference-lab-v1';
  const state = { points: [], residuals: [], projects: [], currentProject: null };
  let toastTimer;
  function notify(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }
  function safeStore() {
    try { localStorage.setItem(KEY, JSON.stringify({points:state.points,residuals:state.residuals,projects:state.projects,currentProject:state.currentProject})); } catch(e) { notify('Could not save locally. Export a backup to keep your work.'); }
    updateHome();
  }
  function loadStore() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      state.points = Array.isArray(data.points) ? data.points : [];
      state.residuals = Array.isArray(data.residuals) ? data.residuals : [];
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      state.currentProject = data.currentProject || null;
    } catch (_) {}
  }
  function escapeText(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function go(id) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.go === id));
    window.scrollTo({top:0,behavior:'smooth'});
    if (id === 'projects') renderProjects();
  }
  $$('[data-go]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.go)));
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const dark = document.body.classList.contains('dark');
    $('#themeBtn').textContent = dark ? '☾' : '☼';
    try { localStorage.setItem('georef-lab-theme', dark ? 'dark' : 'light'); } catch (_) {}
  });
  try { if (localStorage.getItem('georef-lab-theme') === 'dark') { document.body.classList.add('dark'); $('#themeBtn').textContent = '☾'; } } catch (_) {}

  // Local image preview: image is not sent to a server.
  let imageUrl = null;
  $('#imageInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Please choose an image file.'); return; }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    $('#mapPreview').src = imageUrl; $('#imageStage').classList.remove('hidden');
    notify('Image loaded for preview. Image georeferencing is not performed here.');
  });

  function renderPoints() {
    const body = $('#pointRows'); body.replaceChildren();
    if (!state.points.length) body.innerHTML = '<tr><td colspan="7" class="empty">No control points yet.</td></tr>';
    state.points.forEach((p, i) => {
      const tr = document.createElement('tr');
      [p.id, p.px ?? '', p.py ?? '', p.x, p.y, p.note || '—'].forEach(v => { const td=document.createElement('td'); td.textContent=String(v); tr.append(td); });
      const td=document.createElement('td'), b=document.createElement('button'); b.className='delete-btn'; b.type='button'; b.textContent='Delete';
      b.addEventListener('click',()=>{state.points.splice(i,1);renderPoints();safeStore();});
      td.append(b);tr.append(td);body.append(tr);
    });
    $('#pointCount').textContent = `${state.points.length} control point${state.points.length===1?'':'s'}`;
    $('#pointBadge').textContent = `${state.points.length} POINT${state.points.length===1?'':'S'}`;
    updateHome();
  }
  $('#gcpForm').addEventListener('submit', e => {
    e.preventDefault();
    const p={id:$('#pointId').value.trim(),px:$('#pixelX').value===''?'':Number($('#pixelX').value),py:$('#pixelY').value===''?'':Number($('#pixelY').value),x:Number($('#coordX').value),y:Number($('#coordY').value),note:$('#pointNote').value.trim()};
    if (!p.id || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { notify('Enter a point ID and valid known coordinates.'); return; }
    if (state.points.some(q=>q.id.toLowerCase()===p.id.toLowerCase())) { notify('That point ID already exists.'); return; }
    if ((p.px!==''&&!Number.isFinite(p.px))||(p.py!==''&&!Number.isFinite(p.py))) { notify('Image pixel coordinates must be numbers.'); return; }
    state.points.push(p); e.target.reset(); renderPoints(); safeStore(); notify('Control point added.');
  });
  const csvCell = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  function download(name, content, type) {
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#exportCsvBtn').addEventListener('click',()=>{
    if(!state.points.length){notify('Add control points first.');return;}
    const rows=[['id','pixel_x','pixel_y','known_x','known_y','notes'],...state.points.map(p=>[p.id,p.px,p.py,p.x,p.y,p.note])];
    download('georeferencing-control-points.csv','\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8;');notify('Control-point CSV exported.');
  });
  $('#importCsvBtn').addEventListener('click',()=>$('#csvInput').click());
  $('#csvInput').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      const text=await file.text(); const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
      if(lines.length<2)throw Error('CSV needs a header and at least one data row.');
      const parseLine=line=>{const out=[];let s='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&q){s+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){out.push(s);s='';}else s+=c;}out.push(s);return out.map(v=>v.trim());};
      const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[\s-]+/g,'_'));
      const pick=(obj,names)=>{for(const n of names){const i=headers.indexOf(n);if(i>=0)return obj[i]??'';}return '';};
      let added=0;
      for(const line of lines.slice(1)){const row=parseLine(line);const id=pick(row,['id','point_id','name']);const x=Number(pick(row,['known_x','x','easting','longitude']));const y=Number(pick(row,['known_y','y','northing','latitude']));if(!id||!Number.isFinite(x)||!Number.isFinite(y)||state.points.some(p=>p.id.toLowerCase()===id.toLowerCase()))continue;
        const px=pick(row,['pixel_x','image_x','px']),py=pick(row,['pixel_y','image_y','py']);
        state.points.push({id,px:px===''?'':Number(px),py:py===''?'':Number(py),x,y,note:pick(row,['notes','note','description'])});added++;
      }
      renderPoints();safeStore();notify(`Imported ${added} point${added===1?'':'s'}.`);
    } catch(err){notify(err.message||'Could not read CSV. Check the headers and format.');}
    e.target.value='';
  });

  function rmse() {
    if(!state.residuals.length){$('#rmseValue').textContent='—';$('#rmseUnit').textContent='Enter coordinate pairs to calculate.';return;}
    const mean=state.residuals.reduce((sum,r)=>sum+r.dx*r.dx+r.dy*r.dy,0)/state.residuals.length;
    $('#rmseValue').textContent=Math.sqrt(mean).toLocaleString(undefined,{maximumFractionDigits:4});
    $('#rmseUnit').textContent='Coordinate units of your input CRS · 2D RMSE';
  }
  function renderResiduals() {
    const body=$('#resRows');body.replaceChildren();
    if(!state.residuals.length)body.innerHTML='<tr><td colspan="5" class="empty">No checks entered yet.</td></tr>';
    state.residuals.forEach((r,i)=>{
      const tr=document.createElement('tr');
      [r.id,r.dx.toFixed(4),r.dy.toFixed(4),Math.hypot(r.dx,r.dy).toFixed(4)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
      const td=document.createElement('td'),b=document.createElement('button');b.className='delete-btn';b.textContent='Delete';b.type='button';b.addEventListener('click',()=>{state.residuals.splice(i,1);renderResiduals();safeStore();});td.append(b);tr.append(td);body.append(tr);
    });
    $('#resCount').textContent=`${state.residuals.length} validation point${state.residuals.length===1?'':'s'}`;rmse();
  }
  $('#residualForm').addEventListener('submit',e=>{
    e.preventDefault();const id=$('#resId').value.trim();const vals=['refX','refY','estX','estY'].map(k=>Number($('#'+k).value));
    if(!id||!vals.every(Number.isFinite)){notify('Enter an ID and all four coordinate values.');return;}
    if(state.residuals.some(r=>r.id.toLowerCase()===id.toLowerCase())){notify('That validation point ID already exists.');return;}
    state.residuals.push({id,dx:vals[2]-vals[0],dy:vals[3]-vals[1]});e.target.reset();renderResiduals();safeStore();notify('Residual calculated.');
  });
  $('#clearResiduals').addEventListener('click',()=>{state.residuals=[];renderResiduals();safeStore();notify('Validation points cleared.');});

  $('#quizForm').addEventListener('submit',e=>{
    e.preventDefault();const answers={q1:'b',q2:'c',q3:'a'};let score=0;Object.entries(answers).forEach(([q,a])=>{if($(`input[name="${q}"]:checked`)?.value===a)score++;});
    const result=$('#quizResult');result.classList.remove('hidden');result.textContent=`You scored ${score} out of 3. ${score===3?'Excellent work!':score===2?'Good progress—review the missed answer.':'Review the lessons and try again.'}`;
  });

  function updateHome(){
    $('#homePoints').textContent=state.points.length;
    const checks=$$('#checklist input:checked').length;$('#homeChecks').textContent=Math.round(checks/5*100)+'%';
    $('#homeProjects').textContent=state.projects.length;
  }
  // Optional checklist retained as lightweight progress within app.
  const checklist=document.createElement('div'); checklist.className='hidden'; checklist.id='checklist';
  for(let i=0;i<5;i++){const cb=document.createElement('input');cb.type='checkbox';cb.dataset.check=String(i);cb.addEventListener('change',updateHome);checklist.append(cb);}
  document.body.append(checklist);

  function snapshot(name){return {name,updatedAt:new Date().toISOString(),points:state.points,residuals:state.residuals};}
  function renderProjects(){
    const list=$('#projectList');list.replaceChildren();
    if(!state.projects.length){list.innerHTML='<div class="empty-projects">No saved projects yet. Save your current work above.</div>';return;}
    state.projects.forEach((p,i)=>{
      const item=document.createElement('div');item.className='project-item';
      const symbol=document.createElement('div');symbol.className='project-symbol';symbol.textContent='▣';
      const info=document.createElement('div');info.className='project-info';
      const name=document.createElement('b');name.textContent=p.name;
      const meta=document.createElement('small');meta.textContent=`${p.points.length} GCPs · ${p.residuals.length} checks · ${new Date(p.updatedAt).toLocaleString()}`;
      info.append(name,meta);
      const buttons=document.createElement('div');buttons.className='project-buttons';
      const load=document.createElement('button');load.className='btn small secondary';load.type='button';load.textContent='Load';load.addEventListener('click',()=>{state.points=structuredCloneSafe(p.points);state.residuals=structuredCloneSafe(p.residuals);state.currentProject=p.name;renderPoints();renderResiduals();safeStore();go('maplab');notify('Project loaded.');});
      const del=document.createElement('button');del.className='delete-btn';del.textContent='Delete';del.type='button';del.addEventListener('click',()=>{state.projects.splice(i,1);safeStore();renderProjects();});
      buttons.append(load,del);item.append(symbol,info,buttons);list.append(item);
    });
  }
  function structuredCloneSafe(x){return JSON.parse(JSON.stringify(x||[]));}
  $('#projectForm').addEventListener('submit',e=>{
    e.preventDefault();const name=$('#projectName').value.trim();if(!name)return;
    const project=snapshot(name);const index=state.projects.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
    if(index>=0)state.projects[index]=project;else state.projects.unshift(project);
    state.currentProject=name;safeStore();renderProjects();e.target.reset();notify('Project saved on this device.');
  });
  $('#backupBtn').addEventListener('click',()=>download('georeference-lab-backup.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),points:state.points,residuals:state.residuals,projects:state.projects,currentProject:state.currentProject},null,2),'application/json'));
  $('#restoreInput').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const d=JSON.parse(await file.text());if(!Array.isArray(d.points)||!Array.isArray(d.residuals)||!Array.isArray(d.projects))throw Error('Backup format is not recognised.');
      state.points=d.points;state.residuals=d.residuals;state.projects=d.projects;state.currentProject=d.currentProject||null;renderPoints();renderResiduals();safeStore();renderProjects();notify('Backup restored.');}
    catch(err){notify(err.message||'Could not restore backup.');}e.target.value='';
  });
  loadStore();renderPoints();renderResiduals();renderProjects();updateHome();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();