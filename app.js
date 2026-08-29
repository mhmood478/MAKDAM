import{initializeApp}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{getDatabase,ref,onValue,push,set,update,remove}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ================= FIREBASE =================
   ضع القيم التي يعطيك إياها Firebase Web App.
   لا تغيّر databaseURL.
*/
/* ضع إعدادات Firebase هنا */
 // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCkI-iOa7Ou-cluhMP7ueYFhEAV30tmjHc",
    authDomain: "shjartna.firebaseapp.com",
    projectId: "shjartna",
   databaseURL: "https://shjartna-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "shjartna.firebasestorage.app",
    messagingSenderId: "1063038121519",
    appId: "1:1063038121519:web:fe860504532e548ae278da"
  };

const familyId=new URLSearchParams(location.search).get("family")||"main";
const configured=!firebaseConfig.apiKey.startsWith("PASTE_");
let db=null;
let people={};
let selectedId=null;
let pendingRelation=null;
let zoom=1;

const $=id=>document.getElementById(id);

function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function status(t){$("status").textContent=t;}
function error(t){status("⚠ "+t);console.error(t);setTimeout(()=>status(db?"متصل بـ Firebase":"وضع التجربة المحلية"),4000);}

function makePerson(name,gender,birth,relation){
  return{name,gender,birth:birth||"",relation,createdAt:Date.now(),fatherId:null,motherId:null,spouseId:null};
}

/* هذا هو محرك العلاقات الأساسي.
   الاتجاه دائمًا:
   child.fatherId = الأب
   child.motherId = الأم
   person.spouseId = الزوج/الزوجة
*/
async function createRelative(type,targetId,data){
  const target=people[targetId];
  if(!target)throw new Error("Target person not found");

  let newPerson=makePerson(data.name,data.gender,data.birth,type);

  if(type==="father"){
    newPerson.gender="male";
  }
  if(type==="mother"){
    newPerson.gender="female";
  }
  if(type==="brother"||type==="sister"){
    newPerson.fatherId=target.fatherId||null;
    newPerson.motherId=target.motherId||null;
  }
  if(type==="son"||type==="daughter"){
    if(target.gender==="female")newPerson.motherId=targetId;
    else newPerson.fatherId=targetId;
  }
  if(type==="spouse"){
    newPerson.spouseId=targetId;
    newPerson.gender=target.gender==="female"?"male":"female";
  }

  /* IMPORTANT:
     أولًا ننشئ الشخص الجديد في /people ثم نضع ID الحقيقي
     في الشخص المستهدف. لا نستخدم relation لوحدها لتحديد الأبوة.
  */
  let newId;
  if(db){
    const personRef=push(ref(db,`families/${familyId}/people`));
    newId=personRef.key;
    await set(personRef,newPerson);
  }else{
    newId="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
    people[newId]=newPerson;
  }

  if(type==="father"){
    await saveFields(targetId,{fatherId:newId});
  }else if(type==="mother"){
    await saveFields(targetId,{motherId:newId});
  }else if(type==="spouse"){
    await saveFields(targetId,{spouseId:newId});
  }
  return newId;
}

async function saveFields(id,fields){
  if(db)await update(ref(db,`families/${familyId}/people/${id}`),fields);
  else people[id]={...people[id],...fields};
}

async function addRoot(data){
  const p=makePerson(data.name,data.gender,data.birth,"root");
  if(db){
    const r=push(ref(db,`families/${familyId}/people`));
    await set(r,p);
    return r.key;
  }
  const id="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,7);
  people[id]=p;render();return id;
}

function openAdd(type="root",targetId=null){
  pendingRelation={type,targetId};
  $("modalTitle").textContent=type==="root"?"إضافة أول شخص":"إضافة "+({father:"الأب",mother:"الأم",brother:"الأخ",sister:"الأخت",son:"الابن",daughter:"الابنة",spouse:"الزوج/الزوجة"}[type]);
  $("modalDescription").textContent=targetId?`المحدد: ${people[targetId]?.name||""}. سيتم حفظ العلاقة مباشرة في قاعدة البيانات.`:"أدخل بيانات الشخص.";
  $("name").value="";$("birth").value="";
  $("gender").value=["mother","sister","daughter"].includes(type)?"female":"male";
  $("personModal").classList.remove("hidden");$("name").focus();
}

function closeModal(){$("personModal").classList.add("hidden");pendingRelation=null;}

async function saveNew(){
  const name=$("name").value.trim();
  if(!name){$("name").focus();return;}
  const data={name,gender:$("gender").value,birth:$("birth").value.trim()};
  try{
    status("جارٍ الحفظ…");
    if(pendingRelation?.type==="root")await addRoot(data);
    else await createRelative(pendingRelation.type,pendingRelation.targetId,data);
    closeModal();
    status(db?"تم الحفظ في Firebase":"تم الحفظ محليًا");
  }catch(e){error("فشل الحفظ: "+e.message)}
}

