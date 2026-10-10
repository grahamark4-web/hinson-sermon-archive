/* Scripture queries match overlapping ranges, rather than title substrings. */
(function(root){
const books='Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|');
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const aliases={'psalm':'Psalms','ps':'Psalms','song of songs':'Song of Solomon','gen':'Genesis','ex':'Exodus','matt':'Matthew','mt':'Matthew','rom':'Romans','jn':'John','rev':'Revelation','1 tim':'1 Timothy','2 tim':'2 Timothy','1 cor':'1 Corinthians','2 cor':'2 Corinthians'};
for(const b of books)aliases[norm(b)]=b;
const names=Object.keys(aliases).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
function parse(s){
 const m=norm(s).replace(/–|—/g,'-').match(new RegExp('^('+names+')\\.?\\s+(\\d+(?:\\s*:\\s*\\d+)?(?:\\s*-\\s*\\d+(?:\\s*:\\s*\\d+)?)?(?:\\s*,\\s*\\d+(?:\\s*-\\s*\\d+)?)*)$'));
 if(!m)return null;
 const parts=m[2].replace(/\s/g,'').split(',');const singleChapter=['Obadiah','Philemon','2 John','3 John','Jude'].includes(aliases[m[1]]);let chapter=singleChapter?1:undefined;
 const ranges=parts.map((part,i)=>{
  let [a,b]=part.split('-');const verseMode=a.includes(':')||singleChapter||(i>0&&chapter!==undefined);
  let start,end;
  if(a.includes(':')){const [c,v]=a.split(':').map(Number);chapter=c;start=c*1000+v;}
  else if(verseMode)start=chapter*1000+Number(a);else start=Number(a)*1000;
  if(!b)end=verseMode?start:start+999;
  else if(b.includes(':')){const [c,v]=b.split(':').map(Number);end=c*1000+v;}
  else end=verseMode?chapter*1000+Number(b):Number(b)*1000+999;
  return [start,end];
 });return {book:aliases[m[1]],ranges};
}
function matches(sermon,q){
 if(!q.trim())return true;
 const query=parse(q);
 if(query)return (sermon.passages||[]).some(p=>{const r=parse(p.reference);return r&&r.book===query.book&&r.ranges.some(a=>query.ranges.some(b=>a[0]<=b[1]&&b[0]<=a[1]));});
 const hay=norm([sermon.title,sermon.speaker,...(sermon.series||[]),...(sermon.books||[]),...(sermon.passages||[]).map(p=>p.reference)].join(' '));
 return norm(q).split(' ').every(word=>hay.includes(word));
}
const oneOff='Standalone (no series)';
function seriesValues(sermon){return sermon.series&&sermon.series.length?sermon.series:[oneOff];}
function filterMatches(sermon,selection,except){
 return (except==='book'||!selection.book||(sermon.books||[]).includes(selection.book))&&
 (except==='speaker'||!selection.speaker||sermon.speaker===selection.speaker)&&
 (except==='year'||!selection.year||sermon.date.startsWith(selection.year))&&
 (except==='series'||!selection.series||seriesValues(sermon).includes(selection.series));
}
function facets(sermons,selection,matcher=matches){
 const searched=sermons.filter(s=>matcher(s,selection.query||''));
 const bookRows=searched.filter(s=>filterMatches(s,selection,'book'));
 const speakerRows=searched.filter(s=>filterMatches(s,selection,'speaker'));
 const yearRows=searched.filter(s=>filterMatches(s,selection,'year'));
 const seriesRows=searched.filter(s=>filterMatches(s,selection,'series'));
 return {
 book:books.filter(b=>bookRows.some(s=>(s.books||[]).includes(b))).reverse(),
 speaker:[...new Set(speakerRows.map(s=>s.speaker).filter(Boolean))].sort(),
 year:[...new Set(yearRows.map(s=>s.date.slice(0,4)))].sort().reverse(),
 series:[...new Set(seriesRows.flatMap(seriesValues))].sort((a,b)=>a.localeCompare(b))
 };
}
function highlightRanges(text,q,reference=false){
 const query=parse(q),passage=reference?parse(text):null;
 if(query&&passage&&query.book===passage.book&&passage.ranges.some(a=>query.ranges.some(b=>a[0]<=b[1]&&b[0]<=a[1])))return [[0,text.length]];
 if(!q.trim())return [];
 let normalized='',positions=[];
 for(let i=0;i<text.length;){const char=String.fromCodePoint(text.codePointAt(i)),part=char.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'");for(const c of part){normalized+=c;positions.push([i,i+char.length]);}i+=char.length;}
 const ranges=[];
 for(const term of [...new Set(norm(q).split(' ').filter(Boolean))]){
  let start=0,index;
  while((index=normalized.indexOf(term,start))!==-1){ranges.push([positions[index][0],positions[index+term.length-1][1]]);start=index+term.length;}
 }
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const r of ranges){const last=merged[merged.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r);}
 return merged;
}
function scripturePriority(sermon,q){
 const book=parse(q)?.book||aliases[norm(q).replace(/\.$/,'')];
 if(!book)return 0;
 return (sermon.books||[]).includes(book)||(sermon.passages||[]).some(p=>parse(p.reference)?.book===book)?0:1;
}
const api={books,norm,parse,matches,filterMatches,facets,highlightRanges,seriesValues,scripturePriority};if(typeof module!=='undefined')module.exports=api;else root.SermonSearch=api;
})(typeof window!=='undefined'?window:globalThis);
