export type ReportFilters={from:string;to:string;status:string;category:string;q:string};
export type ReportRow={id:string;title:string;category:string;name?:string|null;email?:string|null;status:string;revision:number;created:string;updated:string};
export function reportDay(value:string):string {
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function reportFilters(params:URLSearchParams):ReportFilters {
 const get=(key:string)=>params.get(key)?.trim()||'';
 const f={from:get('from'),to:get('to'),status:get('status'),category:get('category'),q:get('q')};
 for(const date of [f.from,f.to]){
  if(!date)continue;
  const parsed=new Date(date+'T12:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw new Error('Informe datas válidas para o período.');
 }
 if(f.from&&f.to&&f.from>f.to)throw new Error('A data inicial deve ser anterior ou igual à data final.');
 if(f.status&&!['Em análise','Aprovado','Recusado'].includes(f.status))throw new Error('Status inválido.');
 if(f.category.length>100||f.q.length>160)throw new Error('O filtro informado é muito longo.');
 return f;
}
export function filterReport<T extends ReportRow>(rows:T[],filters:ReportFilters):T[]{
 const q=filters.q.replace(/^#/,'').toLocaleLowerCase('pt-BR');
 return rows.filter(row=>{
  const day=reportDay(row.created);
  return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to)&&(!filters.status||row.status===filters.status)&&(!filters.category||row.category===filters.category)&&(!q||`${row.id} ${row.title} ${row.name||''} ${row.email||''}`.toLocaleLowerCase('pt-BR').includes(q));
 });
}
function csvCell(value:unknown):string {
 let text=String(value??'');
 if(/^[\s\x00-\x1f]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function reportCsv(rows:ReportRow[]):string {
 const format=(date:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(date));
 const headers=['Protocolo','Identificador','Solicitação','Tipo','Solicitante','E-mail','Status','Versão','Envio original (Brasília)','Última atualização (Brasília)'];
 const records=rows.map(r=>['#'+r.id.slice(0,8).toUpperCase(),r.id,r.title,r.category,r.name,r.email,r.status,r.revision||1,format(r.created),format(r.updated)]);
 return '\uFEFF'+[headers,...records].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
