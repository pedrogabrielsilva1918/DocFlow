import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {mergeRequestTypes,validateType,validateFiles,type RequestType} from '../../../lib/request-types';
import {isAllowedOrigin} from '../../../lib/request-origin';
declare const __DOCFLOW_DEVELOPMENT_ORIGIN__:string;
const db=()=>env.DB!;
async function context(){
 const u=await getChatGPTUser();if(!u)throw new Error('Entre na sua conta para continuar.');
 const owner=(env as unknown as {ADMIN_EMAIL?:string}).ADMIN_EMAIL;
 return {u,admin:!!owner&&u.email.toLowerCase()===owner.toLowerCase()};
}
async function types():Promise<RequestType[]>{
 const row=await db().prepare("SELECT value FROM settings WHERE key='request_types'").first<{value:string}>();
 return mergeRequestTypes(row?JSON.parse(row.value):null);
}
export async function GET(req:Request){try{
 const {u,admin}=await context();const url=new URL(req.url);const file=url.searchParams.get('file');
 if(file){
  const attachment=await db().prepare('SELECT a.*,d.owner FROM attachments a JOIN documents d ON a.document_id=d.id WHERE a.id=?').bind(file).first<any>();
  const d=attachment||await db().prepare('SELECT * FROM documents WHERE id=?').bind(file).first<any>();
  if(!d||(!admin&&d.owner!==u.userId))return new Response('Não encontrado',{status:404});
  const object=await env.BUCKET!.get(file);if(!object)return new Response('Arquivo indisponível',{status:404});
  return new Response(object.body,{headers:{'Content-Type':d.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});
 }
 const profile=await db().prepare('SELECT * FROM profiles WHERE id=?').bind(u.userId).first();
 const rows=await db().prepare(admin?'SELECT d.*,p.name,p.email FROM documents d LEFT JOIN profiles p ON d.owner=p.id ORDER BY created DESC':'SELECT d.*,p.name,p.email FROM documents d LEFT JOIN profiles p ON d.owner=p.id WHERE owner=? ORDER BY created DESC').bind(...(admin?[]:[u.userId])).all();
 const files=await db().prepare(admin?'SELECT a.* FROM attachments a JOIN documents d ON a.document_id=d.id':'SELECT a.* FROM attachments a JOIN documents d ON a.document_id=d.id WHERE d.owner=?').bind(...(admin?[]:[u.userId])).all<any>();
 const events=await db().prepare(admin?'SELECT h.* FROM request_history h JOIN documents d ON h.document_id=d.id ORDER BY h.created,h.rowid':'SELECT h.* FROM request_history h JOIN documents d ON h.document_id=d.id WHERE d.owner=? ORDER BY h.created,h.rowid').bind(...(admin?[]:[u.userId])).all<any>();
 const documents=rows.results.map((d:any)=>{
  const all=files.results.filter(a=>a.document_id===d.id);
  const atRevision=(revision:number)=>all.filter(a=>a.revision===revision);
  const history=events.results.filter(h=>h.document_id===d.id);
  const known=history.length?history:[{id:'previous-'+d.id,document_id:d.id,revision:1,action:'previous',status:d.status,reason:d.reason,message:d.message,created:d.updated,actor:'Histórico anterior'}];
  return {...d,requirements:JSON.parse(d.requirements||'[]'),attachments:atRevision(d.revision),history:known.map(h=>({...h,attachments:atRevision(h.revision).length?atRevision(h.revision):h.revision===1?[{id:d.id,label:'Documento original',filename:d.filename}]:[]}))};
 });
 const requestTypes=(await types()).filter(t=>admin||t.active);
 return Response.json({user:u,admin,profile,documents,requestTypes},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:(e as Error).message},{status:401})}}
