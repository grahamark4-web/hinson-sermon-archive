"""Build reviewable thematic metadata without enabling public transcript search."""
import collections,json,pathlib,re,unicodedata
ROOT=pathlib.Path(__file__).parent
# Labels and related search expressions. Whole words prevent accidental substring matches.
TOPICS={
'anxiety':['anxiety','anxious','worry','worried'],
'peace':['peace','rest','restless'],
'suffering':['suffering','suffer','pain','affliction','hardship','trials'],
'grief':['grief','grieving','mourning','sorrow','lament'],
'hope':['hope','hopeless','despair'],
'prayer':['prayer','pray','praying','intercession'],
'faith':['faith','trust','believe','belief','unbelief','doubt'],
'repentance':['repentance','repent','turn from sin'],
'forgiveness':['forgiveness','forgive','forgiven','reconciliation','reconcile'],
'grace':['grace','undeserved','unmerited'],
'salvation':['salvation','saved','save sinners','born again','new birth','regeneration'],
'justification':['justification','justified','righteousness by faith'],
'sanctification':['sanctification','sanctified','spiritual growth','grow in holiness'],
'sin and temptation':['sin','sins','sinner','sinful','temptation','tempted'],
'holiness':['holiness','holy living','purity','pure','righteous living'],
'obedience':['obedience','obey','obedient','disobedience'],
'love':['love','loving','loved'],
'humility':['humility','humble','pride','proud'],
'wisdom':['wisdom','wise','fool','foolish'],
'anger':['anger','angry','wrath','bitterness'],
'joy':['joy','rejoice','rejoicing'],
'gratitude':['gratitude','grateful','thankful','thanksgiving'],
'contentment':['contentment','content','covet','covetous','greed'],
'money and generosity':['money','wealth','riches','generosity','generous','giving','possessions','stewardship'],
'marriage':['marriage','married','husband','wife','divorce'],
'parenting and family':['parenting','parents','parent','fatherhood','motherhood','family','families','raising children'],
'friendship':['friendship','hospitality'],
'church':['church','congregation','body of christ','membership'],
'unity':['unity','united','division','divisions'],
'leadership':['leadership','leaders','leader','elder','elders','pastor','pastors','deacon','deacons'],
'service':['service','serve','serving','servant','spiritual gifts'],
'worship':['worship','praise','adoration'],
'evangelism and missions':['evangelism','evangelize','missions','missionary','missionaries','share the gospel','proclaim the gospel','great commission'],
'discipleship':['discipleship','disciple','disciples','follow jesus','following jesus'],
'perseverance':['perseverance','persevere','endurance','endure','steadfast','faithfulness'],
'persecution':['persecution','persecuted','persecute'],
'justice and mercy':['justice','injustice','oppression','oppressed','mercy','merciful','compassion'],
"God's sovereignty and providence":['sovereignty','sovereign','providence','providential','god is in control'],
"God's faithfulness":['god is faithful',"god's faithfulness",'faithful god','god keeps his promises'],
'covenant':['covenant','covenants','new covenant','old covenant'],
'Jesus Christ':['jesus','christ','messiah','son of god'],
'cross and atonement':['cross','crucifixion','crucified','atonement','atoning','blood of christ','died for our sins'],
'resurrection':['resurrection','risen','raised from the dead','rise from the dead'],
'Holy Spirit':['holy spirit','spirit of god','spirit of christ'],
'Scripture':['scripture','scriptures','bible',"god's word",'word of god'],
'creation':['creation','creator','created','image of god'],
'judgment':['judgment','judgement','condemnation','hell'],
'eternal life and heaven':['eternal life','heaven','new creation','new heavens','new earth'],
'return of Christ':['second coming','return of christ','jesus returns','christ returns','day of the lord','last days'],
'kingdom of God':['kingdom of god','kingdom of heaven','king jesus','kingship'],
'baptism':['baptism','baptize','baptized'],
"Lord's Supper":["lord's supper",'communion','bread and wine'],
'work':['workplace','vocation','employment','labor','labour'],
'speech':['gossip','slander','tongue','lying','truthfulness'],
}
def norm(s):
 return unicodedata.normalize('NFKD',s).lower().replace('’',"'")
