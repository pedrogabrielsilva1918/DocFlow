export type NoticeRequest={id:string;title:string;category:string;name?:string|null;email?:string|null;status:string;reason?:string|null};
export function emailNotice(request:NoticeRequest):string|null{
 if(!['Aprovado','Recusado'].includes(request.status))return null;
 const recipient=request.email?.trim();
 if(!recipient||!/^[-a-zA-Z0-9.!#$%&'*+/=?^_`{|}~]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(recipient))return null;
 const protocol='#'+request.id.slice(0,8).toUpperCase();
 const result=request.status==='Aprovado'?'aprovada':'recusada';
 const body=[`Olá${request.name?', '+request.name:''}!`,'',`Sua solicitação ${protocol} foi ${result}.`,'',`Solicitação: ${request.title}`,`Tipo: ${request.category}`,`Protocolo: ${protocol}`,`Resultado: ${request.status}`,...(request.reason?.trim()?['',`Observações da análise:\n${request.reason.trim()}`]:[]),'','Você pode consultar os detalhes acessando o DocFlow com a mesma conta usada no envio.','','Atenciosamente,','Equipe DocFlow'].join('\n');
 return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(`DocFlow | Solicitação ${protocol} ${result}`)}&body=${encodeURIComponent(body)}`;
}
