import {Download,Clock} from 'lucide-react';
type Event={id:string;revision:number;action:string;status:string;reason:string;message:string;created:string;actor:string;attachments:{id:string;filename:string;label:string}[]};
export default function RequestHistory({events}:{events:Event[]}){
 if(!events.length)return null;
 const names:Record<string,string>={upload:'Solicitação enviada',review:'Análise registrada',resubmit:'Correção reenviada',previous:'Situação anterior registrada'};
 return <section className="request-history"><h3><Clock size={17}/>Histórico da solicitação</h3><ol>{[...events].reverse().map(e=><li key={e.id}><div className="history-top"><strong>{names[e.action]||e.action}</strong><span className="status">{e.status}</span></div><p className="muted small">Versão {e.revision} · {e.actor} · {new Date(e.created).toLocaleString('pt-BR')}</p>{e.reason&&<p className="history-note"><strong>Observação:</strong> {e.reason}</p>}{e.message&&<p className="history-note"><strong>Mensagem do solicitante:</strong> {e.message}</p>}<details><summary>Arquivos desta versão ({e.attachments.length})</summary>{e.attachments.map(a=><a key={a.id} className="history-file" href={'/api/portal?file='+a.id}><Download size={14}/><span>{a.label} · {a.filename}</span></a>)}</details></li>)}</ol></section>;
}
