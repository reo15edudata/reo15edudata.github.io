const GAS_WEB_APP_URL="https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SCORE_SHEETS=["ONET_Score","NT_AVGScore","NT_LevelScore","RT_Score","VNET_Score","BNET_Score","NNET_Score"];
const SUBJECT_COLORS=["#3b82f6","#ec4899","#f59e0b","#14b8a6","#8b5cf6","#f97316","#06b6d4"];
const SUBJECT_BACKGROUNDS=["bg-blue-50","bg-pink-50","bg-amber-50","bg-teal-50","bg-violet-50","bg-orange-50","bg-cyan-50"];
let scoreData={},charts={};
let defaultScoreScope="";

window.addEventListener("DOMContentLoaded",initScoreDashboard);

async function initScoreDashboard(){
  try{
    const entries=await Promise.all(SCORE_SHEETS.map(async sheet=>[sheet,await EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL,"DB_4",sheet)]));
    scoreData=Object.fromEntries(entries);
    populateFilters();
    renderAll();
    document.getElementById("scoreFilterForm").addEventListener("submit",event=>{event.preventDefault();renderAll();});
    document.getElementById("scoreFilterForm").addEventListener("reset",()=>setTimeout(()=>{
      document.getElementById("scoreYear").selectedIndex=0;
      document.getElementById("scoreScope").value=defaultScoreScope;
      renderAll();
    },0));
    document.getElementById("onetGrade").addEventListener("change",renderOnet);
    document.getElementById("ntSubject").addEventListener("change",renderNtLevel);
    document.getElementById("bnetLevel").addEventListener("change",renderBnet);
    ["nnetPeriod","nnetLevel"].forEach(id=>document.getElementById(id).addEventListener("change",renderNnet));
  }catch(error){
    console.error(error);
    document.getElementById("onetCards").innerHTML=`<div class="col-span-full rounded-xl bg-rose-50 p-5 text-rose-700">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</div>`;
  }finally{window.hidePageLoader?.();}
}

function populateFilters(){
  const all=Object.values(scoreData).flat();
  fillSelect("scoreYear",unique(all,"YEAR").sort((a,b)=>Number(b)-Number(a)));
  const scopes=unique([...scoreData.ONET_Score,...scoreData.NT_AVGScore,...scoreData.RT_Score],"TEST_LEVEL").filter(scope=>!/ประเทศ/.test(scope));
  fillSelect("scoreScope",scopes);
  const preferred=scopes.find(scope=>/ศธภ\.?\s*15/.test(scope));
  defaultScoreScope=preferred||scopes[0]||"";
  if(defaultScoreScope)document.getElementById("scoreScope").value=defaultScoreScope;
  fillSelect("onetGrade",unique(scoreData.ONET_Score,"EDU_LEVEL"));
  const ntSubjects=unique(scoreData.NT_LevelScore,"TEST_SUBJECT");
  fillSelect("ntSubject",ntSubjects);
  const ntCombined=ntSubjects.find(subject=>/รวม\s*2\s*ด้าน/.test(subject));
  if(ntCombined)document.getElementById("ntSubject").value=ntCombined;
  fillSelect("bnetLevel",unique(scoreData.BNET_Score,"TEST_LEVEL"));
  fillSelect("nnetPeriod",unique(scoreData.NNET_Score,"PERIOD_NO").sort((a,b)=>Number(a)-Number(b)),value=>`ภาคเรียนที่ ${value}`);
  fillSelect("nnetLevel",unique(scoreData.NNET_Score,"TEST_LEVEL"));
}
function fillSelect(id,values,label=value=>value){const select=document.getElementById(id);select.innerHTML="";values.forEach(value=>select.add(new Option(label(value),value)));}
function unique(rows,field){return[...new Set(rows.map(row=>String(row[field]??"").trim()).filter(Boolean))];}
function n(value){const parsed=Number(String(value??0).replace(/,/g,""));return Number.isFinite(parsed)?parsed:0;}
function waitText(){return'<p class="col-span-full py-6 text-center text-slate-400">รอข้อมูลอัปเดต</p>';}
function coreRows(sheet){const year=document.getElementById("scoreYear").value,scope=document.getElementById("scoreScope").value;return(scoreData[sheet]||[]).filter(row=>String(row.YEAR)===year&&String(row.TEST_LEVEL)===scope);}
function nationalRows(sheet){const year=document.getElementById("scoreYear").value;return(scoreData[sheet]||[]).filter(row=>String(row.YEAR)===year&&String(row.TEST_LEVEL)==="ระดับประเทศ");}
function geographyText(row){return`${row.TEST_LEVEL||""} ${row.REGIONAL||""} ${row.PROV_NAME||""}`.trim();}
function isNational(row){return/ประเทศ/.test(geographyText(row));}
function isRegionalScope(scope){return/ศธภ\.?\s*15|ศึกษาธิการภาค\s*15/.test(scope);}
function provinceFromScope(scope){return String(scope).replace(/^ระดับจังหวัด\s*/,"").replace(/^จังหวัด\s*/,"").trim();}
function scopedRows(sheet,{bnet=false}={}){
  const year=document.getElementById("scoreYear").value;
  const scope=document.getElementById("scoreScope").value;
  const rows=(scoreData[sheet]||[]).filter(row=>String(row.YEAR)===year&&!isNational(row));
  if(isRegionalScope(scope)){
    const pattern=bnet?/ภาคเหนือ|เหนือ/:/ศธภ\.?\s*15|ศึกษาธิการภาค\s*15/;
    const regionalRows=rows.filter(row=>pattern.test(geographyText(row)));
    const aggregateRows=regionalRows.filter(row=>{
      const province=String(row.PROV_NAME||"").trim();
      return !province||pattern.test(province)||isRegionalScope(province);
    });
    return aggregateRows.length?aggregateRows:regionalRows;
  }
  const province=provinceFromScope(scope);
  return rows.filter(row=>String(row.PROV_NAME||"").trim()===province||String(row.PROV_NAME||"").includes(province));
}
function specificNationalRows(sheet){
  const year=document.getElementById("scoreYear").value;
  return(scoreData[sheet]||[]).filter(row=>String(row.YEAR)===year&&isNational(row));
}
function renderAll(){renderCoreTests();renderVnet();renderBnet();renderNnet();}
function renderCoreTests(){renderOnet();renderNtAverage();renderNtLevel();renderRt();}

