const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIaex-ZhKRkRFze1L8tyQF5UBQR4BQ2Is9L6nJMl9iGd9MTlg4ELJUqdzOZPO3w-OwDA/exec";
const SHEETS = { career:"Job_Vacancy_Career", industry:"Job_Vacancy_Industry", eduLevel:"Job_Vacancy_EduLevel", mou:"Vocational_Busi_MOU" };
const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MONTH_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
let data = {career:[],industry:[],eduLevel:[],mou:[]};
let trendChart, businessMap, businessLayer;
let trendProvinceFilter, tableProvinceFilter, tableMonthFilter;
let tableDefaultYear = "";

window.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard(){
  try{
    const results=await Promise.all(Object.entries(SHEETS).map(async([key,sheet])=>[key,await EDU15DataClient.fetchAllPages(GAS_WEB_APP_URL,"DB_3",sheet)]));
    data=Object.fromEntries(results);
    populateFilters();
    initMap();
    renderTrend();
    renderTables();
    document.getElementById("trendFilterForm").addEventListener("change",renderTrend);
    document.getElementById("tableFilterForm").addEventListener("submit",event=>{event.preventDefault();renderTables();});
    document.getElementById("tableFilterForm").addEventListener("reset",()=>setTimeout(()=>{
      tableProvinceFilter.clear();
      tableMonthFilter.clear();
      document.getElementById("tableYear").value=tableDefaultYear;
      renderTables();
    },0));
  }catch(error){
    console.error(error);
    document.getElementById("careerTableBody").innerHTML=`<tr><td colspan="2" class="p-8 text-center text-rose-600">${escapeHtml(error.message)}</td></tr>`;
  }finally{window.hidePageLoader?.();}
}

