const { Octokit } = window;

const el = (id)=>document.getElementById(id);
const subjectsEl = document.getElementById('subjects');
const dtEl = el('dt');
const contentEl = el('content');
const hwEl = el('homework');
const saveMsg = el('saveMsg');
const listEl = el('list');
const statsEl = el('stats');
const filterSubjectEl = el('filterSubject');
const btnSave = el('btnSave');
const btnClear = el('btnClear');
const btnExport = el('btnExport');
const btnPrint = el('btnPrint');
const btnLogin = el('btnLogin');
const btnLogout = el('btnLogout');
const loginStatus = el('loginStatus');
const repoOwnerEl = el('repoOwner');
const repoNameEl = el('repoName');
const btnSaveRepo = el('btnSaveRepo');
const workspaceIdEl = el('workspaceId');
const btnJoin = el('btnJoin');

const CFG_KEY = 'ghIssuesTrackerCfg:v2';
let CFG = loadCfg();
// Defaults already prefilled in HTML. We still read to honor user changes.
repoOwnerEl.value = CFG.repoOwner || repoOwnerEl.value || 'ntu-philo';
repoNameEl.value  = CFG.repoName  || repoNameEl.value  || 'tutoring-tracker';
workspaceIdEl.value = CFG.workspaceId || workspaceIdEl.value || '家教複習課';

function toLocalDatetimeInputValue(d=new Date()){
  const pad=(n)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
dtEl.value = toLocalDatetimeInputValue();

let currentSubject = '';
let token = sessionStorage.getItem('gh_token') || '';
let octokit = token ? new Octokit({ auth: token }) : null;
updateAuthUI();

subjectsEl.addEventListener('click', (e)=>{
  const b = e.target.closest('button[data-subject]');
  if(!b) return;
  currentSubject = b.dataset.subject;
  subjectsEl.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active', btn===b));
});

btnSaveRepo.addEventListener('click', ()=>{
  CFG.repoOwner = repoOwnerEl.value.trim();
  CFG.repoName  = repoNameEl.value.trim();
  saveCfg();
  alert('已儲存 repo 設定');
});

btnJoin.addEventListener('click', ()=>{
  CFG.workspaceId = workspaceIdEl.value.trim();
  saveCfg();
  loadIssues();
});

btnLogin.addEventListener('click', () => popupLogin());
btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('gh_token');
  token = '';
  octokit = null;
  updateAuthUI();
});

window.addEventListener('message', (e)=>{
  try{
    const data = e.data || {};
    if(data.type === 'github_token' && data.token){
      token = data.token;
      sessionStorage.setItem('gh_token', token);
      octokit = new Octokit({ auth: token });
      updateAuthUI();
    }
  }catch{}
});

btnSave.addEventListener('click', async ()=>{
  requireAuth();
  const ws = CFG.workspaceId?.trim();
  if(!ws){ alert('請先輸入工作區代碼並載入紀錄'); return; }
  if(!currentSubject){ alert('請先選擇科目'); return; }

  const dt = dtEl.value ? new Date(dtEl.value) : new Date();
  const payload = {
    workspaceId: ws,
    subject: currentSubject,
    dt: dt.toISOString(),
    content: contentEl.value.trim(),
    homework: hwEl.value.trim(),
    app: '家教複習課',
  };
  const title = `【家教複習課】[${ws}] ${fmtDate(dt)} ${currentSubject}：${payload.content.slice(0,32)}`;
  const body = "```json\n" + JSON.stringify(payload, null, 2) + "\n```";

  try{
    await octokit.rest.issues.create({
      owner: CFG.repoOwner, repo: CFG.repoName,
      title, body,
      labels: ['tutoring','class-tracker', `ws:${ws}`, `subj:${currentSubject}`]
    });
    saveMsg.textContent = '已儲存到 GitHub ✅';
    setTimeout(()=> saveMsg.textContent='', 1200);
    dtEl.value = toLocalDatetimeInputValue();
    contentEl.value=''; hwEl.value='';
    await loadIssues();
  }catch(err){
    alert('建立 Issue 失敗：' + err.message);
    console.error(err);
  }
});

btnClear.addEventListener('click', ()=>{ contentEl.value=''; hwEl.value=''; });
filterSubjectEl.addEventListener('change', ()=> render(lastIssuesCache));
btnExport.addEventListener('click', ()=> exportCSV());
btnPrint.addEventListener('click', ()=> window.print());

function updateAuthUI(){
  if(token){
    loginStatus.textContent = '已登入 GitHub';
    btnLogin.hidden = true;
    btnLogout.hidden = false;
  }else{
    loginStatus.textContent = '未登入';
    btnLogin.hidden = false;
    btnLogout.hidden = true;
  }
}
function requireAuth(){
  if(!token) throw new Error('請先以 GitHub 登入');
}

function popupLogin(){
  const w = 600, h = 720;
  const left = screenX + (innerWidth - w)/2;
  const top = screenY + (innerHeight - h)/2;
  const popup = window.open('/functions/auth/login', 'ghLogin', `width=${w},height=${h},left=${left},top=${top}`);
  if(!popup){ alert('請允許彈出視窗'); }
}

