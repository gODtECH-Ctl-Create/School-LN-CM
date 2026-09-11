"use client";

import { useMemo, useState } from "react";
import { normalizeSection } from "@/src/lib/subject-catalog";
import styles from "./curriculum-builder.module.css";

type Subject={id:string;name:string;code:string|null;is_custom?:boolean};
type Curriculum={id:string;academic_session_id:string;term_id:string;class_id:string;subject_id:string;title:string;description:string|null;status:"draft"|"published"|"archived";week_count:number;topics_per_week:number};
type Unit={id:string;curriculum_id:string;title:string;unit_number:number};
type Topic={id:string;unit_id:string;title:string;summary:string|null;week_number:number|null;topic_number?:number;sort_order?:number};
export type CurriculumBuilderData={school:{id:string;name:string;code:string};sessions:{id:string;name:string;is_current:boolean}[];terms:{id:string;academic_session_id:string;name:string;term_number:number;starts_on:string;ends_on:string;is_current:boolean}[];classes:{id:string;name:string;level:string|null}[];subjects:Subject[];curricula:Curriculum[];units:Unit[];topics:Topic[]};
type Result=Partial<CurriculumBuilderData>&{error?:string;subject?:Subject};
type TopicDraft={id?:string;weekNumber:number;topicNumber:number;title:string};
const WEEKS=[9,10,11,12];
const TOPICS=[1,2,3,4];

function section(level:string|null){return normalizeSection(level)}
function placeholder(title:string,week:number,index:number){return !title.trim()||title.trim()===`Week ${week}`||title.trim()===`Week ${week} · Topic ${index}`}
function drafts(plan:Curriculum|undefined,data:CurriculumBuilderData,w=plan?.week_count??10,t=plan?.topics_per_week??1){
 if(!plan)return [];
 const units=new Set(data.units.filter(u=>u.curriculum_id===plan.id).map(u=>u.id));
 const rows=data.topics.filter(x=>units.has(x.unit_id)&&x.week_number!==null).sort((a,b)=>(a.week_number??0)-(b.week_number??0)||(a.topic_number??1)-(b.topic_number??1));
 return Array.from({length:w},(_,wi)=>Array.from({length:t},(_,ti)=>{const week=wi+1,n=ti+1;const hit=rows.find(x=>x.week_number===week&&(x.topic_number??1)===n)||(n===1?rows.find(x=>x.week_number===week):undefined);return{id:hit?.id,weekNumber:week,topicNumber:n,title:hit&&!placeholder(hit.title,week,n)?hit.title:""}})).flat();
}