export async function POST(req:Request){try{
 if(!isAllowedOrigin(req,typeof __DOCFLOW_DEVELOPMENT_ORIGIN__==='string'?__DOCFLOW_DEVELOPMENT_ORIGIN__:''))return Response.json({error:'Origem inválida'},{status:403});
 const {u,admin}=await context();const form=await req.formData();const action=form.get('action');
 if(action==='profile'){
  const name=String(form.get('name')||'').trim();if(name.length<3||name.length>120)throw new Error('Informe seu nome completo.');
  await db().prepare('INSERT INTO profiles(id,name,email,phone) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone').bind(u.userId,name,u.email,String(form.get('phone')||'').slice(0,30)).run();return Response.json({ok:true});
 }
 if(action==='saveType'){
  if(!admin)return Response.json({error:'Acesso restrito'},{status:403});
  const type=validateType({id:String(form.get('id')||crypto.randomUUID()),name:form.get('name'),description:form.get('description'),active:form.get('active')==='on',requirements:String(form.get('requirements')||'').split('\n')});
  const current=await types();const index=current.findIndex(t=>t.id===type.id);
  if(current.some(t=>t.id!==type.id&&t.name.toLowerCase()===type.name.toLowerCase()))throw new Error('Já existe um tipo com esse nome.');
  if(index<0){if(current.length>=30)throw new Error('Limite de 30 tipos atingido. Edite um tipo existente.');current.push(type);}else current[index]=type;
  await db().prepare("INSERT INTO settings(key,value) VALUES('request_types',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(current)).run();return Response.json({ok:true});
 }
 if(action==='review'||action==='resubmit'){
  if(action==='review'&&!admin)return Response.json({error:'Acesso restrito'},{status:403});
  const document=await db().prepare('SELECT * FROM documents WHERE id=?').bind(String(form.get('id')||'')).first<any>();
  if(!document||(action==='resubmit'&&document.owner!==u.userId))return Response.json({error:'Solicitação não encontrada.'},{status:404});
  const expected=Number(form.get('version'));
  if(!Number.isSafeInteger(expected)||expected<1||expected!==document.version)return Response.json({error:'A solicitação foi atualizada. Feche os detalhes e recarregue a página antes de continuar.'},{status:409});
  const now=new Date().toISOString();
  const history=(revision:number,kind:string,status:string,reason:string,message:string,created:string,actor:string)=>db().prepare('INSERT INTO request_history(id,document_id,revision,action,status,reason,message,created,actor) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=? AND version=?)').bind(crypto.randomUUID(),document.id,revision,kind,status,reason,message,created,actor,document.id,expected);
  const baseline=db().prepare('INSERT INTO request_history(id,document_id,revision,action,status,reason,message,created,actor) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM request_history WHERE document_id=?)').bind(crypto.randomUUID(),document.id,document.revision,'previous',document.status,document.reason,document.message,document.updated,'Histórico anterior',document.id,expected,document.id);
  if(action==='review'){
   const status=String(form.get('status'));const reason=String(form.get('reason')||'').trim().slice(0,2000);
   if(!['Aprovado','Recusado'].includes(status))throw new Error('Status inválido.');if(status==='Recusado'&&!reason)throw new Error('Informe o motivo da recusa.');
   const result=await db().batch([baseline,history(document.revision,'review',status,reason,document.message,now,'Administrador'),db().prepare('UPDATE documents SET status=?,reason=?,updated=?,version=version+1 WHERE id=? AND version=?').bind(status,reason,now,document.id,expected)]);
   if(!result[2].meta.changes)return Response.json({error:'A solicitação foi atualizada. Recarregue a página.'},{status:409});
   return Response.json({ok:true});
  }
  if(document.status!=='Recusado')return Response.json({error:'Apenas solicitações recusadas podem ser reenviadas.'},{status:409});
  const requirements:string[]=JSON.parse(document.requirements||'[]');
  if(!requirements.length)requirements.push('Documento para análise');
  const files=validateFiles({id:'resubmit',name:document.category,description:'',active:true,requirements},form);
  const title=String(form.get('title')||'').trim();if(!title||title.length>160)throw new Error('Informe um título com até 160 caracteres.');
  const message=String(form.get('message')||'').slice(0,2000);const revision=document.revision+1;const uploaded:string[]=[];
  try{
   const entries=[];
   for(let i=0;i<files.length;i++){
    const key=crypto.randomUUID();await env.BUCKET!.put(key,await files[i].arrayBuffer());uploaded.push(key);
    entries.push(db().prepare('INSERT INTO attachments(id,document_id,label,filename,mime,revision) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=? AND version=?)').bind(key,document.id,requirements[i],files[i].name.slice(0,200),files[i].type,revision,document.id,expected));
   }
   const result=await db().batch([baseline,...entries,history(revision,'resubmit','Em análise','',message,now,'Solicitante'),db().prepare("UPDATE documents SET title=?,message=?,requirements=?,status='Em análise',reason='',updated=?,revision=?,version=version+1 WHERE id=? AND version=?").bind(title,message,JSON.stringify(requirements),now,revision,document.id,expected)]);
   if(!result[result.length-1].meta.changes){await Promise.allSettled(uploaded.map(key=>env.BUCKET!.delete(key)));return Response.json({error:'A solicitação foi atualizada durante o envio. Recarregue a página.'},{status:409});}
  }catch(e){await Promise.allSettled(uploaded.map(key=>env.BUCKET!.delete(key)));throw e;}
  return Response.json({ok:true});
 }
 if(action==='upload'){
  const profile=await db().prepare('SELECT id FROM profiles WHERE id=?').bind(u.userId).first();if(!profile)throw new Error('Complete seu cadastro primeiro.');
  const type=(await types()).find(t=>t.id===form.get('requestType'));if(!type)throw new Error('Selecione um tipo de solicitação. Se necessário, recarregue a página.');
  if(form.get('requirementsVersion')!==JSON.stringify(type.requirements))throw new Error('A lista de documentos foi atualizada. Feche o formulário e recarregue a página para conferir as novas exigências.');
  const files=validateFiles(type,form);
  const title=String(form.get('title')||'').trim();if(!title||title.length>160)throw new Error('Informe um título com até 160 caracteres.');
  const id=crypto.randomUUID();const now=new Date().toISOString();const uploaded:string[]=[];
  try{
   const entries=[];
   for(let i=0;i<files.length;i++){
    const f=files[i];const key=i===0?id:crypto.randomUUID();await env.BUCKET!.put(key,await f.arrayBuffer());uploaded.push(key);
    entries.push(db().prepare('INSERT INTO attachments(id,document_id,label,filename,mime) VALUES(?,?,?,?,?)').bind(key,id,type.requirements[i],f.name.slice(0,200),f.type));
   }
   await db().batch([
    db().prepare('INSERT INTO documents(id,owner,title,category,message,filename,mime,status,reason,created,updated,requirements) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.userId,title,type.name,String(form.get('message')||'').slice(0,2000),files[0].name.slice(0,200),files[0].type,'Em análise','',now,now,JSON.stringify(type.requirements)),db().prepare('INSERT INTO request_history(id,document_id,revision,action,status,reason,message,created,actor) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,1,'upload','Em análise','',String(form.get('message')||'').slice(0,2000),now,'Solicitante'),...entries
   ]);
  }catch(e){await Promise.allSettled(uploaded.map(key=>env.BUCKET!.delete(key)));throw e;}
  return Response.json({ok:true});
 }
 throw new Error('Operação inválida.');
}catch(e){return Response.json({error:(e as Error).message},{status:400})}}