function fillSelect(id,current,exclude){
  const el=$(id);el.innerHTML='<option value="">غير محدد</option>';
  Object.entries(people).forEach(([k,p])=>{
    if(k!==exclude)el.insertAdjacentHTML("beforeend",`<option value="${k}">${esc(p.name)}</option>`);
  });
  el.value=current||"";
}

function openEdit(){
  if(!selectedId||!people[selectedId])return;
  const p=people[selectedId];
  $("editName").value=p.name||"";$("editGender").value=p.gender||"male";$("editBirth").value=p.birth||"";
  fillSelect("father",p.fatherId,selectedId);fillSelect("mother",p.motherId,selectedId);fillSelect("spouse",p.spouseId,selectedId);
  $("editModal").classList.remove("hidden");
}

async function saveEdit(){
  if(!selectedId)return;
  const id=selectedId,p=people[id];
  const nextFather=$("father").value||null,nextMother=$("mother").value||null,nextSpouse=$("spouse").value||null;
  const fields={name:$("editName").value.trim(),gender:$("editGender").value,birth:$("editBirth").value.trim(),fatherId:nextFather,motherId:nextMother,spouseId:nextSpouse};
  if(!fields.name)return;
  try{
    status("جارٍ حفظ التعديل…");
    await saveFields(id,fields);

    /* عند تغيير الزوج، نعكس الرابط في الطرف الجديد */
    if(nextSpouse&&people[nextSpouse])await saveFields(nextSpouse,{spouseId:id});

    $("editModal").classList.add("hidden");
    status(db?"تم تحديث الشخص":"تم تحديث الشخص محليًا");
  }catch(e){error("فشل التعديل: "+e.message)}
}

async function deletePerson(){
  if(!selectedId||!people[selectedId])return;
  const id=selectedId,p=people[id];
  if(!confirm(`حذف «${p.name}»؟\\nسيبقى الأبناء موجودين، لكن ستتم إزالة رابط هذا الشخص كأب/أم.`))return;
  try{
    status("جارٍ الحذف…");
    const updates={};
    Object.entries(people).forEach(([k,x])=>{
      if(k===id)return;
      if(x.fatherId===id)updates[`families/${familyId}/people/${k}/fatherId`]=null;
      if(x.motherId===id)updates[`families/${familyId}/people/${k}/motherId`]=null;
      if(x.spouseId===id)updates[`families/${familyId}/people/${k}/spouseId`]=null;
    });
    if(db){
      if(Object.keys(updates).length)await update(ref(db),updates);
      await remove(ref(db,`families/${familyId}/people/${id}`));
    }else{
      Object.entries(people).forEach(([k,x])=>{
        if(x.fatherId===id)x.fatherId=null;if(x.motherId===id)x.motherId=null;if(x.spouseId===id)x.spouseId=null;
      });
      delete people[id];render();
    }
    selectedId=null;$("actions").classList.add("hidden");$("selected").textContent="لم تحدد شخصًا";
    status(db?"تم الحذف":"تم الحذف محليًا");
  }catch(e){error("فشل الحذف: "+e.message)}
}

/* ---------- Layout ---------- */
function buildTree(){
  const ids=Object.keys(people);
  const coupleKey=id=>{
    const s=people[id]?.spouseId;
    return s&&people[s]?[id,s].sort().join("_"):id;
  };
  const units=new Map(),unitOf=new Map();
  ids.forEach(id=>{const k=coupleKey(id);if(!units.has(k))units.set(k,[]);units.get(k).push(id);unitOf.set(id,k)});
  const kids=new Map();units.forEach((_,k)=>kids.set(k,[]));
  const roots=[];
  units.forEach((members,k)=>{
    let parent=null;
    for(const id of members){
      const p=people[id],candidate=p.fatherId||p.motherId;
      if(candidate&&unitOf.has(candidate)){parent=unitOf.get(candidate);break;}
    }
    if(parent&&parent!==k)kids.get(parent).push(k);else roots.push(k);
  });

  const levels=[],seen=new Set();
  function walk(k,l){
    if(seen.has(k))return;seen.add(k);
    (levels[l]??=[]).push(k);
    (kids.get(k)||[]).forEach(ch=>walk(ch,l+1));
  }
  roots.forEach(k=>walk(k,0));
  units.forEach((_,k)=>{if(!seen.has(k))walk(k,0)});
  return{units,unitOf,kids,levels};
}