function renderOnet(){
  const grade=document.getElementById("onetGrade").value;
  const rows=coreRows("ONET_Score").filter(row=>String(row.EDU_LEVEL)===grade);
  const national=nationalRows("ONET_Score").filter(row=>String(row.EDU_LEVEL)===grade);
  document.getElementById("onetCards").innerHTML=rows.length?rows.map((row,index)=>{
    const tested=n(row.STUDENT_TEST_COUNT),passed=n(row.STUDENT_MOREHALFTEST_COUNT),rate=tested?passed/tested*100:0;
    return `<article class="subject-card border-b-4" style="border-bottom-color:${SUBJECT_COLORS[index%SUBJECT_COLORS.length]}"><div class="inline-flex rounded-lg ${SUBJECT_BACKGROUNDS[index%SUBJECT_BACKGROUNDS.length]} px-2.5 py-1 text-xs font-medium">${escapeHtml(row.TEST_SUBJECT)}</div><strong class="block text-2xl mt-3">${n(row.AVG_SCORE).toFixed(2)}</strong><p class="text-xs text-slate-500 mt-2">ผู้ที่ผ่านเกณฑ์ 50% คิดเป็น <strong>${rate.toFixed(2)}%</strong> ของผู้เข้าสอบ</p></article>`;
  }).join(""):waitText();
  const colors=rows.map((_,index)=>SUBJECT_COLORS[index%SUBJECT_COLORS.length]);
  replaceChart("onet","onetChart",{type:"bar",data:{labels:rows.map(row=>row.TEST_SUBJECT),datasets:[{label:document.getElementById("scoreScope").value,data:rows.map(row=>n(row.AVG_SCORE)),backgroundColor:colors,borderRadius:6},{label:"ระดับประเทศ",data:rows.map(row=>n(national.find(item=>item.TEST_SUBJECT===row.TEST_SUBJECT)?.AVG_SCORE)),backgroundColor:colors.map(transparentColor),borderColor:colors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("คะแนน")});
  document.getElementById("onetTable").innerHTML=rows.length?rows.map(row=>`<tr><td>${escapeHtml(row.TEST_SUBJECT)}</td><td>${n(row.STUDENT_TEST_COUNT).toLocaleString("th-TH")}</td><td>${n(row.STUDENT_MOREHALFTEST_COUNT).toLocaleString("th-TH")}</td></tr>`).join(""):'<tr><td colspan="3" class="text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}

function renderNtAverage(){
  const rows=coreRows("NT_AVGScore"),combined=rows.find(row=>/รวม\s*2\s*ด้าน/.test(String(row.TEST_SUBJECT)));
  const national=nationalRows("NT_AVGScore");
  document.getElementById("ntCombined").textContent=combined?n(combined.AVG_SCORE).toFixed(2):"รอข้อมูลอัปเดต";
  const subjects=rows.filter(row=>!/รวม/.test(String(row.TEST_SUBJECT)));
  const colors=subjects.map((_,index)=>SUBJECT_COLORS[index%SUBJECT_COLORS.length]);
  replaceChart("ntAvg","ntAverageChart",{type:"bar",data:{labels:subjects.map(row=>row.TEST_SUBJECT),datasets:[{label:document.getElementById("scoreScope").value,data:subjects.map(row=>n(row.AVG_SCORE)),backgroundColor:colors,borderRadius:6},{label:"ระดับประเทศ",data:subjects.map(row=>n(national.find(item=>item.TEST_SUBJECT===row.TEST_SUBJECT)?.AVG_SCORE)),backgroundColor:colors.map(transparentColor),borderColor:colors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("คะแนน")});
}
function renderNtLevel(){
  const subject=document.getElementById("ntSubject").value;
  const rows=coreRows("NT_LevelScore").filter(row=>String(row.TEST_SUBJECT)===subject);
  replaceChart("ntLevel","ntLevelChart",{type:"doughnut",data:{labels:rows.map(row=>row.QUALITY_LEVEL),datasets:[{data:rows.map(row=>n(row.AVG_SCORE)),backgroundColor:["#16a34a","#22c55e","#f59e0b","#ef4444"]}]},options:{maintainAspectRatio:false,plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:context=>`${context.label}: ${Number(context.raw).toFixed(2)}%`}}}}});
  document.getElementById("ntLevelTable").innerHTML=rows.length?rows.map(row=>`<tr><td>${escapeHtml(row.QUALITY_LEVEL)}</td><td>${n(row.STUDENT_TEST_COUNT).toLocaleString("th-TH")}</td><td>${n(row.AVG_SCORE).toFixed(2)}%</td></tr>`).join(""):'<tr><td colspan="3" class="text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}
function renderRt(){
  const rows=coreRows("RT_Score"),combined=rows.find(row=>/รวม\s*2\s*ด้าน/.test(String(row.TEST_SUBJECT)));
  const national=nationalRows("RT_Score");
  document.getElementById("rtCombined").textContent=combined?n(combined.AVG_SCORE).toFixed(2):"รอข้อมูลอัปเดต";
  const subjects=rows.filter(row=>!/รวม/.test(String(row.TEST_SUBJECT)));
  const averageColors=subjects.map((_,index)=>["#f43f5e","#fb7185"][index%2]);
  const passColors=subjects.map((_,index)=>["#0d9488","#2dd4bf"][index%2]);
  replaceChart("rtAvg","rtAverageChart",{type:"bar",data:{labels:subjects.map(row=>row.TEST_SUBJECT),datasets:[{label:document.getElementById("scoreScope").value,data:subjects.map(row=>n(row.AVG_SCORE)),backgroundColor:averageColors,borderRadius:6},{label:"ระดับประเทศ",data:subjects.map(row=>n(national.find(item=>item.TEST_SUBJECT===row.TEST_SUBJECT)?.AVG_SCORE)),backgroundColor:averageColors.map(transparentColor),borderColor:averageColors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("คะแนนเฉลี่ย")});
  replaceChart("rtPass","rtPassChart",{type:"bar",data:{labels:subjects.map(row=>row.TEST_SUBJECT),datasets:[{label:document.getElementById("scoreScope").value,data:subjects.map(row=>n(row.STUDENT_TEST_COUNT)?n(row.STUDENT_MOREHALFTEST_COUNT)/n(row.STUDENT_TEST_COUNT)*100:0),backgroundColor:passColors,borderRadius:6},{label:"ระดับประเทศ",data:subjects.map(row=>{const item=national.find(nation=>nation.TEST_SUBJECT===row.TEST_SUBJECT);return item&&n(item.STUDENT_TEST_COUNT)?n(item.STUDENT_MOREHALFTEST_COUNT)/n(item.STUDENT_TEST_COUNT)*100:0;}),backgroundColor:passColors.map(transparentColor),borderColor:passColors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("ร้อยละ")});
}

function renderVnet(){
  const rows=summarizeScoreRows(scopedRows("VNET_Score"),["PART_NAME"],"STUDENT_COUNT");
  const national=summarizeScoreRows(specificNationalRows("VNET_Score"),["PART_NAME"],"STUDENT_COUNT");
  document.getElementById("vnetCards").innerHTML=rows.length?rows.map((row,index)=>`<article class="subject-card border-b-4" style="border-bottom-color:${SUBJECT_COLORS[index%3]}"><h3>${escapeHtml(row.PART_NAME)}</h3><strong class="block text-2xl mt-2">${n(row.AVG_SCORE).toFixed(2)}</strong><p class="text-xs text-slate-400 mt-1">จากคะแนนเต็ม ${n(row.FUll_SCORE).toLocaleString("th-TH")}</p></article>`).join(""):waitText();
  const colors=rows.map((_,index)=>SUBJECT_COLORS[index%3]);
  replaceChart("vnet","vnetChart",{type:"bar",data:{labels:rows.map(row=>row.PART_NAME),datasets:[{label:document.getElementById("scoreScope").value,data:rows.map(row=>n(row.AVG_SCORE)),backgroundColor:colors,borderRadius:6},{label:"ระดับประเทศ",data:rows.map(row=>valueOrNull(national.find(item=>String(item.PART_NAME)===String(row.PART_NAME))?.AVG_SCORE)),backgroundColor:colors.map(transparentColor),borderColor:colors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("คะแนน")});
}
function renderBnet(){
  const level=document.getElementById("bnetLevel").value;
  const rows=summarizeScoreRows(scopedRows("BNET_Score",{bnet:true}).filter(row=>String(row.TEST_LEVEL)===level),["TEST_SUBJECT","STANDARD_NAME"],"STUDENT_CNT");
  const national=summarizeScoreRows(specificNationalRows("BNET_Score").filter(row=>String(row.TEST_LEVEL)===level),["TEST_SUBJECT","STANDARD_NAME"],"STUDENT_CNT");
  document.getElementById("bnetDisclaimer").classList.toggle("hidden",!isRegionalScope(document.getElementById("scoreScope").value));
  Object.keys(charts).filter(key=>key.startsWith("bnetSection")).forEach(key=>{charts[key]?.destroy();delete charts[key];});
  const groups=groupBy(rows,"TEST_SUBJECT");
  const subjectGroups=[...groups].map(([subject,subjectRows],index)=>{
    const color=SUBJECT_COLORS[index%SUBJECT_COLORS.length];
    const summaryRow=subjectRows.find(row=>/รวม|เฉลี่ย/.test(String(row.STANDARD_NAME||"")));
    const detailRows=subjectRows.filter(row=>row!==summaryRow);
    const details=detailRows.length?detailRows:subjectRows;
    const totalStudents=details.reduce((sum,row)=>sum+n(row.STUDENT_CNT),0);
    const average=summaryRow
      ? n(summaryRow.AVG_SCORE)
      : totalStudents
        ? details.reduce((sum,row)=>sum+n(row.AVG_SCORE)*n(row.STUDENT_CNT),0)/totalStudents
        : details.length
          ? details.reduce((sum,row)=>sum+n(row.AVG_SCORE),0)/details.length
          : null;
    return{subject,details,average,color,index};
  });
  document.getElementById("bnetCards").innerHTML=subjectGroups.length
    ? subjectGroups.map(group=>`<article class="subject-card border-b-4" style="border-bottom-color:${group.color}"><h3>${escapeHtml(group.subject)}</h3><span class="mt-2 block text-xs text-slate-400">คะแนนเฉลี่ย</span><strong class="block text-2xl mt-1">${group.average===null?"รอข้อมูลอัปเดต":group.average.toFixed(2)}</strong></article>`).join("")
    : waitText();
  const container=document.getElementById("bnetSections");
  container.innerHTML=subjectGroups.length?subjectGroups.map(group=>
    `<article class="chart-card border-l-4" style="border-left-color:${group.color}"><div class="mb-4"><span class="inline-flex rounded-lg px-3 py-1 text-sm font-semibold text-white" style="background:${group.color}">${escapeHtml(group.subject)}</span></div><div class="h-64"><canvas id="bnetSectionChart${group.index}"></canvas></div><div class="overflow-auto max-h-64 mt-4"><table class="score-table"><thead><tr><th>มาตรฐาน</th><th>คะแนนเฉลี่ย</th></tr></thead><tbody>${group.details.map(row=>`<tr><td>${escapeHtml(row.STANDARD_NAME)}</td><td>${n(row.AVG_SCORE).toFixed(2)}</td></tr>`).join("")}</tbody></table></div></article>`
  ).join(""):waitText();
  subjectGroups.forEach(group=>{
    replaceChart(`bnetSection${group.index}`,`bnetSectionChart${group.index}`,{type:"bar",data:{labels:group.details.map(row=>row.STANDARD_NAME),datasets:[{label:document.getElementById("scoreScope").value,data:group.details.map(row=>n(row.AVG_SCORE)),backgroundColor:group.color,borderRadius:5},{label:"ระดับประเทศ",data:group.details.map(row=>valueOrNull(national.find(item=>String(item.TEST_SUBJECT)===group.subject&&String(item.STANDARD_NAME)===String(row.STANDARD_NAME))?.AVG_SCORE)),backgroundColor:transparentColor(group.color),borderColor:group.color,borderWidth:1,borderRadius:5}]},options:{...comparisonChartOptions("คะแนน"),indexAxis:"y"}});
  });
}
function renderNnet(){
  const period=document.getElementById("nnetPeriod").value,level=document.getElementById("nnetLevel").value;
  const rows=summarizeScoreRows(scopedRows("NNET_Score").filter(row=>String(row.PERIOD_NO)===period&&String(row.TEST_LEVEL)===level),["TEST_SUBJECT"],"STUDENT_CNT");
  const national=summarizeScoreRows(specificNationalRows("NNET_Score").filter(row=>String(row.PERIOD_NO)===period&&String(row.TEST_LEVEL)===level),["TEST_SUBJECT"],"STUDENT_CNT");
  document.getElementById("nnetCards").innerHTML=rows.length?rows.map((row,index)=>`<article class="subject-card border-b-4" style="border-bottom-color:${SUBJECT_COLORS[index%SUBJECT_COLORS.length]}"><h3>${escapeHtml(row.TEST_SUBJECT)}</h3><strong class="block text-2xl mt-2">${n(row.AVG_SCORE).toFixed(2)}</strong></article>`).join(""):waitText();
  const colors=rows.map((_,index)=>SUBJECT_COLORS[index%SUBJECT_COLORS.length]);
  replaceChart("nnet","nnetChart",{type:"bar",data:{labels:rows.map(row=>row.TEST_SUBJECT),datasets:[{label:document.getElementById("scoreScope").value,data:rows.map(row=>n(row.AVG_SCORE)),backgroundColor:colors,borderRadius:6},{label:"ระดับประเทศ",data:rows.map(row=>valueOrNull(national.find(item=>String(item.TEST_SUBJECT)===String(row.TEST_SUBJECT))?.AVG_SCORE)),backgroundColor:colors.map(transparentColor),borderColor:colors,borderWidth:1,borderRadius:6}]},options:comparisonChartOptions("คะแนน")});
}

function summarizeScoreRows(rows,keyFields,countField){
  const groups=new Map();
  rows.forEach(row=>{
    const key=keyFields.map(field=>String(row[field]||"")).join("||");
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  });
  return[...groups.values()].map(items=>{
    if(items.length===1)return items[0];
    const totalCount=items.reduce((sum,row)=>sum+n(row[countField]),0);
    const weighted=items.reduce((sum,row)=>sum+n(row.AVG_SCORE)*n(row[countField]),0);
    return{...items[0],[countField]:totalCount,AVG_SCORE:totalCount?weighted/totalCount:items.reduce((sum,row)=>sum+n(row.AVG_SCORE),0)/items.length,MIN_SCORE:Math.min(...items.map(row=>n(row.MIN_SCORE))),MAX_SCORE:Math.max(...items.map(row=>n(row.MAX_SCORE)))};
  });
}
function groupBy(rows,field){const groups=new Map();rows.forEach(row=>{const key=String(row[field]||"ไม่ระบุ");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);});return groups;}
function valueOrNull(value){const cleaned=String(value??"").replace(/,/g,"").trim();if(!cleaned)return null;const parsed=Number(cleaned);return Number.isFinite(parsed)?parsed:null;}
function replaceChart(key,id,config){charts[key]?.destroy();charts[key]=new Chart(document.getElementById(id),config);}
function chartOptions(title,legend=true){return{maintainAspectRatio:false,plugins:{legend:{display:legend,position:"bottom"}},scales:{y:{beginAtZero:true,title:{display:true,text:title}}}};}
function transparentColor(color){return /^#[0-9a-f]{6}$/i.test(String(color))?`${color}55`:color;}
function comparisonChartOptions(title){
  const options=chartOptions(title);
  const primaryLabel=document.getElementById("scoreScope").value;
  options.plugins.legend.labels={generateLabels:chart=>[
    {text:`${primaryLabel} — สีทึบ`,fillStyle:"rgba(71,85,105,1)",strokeStyle:"#475569",lineWidth:1,hidden:!chart.isDatasetVisible(0),datasetIndex:0},
    {text:"ระดับประเทศ — สีโปร่งใส",fillStyle:"rgba(71,85,105,.25)",strokeStyle:"#475569",lineWidth:1,hidden:!chart.isDatasetVisible(1),datasetIndex:1}
  ]};
  return options;
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[char]);}
