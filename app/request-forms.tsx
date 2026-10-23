'use client';
import {useState} from 'react';
import {Upload,CheckCircle2,FileText} from 'lucide-react';
import type {RequestType} from '../lib/request-types';
export function RequestUpload({types,onSubmit,busy,resubmission}:{types:RequestType[];onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void;busy:boolean;resubmission?:{id:string;version:number;title:string;category:string;requirements:string[];message:string;reason:string}}){
 const active=resubmission?[{id:'resubmit',name:resubmission.category,description:'Anexe novamente todos os documentos abaixo com as correções solicitadas.',active:true,requirements:resubmission.requirements.length?resubmission.requirements:['Documento para análise']}]:types.filter(t=>t.active);const [typeId,setTypeId]=useState(active[0]?.id||'');const [chosen,setChosen]=useState<Record<number,string>>({});
 const type=active.find(t=>t.id===typeId);
 return <><span className="modal-icon"><Upload/></span><h2>{resubmission?'Corrigir e reenviar':'Nova solicitação'}</h2><p className="muted">{resubmission?'O protocolo será mantido. Os arquivos e as análises anteriores continuarão no histórico.':'Escolha o tipo e anexe todos os documentos obrigatórios. Você receberá um protocolo único para acompanhar a análise.'}</p>{resubmission&&<div className="detail-note"><strong>Motivo da recusa:</strong><p>{resubmission.reason}</p></div>}
 {!active.length?<div className="detail-note">Nenhum tipo de solicitação disponível. Aguarde a configuração pelo administrador.</div>:<form onSubmit={onSubmit}>
 {resubmission?<><input type="hidden" name="id" value={resubmission.id}/><input type="hidden" name="version" value={resubmission.version}/><p className="muted">{resubmission.category} · #{resubmission.id.slice(0,8).toUpperCase()}</p></>:<label>Tipo de solicitação<select name="requestType" value={typeId} onChange={e=>{setTypeId(e.target.value);setChosen({})}} required>{active.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
 {type&&<><input type="hidden" name="requirementsVersion" value={JSON.stringify(type.requirements)}/>{type.description&&<p className="type-description">{type.description}</p>}
 <label>Título da solicitação<input name="title" defaultValue={resubmission?.title||''} required maxLength={160} placeholder="Ex.: Atualização do meu cadastro"/></label>
 <div className="checklist-heading"><strong>Documentos obrigatórios</strong><span>{Object.keys(chosen).length} de {type.requirements.length} anexados</span></div>
 <div className="required-files" key={type.id}>{type.requirements.map((label,i)=><label className={'required-file '+(chosen[i]?'attached':'')} key={i}><div><span>{chosen[i]?<CheckCircle2 size={19}/>:<FileText size={19}/>}</span><strong>{label} <em>*</em></strong></div><span className="muted small">PDF, JPG ou PNG · até 10 MB</span><input type="file" name={'file:'+i} accept="application/pdf,image/jpeg,image/png" required onChange={e=>setChosen(prev=>{const n={...prev};if(e.target.files?.[0])n[i]=e.target.files[0].name;else delete n[i];return n})}/></label>)}</div>
 <p className="muted small">Limite total de 30 MB por solicitação. Confira os arquivos antes de enviar.</p>
 <label>Mensagem (opcional)<textarea name="message" defaultValue={resubmission?.message||''} maxLength={2000} placeholder="Acrescente informações para a análise..."/></label>
 <button className="primary" disabled={busy||Object.keys(chosen).length!==type.requirements.length}>{busy?'Enviando...':resubmission?'Reenviar para análise':'Enviar solicitação'}</button></>}
 </form>}</>;
}
export function TypeEditor({type,onSubmit,busy}:{type:RequestType|null;onSubmit:(e:React.FormEvent<HTMLFormElement>)=>void;busy:boolean}){
 return <><span className="modal-icon"><FileText/></span><h2>{type?'Editar tipo de solicitação':'Novo tipo de solicitação'}</h2><p className="muted">Defina quais documentos o solicitante precisa anexar. Alterações valem apenas para novos envios.</p><form onSubmit={onSubmit}>
 <input type="hidden" name="id" value={type?.id||''}/><label>Nome do tipo<input name="name" required minLength={3} maxLength={100} defaultValue={type?.name||''} placeholder="Ex.: Solicitação de reembolso"/></label>
 <label>Descrição (opcional)<textarea name="description" maxLength={400} defaultValue={type?.description||''} placeholder="Explique quando usar este tipo de solicitação."/></label>
 <label>Documentos obrigatórios — um por linha<textarea className="requirements-input" name="requirements" required defaultValue={type?.requirements.join('\n')||''} placeholder={'Formulário preenchido\nComprovante do pagamento'}/><span className="muted small">De 1 a 8 documentos, com nomes únicos de até 100 caracteres.</span></label>
 <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={type?.active??true}/><span>Disponível para novos envios</span></label>
 <button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar tipo de solicitação'}</button></form></>;
}
