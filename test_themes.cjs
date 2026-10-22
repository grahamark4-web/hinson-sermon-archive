const assert=require('node:assert/strict'),fs=require('node:fs'),search=require('./search.js');
const catalog=JSON.parse(fs.readFileSync('sermons.json')).sermons, data=JSON.parse(fs.readFileSync('sermon-themes.json'));
const sermons=catalog.map(s=>({...s,themes:data.sermons[s.id].tags,themeTerms:data.sermons[s.id].tags.flatMap(t=>data.aliases[t]||[])}));
assert.equal(Object.keys(data.sermons).length,catalog.length);
for(const s of sermons){assert(s.themes.length>0&&s.themes.length<=6);for(const t of s.themes)assert(data.aliases[t]);}
const fixture={title:'An otherwise unrelated title',speaker:'Test Preacher',date:'2026-01-01',books:['Romans'],passages:[{reference:'Romans 8:18-39'}],series:[],themes:['anxiety'],themeTerms:data.aliases.anxiety};
assert(search.matches(fixture,'worry'));assert(search.matches(fixture,'anxiety'));assert(search.matches(fixture,'anxious'));assert(!search.matches(fixture,'marriage'));assert(search.matches(fixture,'Romans 8:28'));assert(!search.matches(fixture,'John 3:16'));assert(search.matches(fixture,'worry Test'));
assert.deepEqual(search.facets([fixture],{query:'worry'}).speaker,['Test Preacher']);assert(!search.filterMatches(fixture,{book:'John'}));
for(const q of ['anxiety','forgiveness','marriage','prayer','suffering','grief','parenting','money','resurrection']){const hits=sermons.filter(s=>search.matches(s,q));assert(hits.length>0,q);console.log(q+': '+hits.length);}
console.log('Every sermon tagged; theme synonyms, Scripture matching and cross-filtering passed.');
