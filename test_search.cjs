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
