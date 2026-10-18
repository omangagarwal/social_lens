import {aiReportSchema} from './ai-report';
import {ANALYSIS_MODEL} from './analysis-model';
import type {RulesEvaluation} from './shorts-rules';
type Context={rules?:RulesEvaluation,thumbnailReviewed:boolean};
export function upstreamError(status:number,code?:string,param?:string){
 if(status===401)return 'OpenAI rejected this API key. Check the key and its project.';
 if(status===403||status===404)return 'GPT-6 Luna is unavailable to this key. Check model permissions and project access.';
 if(status===429)return code==='insufficient_quota'?'OpenAI API credit or quota is exhausted. Check API billing; ChatGPT subscriptions do not fund API calls.':'OpenAI rate limit reached. Wait briefly before retrying.';
 if(code==='invalid_image_url'||code==='image_parse_error'||code==='invalid_image')return 'OpenAI could not read the YouTube thumbnail. Retry with the post link cleared after importing the data to analyse text only.';
 if(status===400)return 'OpenAI rejected the request configuration'+(param?' ('+param+')':'')+(code?' ['+code+']':'')+'. Share this error so the configuration can be corrected.';
 return 'OpenAI could not complete the request'+(code?' ['+code+']':'')+'. Retry once; if it repeats, share the diagnostic ID.';
}
function safeCode(value:unknown){return typeof value==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(value)?value:undefined;}
export function streamAnalysis(body:Record<string,unknown>,key:string,context:Context):Response{
 const encoder=new TextEncoder(),abort=new AbortController();let stopped=false;const started=Date.now(),diagnosticId=crypto.randomUUID();
 const stream=new ReadableStream<Uint8Array>({
  async start(controller){
   let timer:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,requestId:string|undefined,stage='Connecting to GPT-6 Luna';
   const send=(value:Record<string,unknown>)=>{if(stopped)return;try{controller.enqueue(encoder.encode(JSON.stringify({...value,diagnosticId,elapsedSeconds:Math.round((Date.now()-started)/1000)})+'\n'));}catch{stopped=true;abort.abort();}};
   const fail=(error:string,code:string)=>send({type:'error',error,code,requestId});
   try{
    send({type:'status',message:stage});
    timer=setInterval(()=>send({type:'status',message:stage,heartbeat:true}),10000);
    deadline=setTimeout(()=>abort.abort(),300000);
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({...body,stream:true}),signal:abort.signal});
    requestId=safeCode(r.headers.get('x-request-id'));
    if(!r.ok){let error:any={};try{error=(await r.json() as any).error||{}}catch{}fail(upstreamError(r.status,safeCode(error.code),safeCode(error.param)),'openai_'+r.status);return;}
    if(!r.body){fail('OpenAI returned no response stream. Please retry.','empty_stream');return;}
    stage='GPT-6 Luna is analysing the evidence';send({type:'status',message:stage,requestId});
    let buffer='',completed=false,terminalError=false;
    const handle=(block:string)=>{
     const data=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')return;
     let event:any;try{event=JSON.parse(data)}catch{throw new Error('Malformed OpenAI streaming event');}
     if(event.type==='response.output_text.delta'&&stage!=='Writing your report and next upload plan'){stage='Writing your report and next upload plan';send({type:'status',message:stage,requestId});}
     if(event.type==='error'||event.type==='response.failed'){terminalError=true;const e=event.error||event.response?.error||event;fail(upstreamError(502,safeCode(e.code)),safeCode(e.code)||'generation_failed');}
     if(event.type==='response.incomplete'){terminalError=true;const reason=event.response?.incomplete_details?.reason;fail(reason==='max_output_tokens'?'The model reached its output budget before finishing. Shorten the transcript/comment sample and retry.':'OpenAI stopped before completing the report. Retry with less input.','incomplete_response');}
     if(event.type==='response.completed'){
      const result=event.response;const messages=(result?.output||[]).filter((x:any)=>x.type==='message'||x.content);
      const texts=messages.map((x:any)=>(x.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text||'').join('')).reverse();
      let checked:ReturnType<typeof aiReportSchema.safeParse>|undefined;
      for(const text of texts){try{const candidate=aiReportSchema.safeParse(JSON.parse(text));if(candidate.success){checked=candidate;break;}}catch{}}
      if(!checked?.success){terminalError=true;const refused=messages.some((m:any)=>m.content?.some((c:any)=>c.type==='refusal'));fail(refused?'OpenAI declined to analyse this content. Try another post.':'OpenAI completed the request, but its report did not match the required format. Please retry.','report_format_invalid');return;}
      completed=true;send({type:'result',report:{...checked.data,model:result.model||ANALYSIS_MODEL,...(context.rules?{rules:context.rules}:{})},model:result.model||ANALYSIS_MODEL,thumbnailReviewed:context.thumbnailReviewed,requestId});
     }
    };
    const reader=r.body.getReader(),decoder=new TextDecoder();
    try{while(!completed&&!terminalError&&!stopped){const chunk=await reader.read();buffer+=decoder.decode(chunk.value||new Uint8Array(),{stream:!chunk.done});buffer=buffer.replace(/\r\n/g,'\n');if(buffer.length>2000000)throw Error('Response too large');let at;while((at=buffer.indexOf('\n\n'))!==-1){handle(buffer.slice(0,at));buffer=buffer.slice(at+2);if(completed||terminalError)break;}if(chunk.done){if(buffer.trim()&&!completed&&!terminalError)handle(buffer);break;}}}finally{await reader.cancel().catch(()=>{});}
    if(!completed&&!terminalError&&!stopped)fail('The connection to OpenAI ended before the report completed. Please retry.','stream_interrupted');
   }catch(e){if(!stopped)fail(abort.signal.aborted?'The analysis exceeded the five-minute limit. Shorten the transcript or comment sample and retry.':'The connection to OpenAI failed before the report completed. Retry once and share the diagnostic ID if it repeats.',abort.signal.aborted?'analysis_timeout':'connection_failed');}
   finally{if(timer)clearInterval(timer);if(deadline)clearTimeout(deadline);abort.abort();if(!stopped){stopped=true;try{controller.close()}catch{}}}
  },
  cancel(){stopped=true;abort.abort();}
 });
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-Analysis-ID':diagnosticId}});
}