let lastIssuesCache = [];
async function loadIssues(page=1, acc=[]){
  requireAuth();
  const ws = CFG.workspaceId?.trim();
  if(!ws){ alert('請先輸入工作區代碼'); return; }
  if(!CFG.repoOwner || !CFG.repoName){ alert('請先設定 repo 擁有者/名稱'); return; }

  try{
    const res = await octokit.rest.issues.listForRepo({
      owner: CFG.repoOwner, repo: CFG.repoName,
      labels: `tutoring,class-tracker,ws:${ws}`,
      state: 'open',
      per_page: 100, page,
      sort: 'created', direction: 'desc'
    });
    const items = res.data || [];
    acc = acc.concat(items);
    if(items.length === 100){
      return loadIssues(page+1, acc);
    }else{
      lastIssuesCache = acc;
      render(acc);
      return acc;
    }
  }catch(err){
    alert('載入 Issues 失敗：' + err.message);
    console.error(err);
  }
}

function parsePayloadFromBody(body){
  const m = body.match(/```json\n([\s\S]*?)\n```/);
  if(!m) return null;
  try{ return JSON.parse(m[1]); }catch{ return null; }
}

function render(issues){
  issues = issues || [];
  const f = filterSubjectEl.value;
  const rows = issues.map(it=>{
    const p = parsePayloadFromBody(it.body||'') || {};
    return { id: it.number, node: it, ...p };
  }).filter(r=> r.workspaceId && (!f || r.subject===f));

  const asc = [...rows].sort((a,b)=> new Date(a.dt)-new Date(b.dt));
  const idToGroup = new Map(asc.map((r,i)=>[r.id, Math.floor(i/5)+1]));

  const counts = { '國':0,'英':0,'數':0,'社':0,'自':0 };
  rows.forEach(r=>{ if(counts[r.subject]!=null) counts[r.subject]++; });
  const groupNow = Math.floor(asc.length/5)+1;
  statsEl.innerHTML = '';
  const node=(t)=>{ const s=document.createElement('span'); s.className='stat'; s.textContent=t; return s; };
  statsEl.appendChild(node(`總次數：${asc.length}`));
  statsEl.appendChild(node(`目前組別：第 ${groupNow} 組`));
  Object.entries(counts).forEach(([k,v])=> statsEl.appendChild(node(`${k}：${v}`)));

  listEl.innerHTML = '';
  rows.sort((a,b)=> new Date(b.dt)-new Date(a.dt)).forEach(r=>{
    const g = idToGroup.get(r.id) || 1;
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="rowline">
        <span class="badge">科目：${r.subject||''}</span>
        <span class="badge">時間：${formatDT(r.dt||r.node.created_at)}</span>
        <span class="badge groupTag">第 ${g} 組（第 ${g*5-4}～${g*5} 次）</span>
        <span class="badge">Issue #${r.id}</span>
      </div>
      <div class="meta">上課內容：${escapeHtml(r.content||'')}</div>
      <div class="meta">作業：${escapeHtml(r.homework||'')}</div>
      <div class="actions-line">
        <button data-act="edit" data-id="${r.id}">編輯</button>
        <button data-act="close" data-id="${r.id}">刪除(關閉)</button>
      </div>
    `;
    listEl.appendChild(div);
  });

  listEl.querySelectorAll('[data-act="close"]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if(!confirm('確定關閉這筆 Issue？')) return;
      try{
        await octokit.rest.issues.update({
          owner: CFG.repoOwner, repo: CFG.repoName,
          issue_number: Number(b.dataset.id),
          state: 'closed',
        });
        await loadIssues();
      }catch(err){
        alert('關閉失敗：' + err.message);
      }
    });
  });

  listEl.querySelectorAll('[data-act="edit"]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      const id = Number(b.dataset.id);
      const issue = issues.find(it=> it.number===id);
      const p = parsePayloadFromBody(issue.body||'') || {};
      const content = prompt('上課內容（留空不變）', p.content||'');
      if(content===null) return;
      const homework = prompt('作業（留空不變）', p.homework||'');
      if(homework===null) return;
      if(content!=='' || homework!==''){
        if(content!=='') p.content = content;
        if(homework!=='') p.homework = homework;
        const body = "```json\n" + JSON.stringify(p, null, 2) + "\n```";
        try{
          await octokit.rest.issues.update({
            owner: CFG.repoOwner, repo: CFG.repoName,
            issue_number: id, body
          });
          await loadIssues();
        }catch(err){
          alert('更新失敗：' + err.message);
        }
      }
    });
  });
}

function exportCSV(){
  const issues = lastIssuesCache || [];
  const rows = issues.map(it=>{
    const p = parsePayloadFromBody(it.body||'') || {};
    return { id: it.number, ...p };
  }).filter(r=> r.workspaceId);
  const asc = rows.sort((a,b)=> new Date(a.dt)-new Date(b.dt));
  const header = ['序號','Issue#','工作區','科目','日期時間','上課內容','作業'];
  const lines = [header.join(',')];
  asc.forEach((r,i)=>{
    const line = [
      i+1, r.id, safe(r.workspaceId||''), safe(r.subject||''),
      formatDT(r.dt||''), q(safe(r.content||'')), q(safe(r.homework||''))
    ].join(',');
    lines.push(line);
  });
  downloadText('家教複習課-上課紀錄.csv', lines.join('\n'));
}

function loadCfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)||'{}'); }catch{return {}; } }
function saveCfg(){ localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); }
function fmtDate(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function q(s){ return `"${(s||'').replaceAll('"','""')}"`; }
function safe(s){ return (s||'').replaceAll(',','，').replaceAll('\n',' '); }
function escapeHtml(s=''){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function formatDT(iso){
  if(!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${y}-${m}-${da} ${h}:${mi}`;
}

if(workspaceIdEl.value){ /* auto-join after login */ }
