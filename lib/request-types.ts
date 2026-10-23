export type RequestType = {id:string;name:string;description:string;active:boolean;requirements:string[]};
export const DEFAULT_TYPES:RequestType[]=[
 {id:'envio-simples',name:'Envio simples',description:'Envie um documento para análise.',active:true,requirements:['Documento para análise']},
 {id:'atualizacao-cadastral',name:'Atualização cadastral',description:'Envie os comprovantes para atualizar seu cadastro.',active:true,requirements:['Documento de identificação','Comprovante de endereço']},
 {id:'analise-contratual',name:'Análise de contrato',description:'Encaminhe o contrato e os documentos relacionados.',active:true,requirements:['Contrato','Documento complementar']},
 {id:'cadastro-cliente',name:'Cadastro de cliente',description:'Encaminhe uma ficha com nome, e-mail, telefone e a finalidade do cadastro. Use a mensagem para acrescentar observações.',active:true,requirements:['Ficha de cadastro preenchida']},
 {id:'solicitacao-servico',name:'Solicitação de serviço',description:'Descreva o serviço desejado, o objetivo, o prazo esperado e as informações necessárias para avaliar o pedido.',active:true,requirements:['Descrição do serviço solicitado']},
 {id:'reembolso',name:'Reembolso',description:'Encaminhe os comprovantes da despesa e do pagamento. Informe na mensagem o motivo do pedido e o valor solicitado.',active:true,requirements:['Comprovante da despesa (nota fiscal ou recibo)','Comprovante de pagamento']}
];
export function validateType(input:unknown):RequestType {
 const t=input as RequestType;
 if(!t||typeof t.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(t.id))throw new Error('Tipo de solicitação inválido.');
 const name=typeof t.name==='string'?t.name.trim():'';
 const description=typeof t.description==='string'?t.description.trim():'';
 if(name.length<3||name.length>100||description.length>400||typeof t.active!=='boolean')throw new Error('Preencha o nome (3 a 100 caracteres) e uma descrição de até 400 caracteres.');
 if(!Array.isArray(t.requirements)||t.requirements.length<1||t.requirements.length>8)throw new Error('Informe de 1 a 8 documentos obrigatórios.');
 const requirements=t.requirements.map(v=>typeof v==='string'?v.trim():'');
 if(requirements.some(v=>!v||v.length>100)||new Set(requirements.map(v=>v.toLowerCase())).size!==requirements.length)throw new Error('Use nomes únicos para os documentos, com até 100 caracteres cada.');
 return {id:t.id,name,description,active:t.active,requirements};
}
export function validateFiles(type:RequestType,form:FormData):File[]{
 if(!type.active)throw new Error('Este tipo de solicitação foi desativado. Selecione outro tipo.');
 const files=type.requirements.map((label,i)=>{
 const f=form.get(`file:${i}`);
 if(!f||typeof f==='string'||!f.size)throw new Error(`Anexe o documento obrigatório: ${label}.`);
 if(f.size>10*1024*1024)throw new Error(`${label}: o limite é de 10 MB por arquivo.`);
 if(!['application/pdf','image/jpeg','image/png'].includes(f.type))throw new Error(`${label}: envie PDF, JPG ou PNG.`);
 return f;
 });
 if(files.reduce((sum,f)=>sum+f.size,0)>30*1024*1024)throw new Error('O total dos arquivos deve ser de até 30 MB.');
 return files;
}

export function mergeRequestTypes(saved:RequestType[]|null):RequestType[]{
 if(!saved)return DEFAULT_TYPES;
 return [...saved,...DEFAULT_TYPES.filter(t=>!saved.some(s=>s.id===t.id||s.name.toLowerCase()===t.name.toLowerCase()))];
}