def pattern(words):return re.compile(r'(?<!\w)(?:'+ '|'.join(re.escape(norm(x)) for x in sorted(words,key=len,reverse=True))+r')(?!\w)')
PATTERNS={k:pattern([k]+v) for k,v in TOPICS.items()}
# Broad contextual fallback only, explicitly recorded for later editorial review.
BOOK_THEMES={
'Genesis':['creation','covenant'],'Exodus':['salvation','covenant'],'Leviticus':['holiness','worship'],'Numbers':['faith','obedience'],'Deuteronomy':['covenant','obedience'],'Joshua':["God's faithfulness",'faith'],'Judges':['sin and temptation','salvation'],'Ruth':["God's sovereignty and providence",'hope'],'1 Samuel':['leadership','faith'],'2 Samuel':['covenant','leadership'],'1 Kings':['leadership','worship'],'2 Kings':['judgment','covenant'],'1 Chronicles':['worship','covenant'],'2 Chronicles':['worship','repentance'],'Ezra':['worship','holiness'],'Nehemiah':['leadership','prayer'],'Esther':["God's sovereignty and providence",'faith'],'Job':['suffering',"God's sovereignty and providence"],'Psalms':['prayer','worship'],'Proverbs':['wisdom','holiness'],'Ecclesiastes':['wisdom','work'],'Song of Solomon':['love','marriage'],'Isaiah':['salvation','hope'],'Jeremiah':['judgment','covenant'],'Lamentations':['grief','hope'],'Ezekiel':['judgment','hope'],'Daniel':["God's sovereignty and providence",'faith'],'Hosea':['covenant','repentance'],'Joel':['repentance','judgment'],'Amos':['justice and mercy','judgment'],'Obadiah':['judgment','humility'],'Jonah':['justice and mercy','repentance'],'Micah':['justice and mercy','hope'],'Nahum':['judgment','justice and mercy'],'Habakkuk':['faith','suffering'],'Zephaniah':['judgment','hope'],'Haggai':['worship','obedience'],'Zechariah':['hope','kingdom of God'],'Malachi':['covenant','worship'],'Matthew':['Jesus Christ','kingdom of God'],'Mark':['Jesus Christ','discipleship'],'Luke':['Jesus Christ','salvation'],'John':['Jesus Christ','faith'],'Acts':['evangelism and missions','Holy Spirit'],'Romans':['salvation','faith'],'1 Corinthians':['church','holiness'],'2 Corinthians':['church','suffering'],'Galatians':['grace','faith'],'Ephesians':['church','unity'],'Philippians':['joy','perseverance'],'Colossians':['Jesus Christ','discipleship'],'1 Thessalonians':['perseverance','return of Christ'],'2 Thessalonians':['perseverance','return of Christ'],'1 Timothy':['church','leadership'],'2 Timothy':['perseverance','Scripture'],'Titus':['leadership','holiness'],'Philemon':['forgiveness','love'],'Hebrews':['Jesus Christ','perseverance'],'James':['faith','wisdom'],'1 Peter':['suffering','hope'],'2 Peter':['holiness','return of Christ'],'1 John':['love','faith'],'2 John':['love','obedience'],'3 John':['friendship','church'],'Jude':['perseverance','faith'],'Revelation':['hope','return of Christ']}
def build():
 catalog=json.loads((ROOT/'sermons.json').read_text());out={};counts=collections.Counter();fallback=[]
 for s in catalog['sermons']:
  title=norm(s['title']);series=norm(' '.join(s.get('series',[])));segments=[]
  p=ROOT/'transcripts'/f"{s['id']}.json"
  if p.exists():
   t=json.loads(p.read_text())
   if t.get('sourceAudio')==s.get('audio'):segments=[norm(x['text']) for x in t.get('segments',[])]
  text=' '.join(segments);scores={};evidence={}
  for topic,pat in PATTERNS.items():
   tc=len(pat.findall(title));sc=len(pat.findall(series));hits=len(pat.findall(text))
   # Repeated discussion, not a single passing mention, earns a transcript tag.
   spread=sum(bool(pat.search(' '.join(segments[i:i+30]))) for i in range(0,len(segments),30))
   if tc or sc or (hits>=8 and spread>=3):
    scores[topic]=tc*30+sc*8+min(hits,60)/3+spread
    evidence[topic]={'title':bool(tc),'series':bool(sc),'transcriptMentions':hits,'transcriptSections':spread}
  chosen=sorted(scores,key=lambda k:(-scores[k],k))[:6];source='transcript' if segments else 'metadata'
  if not chosen:
   chosen=list(dict.fromkeys(t for b in s.get('books',[]) for t in BOOK_THEMES.get(b,[])))[:2]
   source='scripture-context';fallback.append(s['id'])
  if not chosen:raise ValueError('No thematic evidence for '+s['id'])
  out[s['id']]={'tags':chosen,'source':source}
  counts[source]+=1
 result={'version':1,'method':'Automatic topic detection; Scripture-context fallbacks need editorial review.','aliases':TOPICS,'sermons':out}
 (ROOT/'sermon-themes.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
 report={'sermons':len(out),'coverage':dict(counts),'scriptureContextReview':fallback,'topicCounts':dict(collections.Counter(t for v in out.values() for t in v['tags']).most_common())}
 (ROOT/'theme-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2)[:2500])
if __name__=='__main__':build()
