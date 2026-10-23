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
 const documents=rows.results.map((d:any)=>({...d,requirements:JSON.parse(d.requirements||'[]'),attachments:files.results.filter(a=>a.document_id===d.id)}));
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
 if(action==='review'){
  if(!admin)return Response.json({error:'Acesso restrito'},{status:403});
  const status=String(form.get('status'));const reason=String(form.get('reason')||'').trim().slice(0,2000);
  if(!['Aprovado','Recusado'].includes(status))throw new Error('Status inválido.');if(status==='Recusado'&&!reason)throw new Error('Informe o motivo da recusa.');
  const result=await db().prepare('UPDATE documents SET status=?,reason=?,updated=? WHERE id=?').bind(status,reason,new Date().toISOString(),form.get('id')).run();
  if(!result.meta.changes)throw new Error('Solicitação não encontrada.');return Response.json({ok:true});
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
    db().prepare('INSERT INTO documents(id,owner,title,category,message,filename,mime,status,reason,created,updated,requirements) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.userId,title,type.name,String(form.get('message')||'').slice(0,2000),files[0].name.slice(0,200),files[0].type,'Em análise','',now,now,JSON.stringify(type.requirements)),...entries
   ]);
  }catch(e){await Promise.allSettled(uploaded.map(key=>env.BUCKET!.delete(key)));throw e;}
  return Response.json({ok:true});
 }
 throw new Error('Operação inválida.');
}catch(e){return Response.json({error:(e as Error).message},{status:400})}}
