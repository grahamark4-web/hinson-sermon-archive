const assert=require('node:assert/strict');const {parse,matches}=require('./search.js');
function sermon(ref){return {title:'Example',speaker:'Michael Lawrence',series:[],books:[],passages:[{reference:ref}]};}
assert(matches(sermon('Romans 8:18-39'),'Romans 8:28'));
assert(matches(sermon('Romans 8:18-39'),'rom 8'));
assert(!matches(sermon('Romans 8:18-39'),'Romans 8:17'));
assert(!matches(sermon('1 John 1:1-4'),'John 1:2'));
assert(matches(sermon('Matthew 24:36-25:30'),'Matthew 25:20'));
assert(matches(sermon('Psalm 32'),'Psalms 32:5'));
assert(matches(sermon('Leviticus 23:1-3,23-44'),'Leviticus 23:30'));
assert(!matches(sermon('Leviticus 23:1-3,23-44'),'Leviticus 23:12'));
assert(matches(sermon('Romans 8:1-5'),'Michael Lawrence'));
assert.equal(parse('1 Timothy 3').book,'1 Timothy');
assert(matches(sermon('Jude 20-25'),'Jude 1:22'));
assert(matches(sermon('3 John 9-10'),'3 John 1:9'));
assert(!matches(sermon('3 John 9-10'),'3 John 1:8'));
console.log('13 Scripture and speaker checks passed');

const {facets}=require('./search.js');
const rows=[
 {title:'Hope',books:['Romans'],speaker:'Alice',date:'2026-01-04',series:[],passages:[]},
 {title:'Grace',books:['Romans'],speaker:'Bob',date:'2025-01-05',series:[],passages:[]},
 {title:'Hope',books:['John'],speaker:'Bob',date:'2026-01-11',series:[],passages:[]}
];
assert.deepEqual(facets(rows,{book:'Romans'}).speaker,['Alice','Bob']);
assert.deepEqual(facets(rows,{book:'Romans',year:'2026'}).speaker,['Alice']);
assert.deepEqual(facets(rows,{speaker:'Bob',year:'2026'}).book,['John']);
assert.deepEqual(facets(rows,{book:'Romans',speaker:'Bob'}).year,['2025']);
assert.deepEqual(facets(rows,{book:'Romans',speaker:'Alice',year:'2026'}).year,['2026']);
assert.deepEqual(facets(rows,{query:'Hope',book:'Romans'}).speaker,['Alice']);
assert.deepEqual(facets(rows,{}).book,['Romans','John']);
assert.deepEqual(facets(rows,{}).year,['2026','2025']);
assert.deepEqual(facets(rows,{query:'No such sermon'}).speaker,[]);
console.log('9 cross-filter checks passed');

const {highlightRanges}=require('./search.js');
assert.deepEqual(highlightRanges('Grace and grace','GRACE'),[[0,5],[10,15]]);
assert.deepEqual(highlightRanges('Michael Lawrence','Michael Lawrence'),[[0,7],[8,16]]);
assert.deepEqual(highlightRanges('God’s Glory','God\'s'),[[0,5]]);
assert.deepEqual(highlightRanges('Résumé','resume'),[[0,6]]);
assert.deepEqual(highlightRanges('Romans 8:18-30','Romans 8:28',true),[[0,14]]);
assert.deepEqual(highlightRanges('Romans 8:1-17','Romans 8:28',true),[[0,6]]);
assert.deepEqual(highlightRanges('Example',''),[]);
assert.deepEqual(highlightRanges('a+b and [x]','a+b [x]'),[[0,3],[8,11]]);
console.log('8 search highlight checks passed');

const {seriesValues,filterMatches}=require('./search.js');
const seriesRows=[
 {title:'A',books:['Romans'],speaker:'Alice',date:'2026-01-04',series:['Grace'],passages:[]},
 {title:'B',books:['John'],speaker:'Bob',date:'2025-01-05',series:['Guest Preacher','Grace'],passages:[]},
 {title:'C',books:['Romans'],speaker:'Bob',date:'2025-01-12',series:[],passages:[]}
];
assert.deepEqual(seriesValues(seriesRows[2]),['Standalone (no series)']);
assert.deepEqual(facets(seriesRows,{book:'Romans',year:'2026'}).series,['Grace']);
assert.deepEqual(facets(seriesRows,{series:'Guest Preacher'}).speaker,['Bob']);
assert.deepEqual(facets(seriesRows,{series:'Standalone (no series)'}).book,['Romans']);
assert.deepEqual(facets(seriesRows,{series:'Grace'}).year,['2026','2025']);
assert(filterMatches(seriesRows[1],{series:'Guest Preacher'}));
assert(!filterMatches(seriesRows[0],{series:'Standalone (no series)'}));
assert(filterMatches(seriesRows[2],{series:'Standalone (no series)'}));
console.log('8 sermon series checks passed');

const S=require('./search.js');
const romansSermon={title:'Life in Christ',books:['Romans'],passages:[{reference:'Romans 8:1-11'}]};
const mentionsRomans={title:'Romans as an illustration',books:['Psalms'],passages:[{reference:'Psalm 62'}]};
assert.equal(S.scripturePriority(romansSermon,'Romans'),0);
assert.equal(S.scripturePriority(mentionsRomans,'Romans'),1);
assert.equal(S.scripturePriority(romansSermon,'rom.'),0);
assert.equal(S.scripturePriority(mentionsRomans,'ROMANS 8:28'),1);
assert.equal(S.scripturePriority(mentionsRomans,'anxiety'),0);
console.log('Bible book search priority checks passed');
