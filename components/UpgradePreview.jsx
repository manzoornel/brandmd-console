"use client";

import { useMemo, useState } from "react";
import styles from "./UpgradePreview.module.css";
import { staffVideoUnitsFromSeconds, videoUnitsFromSeconds } from "@/lib/operations";

const workers = [
  { name: "Mufeed", role: "Video Editor", present: 25, units: 57.5, posts: 0, creatives: 0, salary: 20000, incentive: 3000, status: "On target" },
  { name: "Shamil", role: "Content & Posting", present: 24, units: 3, posts: 64, creatives: 23, salary: 10000, incentive: 2500, status: "Above target" },
];

export default function UpgradePreview() {
  const [tab, setTab] = useState("Dashboard");
  const [minutes, setMinutes] = useState("4.5");
  const seconds = Math.round((Number(minutes) || 0) * 60);
  const clientUnits = videoUnitsFromSeconds(seconds);
  const staffUnits = staffVideoUnitsFromSeconds(seconds);
  const clientCharge = clientUnits * 1500;
  const tabs = ["Dashboard", "Video units", "Attendance", "Payroll", "Reports"];

  return <div className={styles.shell}>
    <aside className={styles.side}>
      <div className={styles.brand}><span>BM</span><div><b>Brand MD</b><small>Solutions</small></div></div>
      <nav>{tabs.map(t => <button key={t} className={tab === t ? styles.active : ""} onClick={() => setTab(t)}><i>{icon(t)}</i>{t}</button>)}</nav>
      <div className={styles.live}><span /> Upgrade preview</div>
    </aside>
    <main className={styles.main}>
      <header><div><p>BRANDMD OPERATIONS</p><h1>{tab}</h1></div><div className={styles.person}><span>9:30 AM–5:00 PM</span><b>Dr. Manzoor</b><i>M</i></div></header>
      <div className={styles.notice}><b>Interactive preview</b><span>This page uses demonstration data. Production and staff records are unchanged.</span></div>
      {tab === "Dashboard" && <Dashboard setTab={setTab} />}
      {tab === "Video units" && <VideoUnits minutes={minutes} setMinutes={setMinutes} clientUnits={clientUnits} staffUnits={staffUnits} clientCharge={clientCharge} />}
      {tab === "Attendance" && <Attendance />}
      {tab === "Payroll" && <Payroll />}
      {tab === "Reports" && <Reports />}
    </main>
  </div>;
}

function Dashboard({ setTab }) {
  return <>
    <section className={styles.kpis}>
      <Kpi value="57.5" label="Staff video units" note="Mufeed · this month" color="violet" />
      <Kpi value="64" label="Video posts" note="4 above bonus level" color="green" />
      <Kpi value="23" label="Creatives" note="3 incentive creatives" color="orange" />
      <Kpi value="96%" label="Attendance" note="1 compensated leave" color="blue" />
    </section>
    <section className={styles.two}>
      <div className={styles.card}><Title title="Today’s operations" sub="Live workflow checks" />
        {[['Mufeed','Long video edit · 8:20','2 staff units','In progress'],['Shamil','Dr. Manzoor · Episode 31','YouTube + IG + FB','Ready to post'],['Shamil','World Heart Day creative','Creative #21','Completed']].map((r,i)=><div className={styles.task} key={i}><span>{r[0][0]}</span><div><b>{r[0]}</b><p>{r[1]}</p></div><small>{r[2]}</small><em>{r[3]}</em></div>)}
      </div>
      <div className={styles.card}><Title title="Needs attention" sub="Automatic operational alerts" />
        <Alert tone="red" title="2 overdue assignments" text="Due dates passed without submission" />
        <Alert tone="amber" title="1 posting package incomplete" text="Pinned comment is missing" />
        <Alert tone="green" title="Sunday duty credit approved" text="Available for leave or carry forward" />
      </div>
    </section>
    <section className={styles.quick}><button onClick={()=>setTab('Video units')}>Calculate video units →</button><button onClick={()=>setTab('Attendance')}>Check attendance →</button><button onClick={()=>setTab('Payroll')}>Open payroll →</button></section>
  </>;
}

function VideoUnits({ minutes, setMinutes, clientUnits, staffUnits, clientCharge }) {
  return <section className={styles.two}>
    <div className={styles.card}><Title title="Add video details" sub="The editor enters the finished duration" />
      <label>Video title</label><input defaultValue="Diabetes Series · Episode 31" />
      <label>Doctor / client</label><select defaultValue="manzoor"><option value="manzoor">Dr. Manzoor</option><option>Dr. Jamsheer</option></select>
      <label>Finished duration in minutes</label><input type="number" min="0.1" step="0.1" value={minutes} onChange={e=>setMinutes(e.target.value)} />
      <label>Assigned editor</label><select><option>Mufeed</option><option>Shamil</option></select>
      <button className={styles.primary}>Save video details</button>
    </div>
    <div className={styles.card}><Title title="Automatic calculation" sub="Client billing and staff incentive stay separate" />
      <div className={styles.unitHero}><span>{minutes || 0}<small>minutes</small></span><b>→</b><span>{clientUnits}<small>client units</small></span><b>→</b><span>{staffUnits}<small>staff units</small></span></div>
      <div className={styles.money}><div><small>Standard client rate</small><b>₹1,500 × {clientUnits}</b></div><strong>₹{clientCharge.toLocaleString('en-IN')}</strong></div>
      <div className={styles.rule}><b>Staff incentive rule</b><p>1 client unit = 1 staff unit. Every additional client unit adds 0.5 staff unit.</p></div>
      <div className={styles.discount}><span>Client discount</span><select><option>0% — Standard price</option><option>5%</option><option>10%</option><option>Custom</option></select></div>
    </div>
  </section>;
}

