import { env } from 'cloudflare:workers';
import { parseLink } from '../../../lib/analyse';
export async function POST(req: Request) {
 try {
  if (Number(req.headers.get('content-length') || 0)>12000) return Response.json({error:'Request too large'},{status:413});
  const body=await req.json() as {url?:string}; const p=parseLink(body.url || ""); if(!p || !p.platform.startsWith('YouTube')) return Response.json({error:'Enter a valid YouTube video or Shorts URL.'},{status:400});
  const result:any={...p,fields:{},source:'Link only',notice:''};
  if(p.platform.startsWith('Instagram')) {result.notice='Instagram automatic import is not connected. Add the caption, comments and Insights below to analyse this post.'; return Response.json(result);}
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY || '';
  const get=async(url:string):Promise<any>=>{const r=await fetch(url,{signal:AbortSignal.timeout(10000)}); if(!r.ok) throw new Error('fetch');return r.json()};
  if(key){
   try {const data=await get('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id='+p.id+'&key='+encodeURIComponent(key));const v=data.items?.[0];if(!v) throw Error('missing');
    result.fields={title:v.snippet.title,caption:v.snippet.description,tags:(v.snippet.tags||[]).join(', '),duration:(()=>{const m=v.contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?String(Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0)):''})(),views:v.statistics.viewCount??'',likes:v.statistics.likeCount??'',comments:v.statistics.commentCount??''};result.author=v.snippet.channelTitle;result.source='YouTube Data API';result.thumbnail=v.snippet.thumbnails?.medium?.url;
    try{const c=await get('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=50&order=relevance&textFormat=plainText&videoId='+p.id+'&key='+encodeURIComponent(key));result.fields.commentText=c.items.map((x:any)=>x.snippet.topLevelComment.snippet.textDisplay.replace(/\n/g,' ')).join('\n');result.notice='Imported public counts and up to 50 relevance-ranked top-level comments. This sample is not representative of all viewers.';}catch{result.notice='Public metrics imported. Comments were unavailable or disabled.';}
   }catch{result.notice='YouTube API import failed. Check your key, API access or video visibility. You can still add data manually.';}
  }else{try{const o=await get('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(p.url));result.fields.title=o.title;result.author=o.author_name;result.thumbnail=o.thumbnail_url;result.source='YouTube oEmbed';}catch{}result.notice='Add a YouTube Data API key to import public counts and comments, or enter them below. Retention and watch-time metrics require creator analytics.';}
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Unable to read this request. Please try again.'},{status:400});}
}