function render(){
  const ids=Object.keys(people);
  $("count").textContent=ids.length;
  if(!ids.length){
    $("generations").textContent=0;
    $("tree").innerHTML='<div class="empty"><div class="emoji">🌳</div><h2>ابدأ شجرتكم</h2><p>أضف أول شخص ثم ابنِ العلاقات.</p><button class="primary" id="emptyBtn">＋ إضافة أول شخص</button></div>';
    $("emptyBtn").onclick=()=>openAdd("root");return;
  }
  const T=buildTree();$("generations").textContent=T.levels.length;
  const UNIT_W=380,GAP=60,LEVEL_H=180;
  const W=Math.max(1250,...T.levels.map(a=>a.length*UNIT_W+(a.length-1)*GAP))+100;
  const H=Math.max(650,T.levels.length*LEVEL_H+180);
  const pos=new Map();let cards="";

  T.levels.forEach((level,l)=>{
    const total=level.length*UNIT_W+(level.length-1)*GAP,start=(W-total)/2;
    level.forEach((uk,i)=>{
      const x=start+i*(UNIT_W+GAP),y=55+l*LEVEL_H;pos.set(uk,{x,y});
      const members=T.units.get(uk);
      const parts=members.map(id=>{
        const p=people[id];
        return `<div class="half ${selectedId===id?"selected":""}" data-id="${id}">
          <div class="avatar">${p.gender==="female"?"👩":"👨"}</div>
          <div class="name">${esc(p.name)}</div><div class="meta">${p.birth?esc(p.birth):""}</div>
        </div>`;
      }).join("");
      cards+=`<div class="unit ${members.length===1?"single":""}" style="left:${x}px;top:${y}px;width:${UNIT_W}px">${parts}<button class="add" data-add="${members[0]}">＋</button></div>`;
    });
  });

  let svg=`<svg class="edges" width="${W}" height="${H}">`;
  T.kids.forEach((childUnits,parentUnit)=>{
    const P=pos.get(parentUnit);if(!P||!childUnits.length)return;
    const parentX=P.x+UNIT_W/2,parentY=P.y+100;
    const childCenters=childUnits.map(k=>{const q=pos.get(k);return{x:q.x+UNIT_W/2,y:q.y}});
    const branch=parentY+28;
    if(childCenters.length===1){
      const c=childCenters[0];svg+=`<path d="M${parentX} ${parentY} V${branch} H${c.x} V${c.y}"/>`;
    }else{
      const min=Math.min(...childCenters.map(c=>c.x)),max=Math.max(...childCenters.map(c=>c.x));
      svg+=`<path d="M${parentX} ${parentY} V${branch} M${min} ${branch} H${max}"/>`;
      childCenters.forEach(c=>svg+=`<path d="M${c.x} ${branch} V${c.y}"/>`);
    }
  });
  T.units.forEach((members,k)=>{
    if(members.length!==2)return;
    const q=pos.get(k);svg+=`<path class="marriage" d="M${q.x+180} ${q.y+50} H${q.x+200}"/>`;
  });
  svg+="</svg>";
  $("tree").innerHTML=`<div class="canvas" id="canvas" style="width:${W}px;height:${H}px">${svg}${cards}</div>`;
  applyZoom();

  document.querySelectorAll(".half").forEach(el=>el.onclick=()=>{
    selectedId=el.dataset.id;$("selected").textContent="المحدد: "+people[selectedId].name;$("actions").classList.remove("hidden");render();
  });
  document.querySelectorAll(".add").forEach(el=>el.onclick=e=>{
    e.stopPropagation();selectedId=el.dataset.add;$("selected").textContent="المحدد: "+people[selectedId].name;$("actions").classList.remove("hidden");openAdd("brother",selectedId);
  });
}

function applyZoom(){const c=$("canvas");if(c)c.style.transform=`scale(${zoom})`;$("zoomText").textContent=Math.round(zoom*100)+"%";}

$("newBtn").onclick=()=>openAdd("root");
$("save").onclick=saveNew;$("closePerson").onclick=closeModal;
$("editBtn").onclick=openEdit;$("deleteBtn").onclick=deletePerson;$("saveEdit").onclick=saveEdit;$("closeEdit").onclick=()=>$("editModal").classList.add("hidden");
document.querySelectorAll("[data-relation]").forEach(b=>b.onclick=()=>selectedId?openAdd(b.dataset.relation,selectedId):error("حدد شخصًا أولًا"));
$("plus").onclick=()=>{zoom=Math.min(1.5,zoom+.1);applyZoom()};$("minus").onclick=()=>{zoom=Math.max(.6,zoom-.1);applyZoom()};$("fit").onclick=()=>{zoom=1;applyZoom()};

if(configured){
  try{
    db=getDatabase(initializeApp(firebaseConfig));
    onValue(ref(db,`families/${familyId}`),snap=>{
      const data=snap.val()||{};
      people=data.people||{};
      $("familyTitle").textContent=data.title||"شجرتنا العائلية";
      status("متصل بـ Firebase");
      render();
    },e=>error("تعذر قراءة Firebase: "+e.message));
  }catch(e){error("إعداد Firebase غير صحيح: "+e.message)}
}else{
  status("وضع التجربة المحلية — أكمل Firebase في app.js");
  render();
}
