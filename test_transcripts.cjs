const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
(async()=>{
 const {searchTranscripts,bucket,queryGroups}=await import('./transcript_search.mjs');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hinson-transcript-test-'));
 try{
  fs.mkdirSync(path.join(temp,'transcripts'));
  const sermon={id:'test',audio:'https://example.com/audio.mp3',date:'2026-10-04'};
  fs.writeFileSync(path.join(temp,'sermons.json'),JSON.stringify({sermons:[sermon]}));
  fs.writeFileSync(path.join(temp,'transcripts/test.json'),JSON.stringify({sourceAudio:sermon.audio,model:'small.en',segments:[{start:41.5,end:50,text:'We can bring our worry to God.'},{start:50,end:65,text:'Prayer is an expression of dependence.'},{start:90,end:105,text:'Forgiveness means learning to forgive.'}]}));
  execFileSync('python',['-c',`import transcripts\nfrom pathlib import Path\ntranscripts.ROOT=Path(${JSON.stringify(temp)})\ntranscripts.build()`]);
  const env={ASSETS:{fetch:async(request)=>{const filename=path.join(temp,new URL(request.url).pathname);return fs.existsSync(filename)?new Response(fs.readFileSync(filename)):new Response('',{status:404});}}};
  const search=async(q)=>{const r=await searchTranscripts(new Request('https://example.com/api/transcript-search?q='+encodeURIComponent(q)),env);assert.equal(r.status,200);return r.json();};
  let result=await search('worry');assert.equal(result.coverage,1);assert.equal(result.matches.test.excerpts[0].start,41.5);assert.match(result.matches.test.excerpts[0].text,/worry/);
  assert.ok((await search('God. Prayer')).matches.test,'unquoted phrase spans adjacent segments');
  assert.deepEqual((await search('God Prayer')).matches,(await search('"God Prayer"')).matches,'quotes are optional');
  assert.deepEqual((await search('worry God')).matches,{},'words must be consecutive');
  assert.deepEqual((await search('God worry')).matches,{},'word order matters');
  assert.deepEqual((await search('anxiety')).matches,{},'no synonym expansion');
  assert.deepEqual((await search('pray')).matches,{},'no partial-word matches');
  assert.ok((await search('prayer')).matches.test,'exact whole word matches');
  assert.ok((await search('is an')).matches.test,'common words remain part of the phrase');
  assert.deepEqual((await search('"Prayer is absent"')).matches,{});
  assert.ok((await search('forgiveness')).matches.test);
  assert.deepEqual((await search('leadership')).matches,{});
  assert.equal(queryGroups('"worry to God"').quoted,true);
  assert.equal((await searchTranscripts(new Request('https://example.com/api/transcript-search?q='+'x'.repeat(201)),env)).status,400);
  const Search=require('./search.js');const s={...sermon,speaker:'Test Preacher',books:['Romans'],passages:[],series:['Test Series'],title:'Unrelated title'};
  const facets=Search.facets([s],{query:'anxiety'},row=>row.id==='test');assert.deepEqual(facets.speaker,['Test Preacher']);assert.deepEqual(facets.book,['Romans']);
  // Changed recordings must not reuse a transcript from the previous audio source.
  sermon.audio='https://example.com/replacement.mp3';fs.writeFileSync(path.join(temp,'sermons.json'),JSON.stringify({sermons:[sermon]}));
  execFileSync('python',['-c',`import transcripts\nfrom pathlib import Path\ntranscripts.ROOT=Path(${JSON.stringify(temp)})\ntranscripts.build()`]);
  assert.equal((await search('anxiety')).coverage,0);
  console.log('Transcript index, exact words and phrases, timestamps, facets and changed-audio checks passed');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