function Attendance(){return <>
  <section className={styles.kpis}><Kpi value="8" label="Present today" note="7 on time · 1 late" color="green"/><Kpi value="1" label="On lunch" note="Returns by 2:15 PM" color="orange"/><Kpi value="20m" label="Office radius" note="GPS verified attendance" color="blue"/><Kpi value="1" label="Sunday credit" note="Carried forward" color="violet"/></section>
  <section className={styles.two}><div className={styles.card}><Title title="My attendance" sub="Location must be inside the BrandMD office radius"/><div className={styles.location}><span>✓</span><div><b>Inside BrandMD Office</b><p>12m from office · GPS accuracy 9m</p></div></div><div className={styles.attButtons}><button className={styles.primary}>Clock in</button><button>Lunch out</button><button>Lunch in</button><button>Clock out</button></div><p className={styles.help}>Shift 9:30 AM–5:00 PM · Lunch allowance 1 hour · Sunday is weekly off</p></div><div className={styles.card}><Title title="Monthly attendance" sub="August · Sundays excluded"/><div className={styles.attGrid}>{[['Scheduled days','26'],['Present','25'],['Late','2'],['Working-day leave','1'],['Sunday duty','1'],['Compensated leave','1']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div><Alert tone="green" title="No salary attendance deduction" text="1 working-day leave was compensated by approved Sunday duty"/></div></section>
  </>}

function Payroll(){return <><section className={styles.card}><Title title="August payroll preview" sub="Attendance, targets and approved incentives combined"/><div className={styles.payTable}><div className={styles.payHead}><span>Staff</span><span>Targets</span><span>Base</span><span>Deductions</span><span>Incentives</span><span>Payable</span></div>{workers.map(w=><div className={styles.payRow} key={w.name}><span><b>{w.name}</b><small>{w.role}</small></span><span><b>{w.name==='Mufeed'?'57.5 / 50 units':'64 posts · 23 creatives'}</b><small className={styles.good}>● {w.status}</small></span><span>₹{w.salary.toLocaleString('en-IN')}</span><span>₹0</span><span>₹{w.incentive.toLocaleString('en-IN')}</span><strong>₹{(w.salary+w.incentive).toLocaleString('en-IN')}</strong></div>)}</div></section><section className={styles.two}><div className={styles.card}><Title title="Mufeed calculation" sub="Video editor"/><Line label="Base salary" value="₹20,000"/><Line label="Video units completed" value="57.5"/><Line label="Extra units above 50" value="7.5 × ₹400"/><Line label="Attendance deduction" value="₹0"/><Line label="Estimated payable" value="₹23,000" strong/></div><div className={styles.card}><Title title="Shamil calculation" sub="Content, posting and junior editing"/><Line label="Base salary" value="₹10,000"/><Line label="Posts above 60" value="4 × ₹100"/><Line label="Creatives above 20" value="3 × ₹200"/><Line label="Video edits" value="5 × ₹300"/><Line label="Estimated payable" value="₹12,500" strong/></div></section></>}

function Reports(){return <><section className={styles.kpis}><Kpi value="42" label="Videos completed" note="Client units: 61" color="violet"/><Kpi value="118" label="Platform links" note="YouTube · IG · Facebook" color="green"/><Kpi value="12" label="Creatives" note="Selected period" color="orange"/><Kpi value="142h" label="Attendance hours" note="GPS verified" color="blue"/></section><section className={styles.two}><div className={styles.card}><Title title="Worker performance" sub="Output, quality and punctuality"/>{workers.map(w=><div className={styles.worker} key={w.name}><span>{w.name[0]}</span><div><b>{w.name}</b><p>{w.role}</p><i><em style={{width:w.name==='Mufeed'?'88%':'94%'}}/></i></div><strong>{w.name==='Mufeed'?'57.5 units':'64 posts'}</strong></div>)}</div><div className={styles.card}><Title title="Posting completeness" sub="Required publishing fields"/><div className={styles.rings}><div><b>96%</b><span>Content</span></div><div><b>92%</b><span>Hashtags</span></div><div><b>89%</b><span>Pinned comments</span></div><div><b>94%</b><span>Platform links</span></div></div></div></section><section className={styles.card}><Title title="Doctor billing preview" sub="₹1,500 per client unit before discount"/><div className={styles.payTable}><div className={styles.payHead}><span>Doctor</span><span>Videos</span><span>Client units</span><span>Standard value</span><span>Discount</span><span>Billable</span></div><div className={styles.payRow}><span><b>Dr. Manzoor</b></span><span>30</span><span>38</span><span>₹57,000</span><span>0%</span><strong>₹57,000</strong></div><div className={styles.payRow}><span><b>Dr. Jamsheer</b></span><span>30</span><span>35</span><span>₹52,500</span><span>10%</span><strong>₹47,250</strong></div></div></section></>}

function Kpi({value,label,note,color}){return <div className={`${styles.kpi} ${styles[color]}`}><span>{value}</span><b>{label}</b><small>{note}</small></div>}
function Title({title,sub}){return <div className={styles.title}><div><h2>{title}</h2><p>{sub}</p></div></div>}
function Alert({tone,title,text}){return <div className={`${styles.alert} ${styles[tone]}`}><span>{tone==='green'?'✓':tone==='amber'?'!':'×'}</span><div><b>{title}</b><p>{text}</p></div></div>}
function Line({label,value,strong}){return <div className={`${styles.line} ${strong?styles.total:''}`}><span>{label}</span><b>{value}</b></div>}
function icon(t){return ({Dashboard:'▦','Video units':'▶',Attendance:'◷',Payroll:'₹',Reports:'◎'})[t]}