function populateFilters(){
  const vacancyRows=[...data.career,...data.industry,...data.eduLevel];
  const years=[...new Set(vacancyRows.map(row=>String(row.YEAR)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const provinces=[...new Set([...vacancyRows,...data.mou].map(row=>String(row.PROV_NAME||"")).filter(Boolean))].sort();
  ["trendStartYear","trendEndYear","tableYear"].forEach(id=>years.forEach(year=>document.getElementById(id).add(new Option(year,year))));
  MONTHS.forEach((month,index)=>{
    document.getElementById("trendStartMonth").add(new Option(month,String(index+1)));
    document.getElementById("trendEndMonth").add(new Option(month,String(index+1)));
  });
  const months=[...new Set(vacancyRows.map(row=>String(row.MONTH||"").trim()).filter(Boolean))].sort((a,b)=>monthNumber(a)-monthNumber(b));
  trendProvinceFilter=EDU15MultiSelect.create(document.getElementById("trendProvince"),provinces,"ทุกจังหวัด");
  tableProvinceFilter=EDU15MultiSelect.create(document.getElementById("tableProvince"),provinces,"ทุกจังหวัด");
  tableMonthFilter=EDU15MultiSelect.create(document.getElementById("tableMonth"),months,"ทุกเดือน");
  if(years.length){
    document.getElementById("trendStartYear").value=years[0];
    document.getElementById("trendEndYear").value=years[years.length-1];
    document.getElementById("tableYear").value=years[years.length-1];
    tableDefaultYear=years[years.length-1];
  }
  document.getElementById("trendStartMonth").value="1";
  document.getElementById("trendEndMonth").value="12";
}

function monthNumber(value){
  const numeric=Number(value);
  if(numeric>=1&&numeric<=12)return numeric;
  const index=MONTHS.findIndex(month=>String(value).includes(month));
  return index>=0?index+1:0;
}
function dateKey(year,month){return Number(year)*12+Number(month)-1;}
function numberValue(value){const number=Number(String(value??0).replace(/,/g,""));return Number.isFinite(number)?number:0;}

function renderTrend(){
  const type=document.getElementById("trendType").value;
  const detailFields={career:"CAREER_TYPE",industry:"INDUSTRY_TYPE",eduLevel:"EDU_LEVEL"};
  const detailLabels={career:"ประเภทอาชีพ",industry:"ประเภทอุตสาหกรรม",eduLevel:"ระดับการศึกษา"};
  const detailField=detailFields[type];
  const selectedProvinces=trendProvinceFilter.getValues();
  let start=dateKey(document.getElementById("trendStartYear").value,document.getElementById("trendStartMonth").value);
  let end=dateKey(document.getElementById("trendEndYear").value,document.getElementById("trendEndMonth").value);
  if(start>end)[start,end]=[end,start];
  const rows=data[type].filter(row=>{
    const month=monthNumber(row.MONTH);
    if(!month)return false;
    const key=dateKey(row.YEAR,month);
    return key>=start&&key<=end&&(!selectedProvinces.length||selectedProvinces.includes(String(row.PROV_NAME)));
  });
  const periods=[];
  for(let key=start;key<=end;key++){
    const year=Math.floor(key/12),month=key%12+1;
    periods.push({key,year,month,label:`${MONTH_SHORT[month-1]} ${year}`});
  }
  const details=[...new Set(rows.map(row=>String(row[detailField]||"ไม่ระบุ")))].sort((a,b)=>a.localeCompare(b,"th"));
  const provinces=[...new Set(rows.map(row=>String(row.PROV_NAME||"ไม่ระบุจังหวัด")))].sort();
  const colors=["#0d9488","#2563eb","#f59e0b","#e11d48","#7c3aed","#0891b2","#ea580c","#65a30d","#db2777","#475569"];
  trendChart?.destroy();
  trendChart=new Chart(document.getElementById("workforceTrendChart"),{
    type:"line",
    data:{labels:periods.map(item=>item.label),datasets:details.map((detail,index)=>({
      label:detail,
      data:periods.map(period=>rows.filter(row=>String(row[detailField]||"ไม่ระบุ")===detail&&dateKey(row.YEAR,monthNumber(row.MONTH))===period.key).reduce((sum,row)=>sum+numberValue(row.VACANCY_COUNT),0)),
      borderColor:colors[index%colors.length],backgroundColor:colors[index%colors.length],tension:.3,pointRadius:3
    }))},
    options:{maintainAspectRatio:false,plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:true}}}
  });
  document.getElementById("trendSummary").textContent=`เส้นกราฟแยกตาม${detailLabels[type]} ${details.length.toLocaleString("th-TH")} รายการ · ${provinces.length.toLocaleString("th-TH")} จังหวัด`;
}

function renderTables(){
  const year=document.getElementById("tableYear").value;
  const provinces=tableProvinceFilter.getValues();
  const months=tableMonthFilter.getValues();
  const filter=rows=>rows.filter(row=>String(row.YEAR)===year&&(!provinces.length||provinces.includes(String(row.PROV_NAME)))&&(!months.length||months.includes(String(row.MONTH))));
  renderSummaryTable("careerTableBody",filter(data.career),"CAREER_TYPE");
  renderSummaryTable("industryTableBody",filter(data.industry),"INDUSTRY_TYPE");
  renderSummaryTable("eduLevelTableBody",filter(data.eduLevel),"EDU_LEVEL");
  const mou=data.mou.filter(row=>String(row.YEAR)===year&&(!provinces.length||provinces.includes(String(row.PROV_NAME))));
  renderMou(mou);
  renderMap(mou);
}

function renderSummaryTable(id,rows,field){
  const totals=new Map();
  rows.forEach(row=>{const key=String(row[field]||"ไม่ระบุ");totals.set(key,(totals.get(key)||0)+numberValue(row.VACANCY_COUNT));});
  const sorted=[...totals].sort((a,b)=>b[1]-a[1]);
  document.getElementById(id).innerHTML=sorted.length?sorted.map(([label,value])=>`<tr class="border-t"><td class="p-3">${escapeHtml(label)}</td><td class="p-3 text-right font-medium">${value.toLocaleString("th-TH")}</td></tr>`).join(""):'<tr><td colspan="2" class="p-8 text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}
function renderMou(rows){
  const sorted=[...rows].sort((a,b)=>String(a.BUSINESS_NAME).localeCompare(String(b.BUSINESS_NAME),"th"));
  document.getElementById("stat-mou").textContent=sorted.length.toLocaleString("th-TH");
  document.getElementById("mouTableSummary").textContent=sorted.length?`พบ ${sorted.length.toLocaleString("th-TH")} รายการ`:"รอข้อมูลอัปเดต";
  document.getElementById("mouTableBody").innerHTML=sorted.length?sorted.map(row=>`<tr class="border-t"><td class="p-3 font-medium">${escapeHtml(row.BUSINESS_NAME||"ไม่ระบุ")}</td><td class="p-3">${escapeHtml(row.BUSINESS_TYPE||"-")}</td></tr>`).join(""):'<tr><td colspan="2" class="p-8 text-center text-slate-400">รอข้อมูลอัปเดต</td></tr>';
}

function initMap(){
  businessMap=L.map("businessMap",{preferCanvas:true}).setView([18.4,99.0],7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"&copy; OpenStreetMap contributors"}).addTo(businessMap);
  businessLayer=L.layerGroup().addTo(businessMap);
}
function parseCoordinate(value){const values=String(value||"").match(/-?\d+(?:\.\d+)?/g)?.map(Number);if(!values||values.length<2)return null;let[lat,lng]=values;if(Math.abs(lat)>90&&Math.abs(lng)<=90)[lat,lng]=[lng,lat];return Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;}
function renderMap(rows){
  businessLayer.clearLayers();const bounds=[];let valid=0;
  rows.forEach(row=>{const coordinate=parseCoordinate(row.COORDI);if(!coordinate)return;valid++;bounds.push(coordinate);L.circleMarker(coordinate,{radius:6,color:"#6d28d9",fillColor:"#8b5cf6",fillOpacity:.75,weight:1}).bindPopup(`<strong>${escapeHtml(row.BUSINESS_NAME||"สถานประกอบการ")}</strong><br>${escapeHtml(row.BUSINESS_TYPE||"")}`).addTo(businessLayer);});
  document.getElementById("businessMapSummary").textContent=valid?`แสดงพิกัดที่ถูกต้อง ${valid.toLocaleString("th-TH")} แห่ง`:"รอข้อมูลอัปเดต";
  if(bounds.length)businessMap.fitBounds(bounds,{padding:[24,24],maxZoom:13});
  setTimeout(()=>businessMap.invalidateSize(),0);
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[char]);}