export default function CurriculumBuilderV2({initialData}:{initialData:CurriculumBuilderData}){
 const [data,setData]=useState(initialData); const current=data.sessions.find(s=>s.is_current)||data.sessions[0];
 const initialTerm=data.terms.find(t=>t.academic_session_id===current?.id&&t.is_current)||data.terms.find(t=>t.academic_session_id===current?.id);
 const sections=useMemo(()=>[...new Set(data.classes.map(c=>section(c.level)))].sort(),[data.classes]);
 const [tab,setTab]=useState<"context"|"curriculum">("context"); const [sessionId,setSessionId]=useState(current?.id||""); const [termId,setTermId]=useState(initialTerm?.id||""); const [sectionId,setSectionId]=useState(sections[0]||"");
 const classes=useMemo(()=>data.classes.filter(c=>section(c.level)===sectionId),[data.classes,sectionId]); const [classId,setClassId]=useState(classes[0]?.id||"");
 const plans=useMemo(()=>data.curricula.filter(c=>c.academic_session_id===sessionId&&c.term_id===termId&&c.class_id===classId),[data.curricula,sessionId,termId,classId]);
 const existing=new Set(plans.map(p=>p.subject_id)); const subjects=useMemo(()=>[...data.subjects].sort((a,b)=>a.name.localeCompare(b.name)),[data.subjects]); const available=subjects.filter(s=>!existing.has(s.id));
 const [selected,setSelected]=useState<string[]>([]); const [activeId,setActiveId]=useState(plans[0]?.subject_id||""); const active=plans.find(p=>p.subject_id===activeId)||plans[0];
 const [weekCount,setWeekCount]=useState(active?.week_count||10); const [topicsPerWeek,setTopicsPerWeek]=useState(active?.topics_per_week||1); const [topicDrafts,setTopicDrafts]=useState<TopicDraft[]>(()=>drafts(active,initialData));
 const [custom,setCustom]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
 const name=(id:string)=>data.subjects.find(s=>s.id===id)?.name||"Subject";
 function openPlan(plan:Curriculum,source=data){setActiveId(plan.subject_id);setWeekCount(plan.week_count||10);setTopicsPerWeek(plan.topics_per_week||1);setTopicDrafts(drafts(plan,source));setTab("curriculum")}
 function resetContext(){setSelected([]);setActiveId("");setTopicDrafts([])}
 function sessionChange(id:string){setSessionId(id);const t=data.terms.find(x=>x.academic_session_id===id&&x.is_current)||data.terms.find(x=>x.academic_session_id===id);setTermId(t?.id||"");resetContext()}
 function termChange(id:string){setTermId(id);resetContext()}
 function sectionChange(id:string){setSectionId(id);const c=data.classes.find(x=>section(x.level)===id);setClassId(c?.id||"");resetContext()}
 function classChange(id:string){setClassId(id);const p=data.curricula.find(x=>x.academic_session_id===sessionId&&x.term_id===termId&&x.class_id===id);setSelected([]);if(p)openPlan(p);else resetContext()}
 async function post(action:string,payload:Record<string,unknown>){setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/admin/curriculum",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,schoolId:data.school.id,...payload})});const out=await r.json() as Result;if(!r.ok){setError(out.error||"Unable to update curriculum.");return null}setData(current=>({...current,...out,school:out.school??current.school,sessions:out.sessions??current.sessions,terms:out.terms??current.terms,classes:out.classes??current.classes,subjects:out.subjects??current.subjects,curricula:out.curricula??current.curricula,units:out.units??current.units,topics:out.topics??current.topics}));return out}catch{setError("We couldn't reach the curriculum service. Try again.");return null}finally{setBusy(false)}}
 async function createCurriculum(){if(!selected.length)return;const r=await post("create_curricula",{sessionId,termId,classId,subjectIds:selected});if(!r?.curricula)return;const ps=r.curricula.filter(c=>c.academic_session_id===sessionId&&c.term_id===termId&&c.class_id===classId);const p=ps.find(c=>selected.includes(c.subject_id))||ps[0];setSelected([]);if(p)openPlan(p,{...data,...r,school:r.school??data.school,sessions:r.sessions??data.sessions,terms:r.terms??data.terms,classes:r.classes??data.classes,subjects:r.subjects??data.subjects,curricula:r.curricula,units:r.units??data.units,topics:r.topics??data.topics});setMessage("Curriculum created. Configure each subject separately.")}
 async function addCustom(){const n=custom.trim();if(!n)return;const r=await post("create_subject",{subjectName:n});if(!r?.subject)return;setCustom("");setSelected(x=>[...x,r.subject!.id]);setMessage(`${r.subject.name} added to the subject list.`)}
 function resize(w:number,t:number){if(!active)return;const keep=new Map(topicDrafts.map(x=>[`${x.weekNumber}-${x.topicNumber}`,x]));setTopicDrafts(Array.from({length:w},(_,wi)=>Array.from({length:t},(_,ti)=>{const week=wi+1,n=ti+1;return keep.get(`${week}-${n}`)||{weekNumber:week,topicNumber:n,title:""}})).flat())}
 function setWeeks(n:number){setWeekCount(n);resize(n,topicsPerWeek)}
 function setTopics(n:number){setTopicsPerWeek(n);resize(weekCount,n)}
 async function save(){if(!active)return;const r=await post("save_weeks",{curriculumId:active.id,weekCount,topicsPerWeek,weeks:topicDrafts});if(!r?.curricula)return;const p=r.curricula.find(c=>c.id===active.id);if(p)openPlan(p,{...data,...r,school:r.school??data.school,sessions:r.sessions??data.sessions,terms:r.terms??data.terms,classes:r.classes??data.classes,subjects:r.subjects??data.subjects,curricula:r.curricula,units:r.units??data.units,topics:r.topics??data.topics});setMessage(`${name(active.subject_id)} curriculum saved.`)}
 const grouped=Array.from({length:weekCount},(_,wi)=>({week:wi+1,items:topicDrafts.filter(t=>t.weekNumber===wi+1)}));
 return <div className={styles.page}>
  <header className={styles.header}><div><p className="eyebrow">CURRICULUM</p><h1>Build the curriculum.</h1><p className="muted">Set the context first. Then build each subject week by week.</p></div><div className={styles.context}><span>{data.school.code}</span><strong>{data.sessions.find(s=>s.id===sessionId)?.name||"No session"}</strong><span>{data.terms.find(t=>t.id===termId)?.name||"No term"} · {data.classes.find(c=>c.id===classId)?.name||"No class"}</span></div></header>
  <div className={styles.tabBar} role="tablist"><button type="button" className={tab==="context"?styles.tabActive:styles.tab} onClick={()=>setTab("context")}><span>1</span> Context</button><button type="button" className={tab==="curriculum"?styles.tabActive:styles.tab} onClick={()=>setTab("curriculum")} disabled={!plans.length}><span>2</span> Curriculum</button></div>
  {error&&<div className={styles.alertError} role="alert">{error}</div>}{message&&<div className={styles.alertSuccess} role="status">{message}</div>}
  {tab==="context"?<>
   <section className={styles.contextCard}><div className={styles.sectionTop}><div><strong>Curriculum context</strong><span>These options come from Academic Setup.</span></div><span className={styles.currentBadge}>{current?.name||"No session"}</span></div><div className={styles.controls}>
    <label>Academic session<select value={sessionId} onChange={e=>sessionChange(e.target.value)}>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.name}{s.is_current?" · Current":""}</option>)}</select></label>
    <label>Term<select value={termId} onChange={e=>termChange(e.target.value)}>{data.terms.filter(t=>t.academic_session_id===sessionId).map(t=><option key={t.id} value={t.id}>{t.name}{t.is_current?" · Current":""}</option>)}</select></label>
    <label>Section<select value={sectionId} onChange={e=>sectionChange(e.target.value)}>{sections.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <label>Class<select value={classId} onChange={e=>classChange(e.target.value)}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   </div></section>
   <section className={styles.subjectCard}><div className={styles.sectionTop}><div><strong>Subjects</strong><span>Existing curriculum is shown above. Tick subjects that are still missing.</span></div><span className={styles.count}>{plans.length} ready</span></div>
    <div className={styles.existingList}>{plans.map(p=><button type="button" key={p.id} className={`${styles.subjectTab} ${styles.active}`} onClick={()=>openPlan(p)}><span>{name(p.subject_id)}</span><small>{p.week_count} weeks · {p.topics_per_week}/week</small></button>)}</div>
    <div className={styles.subjectGrid}>{available.map(s=><label key={s.id} className={styles.subjectOption}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>setSelected(x=>x.includes(s.id)?x.filter(id=>id!==s.id):[...x,s.id])}/><span><strong>{s.name}</strong><small>{s.is_custom?"Custom":s.code||"System"}</small></span></label>)}</div>
    <div className={styles.customRow}><div><strong>Custom subject</strong><span>Add one when the subject is not in the catalog.</span></div><div className={styles.addSubject}><input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="e.g. French"/><button type="button" className="btn btn-secondary" onClick={()=>void addCustom()} disabled={busy||!custom.trim()}>Add</button></div></div>
   </section>
   <section className={styles.weekSetup}><div className={styles.sectionTop}><div><strong>Create Curriculum</strong><span>Each selected subject becomes its own curriculum.</span></div><span className={styles.count}>{selected.length} selected</span></div><button type="button" className="btn btn-primary" onClick={()=>void createCurriculum()} disabled={busy||!sessionId||!termId||!classId||!selected.length}>Create Curriculum <span aria-hidden="true">→</span></button></section>
  </>:<section className={styles.editorCard}>
   {!active?<div className={styles.emptyEditor}><strong>Select a subject curriculum.</strong><span>Go back to Context and create one first.</span></div>:<>
    <div className={styles.editorHeader}><div><p className="eyebrow">SUBJECT CURRICULUM</p><h2>{name(active.subject_id)}</h2><p className="muted">{data.classes.find(c=>c.id===classId)?.name} · {data.terms.find(t=>t.id===termId)?.name}</p></div><span className={styles.currentBadge}>{weekCount} weeks · {topicsPerWeek}/week</span></div>
    <div className={styles.subjectSwitcher}>{plans.map(p=><button type="button" key={p.id} className={p.id===active.id?styles.switchActive:styles.switch} onClick={()=>openPlan(p)}>{name(p.subject_id)}</button>)}</div>
    <div className={styles.subjectSettings}><div className={styles.settingGroup}><strong>Weeks</strong><span>Choose the length for this subject.</span><div className={styles.settingChoices}>{WEEKS.map(n=><button type="button" key={n} className={weekCount===n?styles.settingChoiceActive:styles.settingChoice} onClick={()=>setWeeks(n)}>{n}<small>weeks</small></button>)}</div></div><div className={styles.settingGroup}><strong>Topics per week</strong><span>Choose how many topic slots every week has.</span><div className={styles.settingChoices}>{TOPICS.map(n=><button type="button" key={n} className={topicsPerWeek===n?styles.settingChoiceActive:styles.settingChoice} onClick={()=>setTopics(n)}>{n}<small>{n===1?"topic":"topics"}</small></button>)}</div></div></div>
    <div className={styles.weeklyTemplate}><div className={styles.sectionTop}><div><strong>Weekly topics</strong><span>One subject at a time. Enter the topic name in each empty slot.</span></div><span className={styles.count}>{weekCount*topicsPerWeek} slots</span></div><div className={styles.weeks}>{grouped.map(g=><article key={g.week} className={styles.weekBlock}><div className={styles.weekHeading}><span className={styles.weekNumber}>W{g.week}</span><div><strong>Week {g.week}</strong><small>{topicsPerWeek} topic{topicsPerWeek===1?"":"s"}</small></div></div><div className={styles.topicList}>{g.items.map(t=><label key={`${t.weekNumber}-${t.topicNumber}`} className={styles.topicField}><span>Topic {t.topicNumber}</span><input value={t.title} onChange={e=>setTopicDrafts(x=>x.map(v=>v.weekNumber===t.weekNumber&&v.topicNumber===t.topicNumber?{...v,title:e.target.value}:v))} placeholder={`Enter Week ${t.weekNumber} topic ${t.topicNumber}`}/></label>)}</div></article>)}</div></div>
    <div className={styles.saveBar}><span>{name(active.subject_id)} · {weekCount} weeks · {topicsPerWeek} topic{topicsPerWeek===1?"":"s"}/week</span><button type="button" className="btn btn-primary" onClick={()=>void save()} disabled={busy}>{busy?"Saving…":"Save curriculum"}</button></div>
   </>}
  </section>}
 </div>
}
