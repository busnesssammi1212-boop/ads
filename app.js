(() => {
 const $ = id => document.getElementById(id);
 const cfg = window.TECHNEX_CONFIG || {};
 const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
   !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
 const supabase = ready && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
 let items = [], filter = "all", channel = null;
 $("year").textContent = new Date().getFullYear();
 const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const toast = msg => { $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),3000); };
 const message = (id, text, error=false) => { $(id).textContent=text; $(id).classList.toggle("error",error); };
 function card(x) {
   const url = safeUrl(x.destination_url);
   return `<article class="offer-card"><div class="card-top"><span class="pill ${x.type==="task"?"pill-task":"pill-offer"}">${x.type==="task"?"TASK":"OFFER"}</span><span class="card-date">${new Date(x.created_at).toLocaleDateString()}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><div class="card-bottom">${x.reward?`<span class="reward">✦ ${esc(x.reward)}</span>`:"<span></span>"}${url?`<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.button_label||"View details")} ↗</a>`:""}</div></article>`;
 }
 function safeUrl(raw) { try { const u=new URL(raw); return ["https:","http:"].includes(u.protocol)?u.href:""; } catch { return ""; } }
 function render() {
   const q=$("searchInput").value.trim().toLowerCase();
   const shown=items.filter(x=>(filter==="all"||x.type===filter)&&`${x.title} ${x.description} ${x.reward||""}`.toLowerCase().includes(q));
   $("offerCount").textContent=items.length;
   $("offerGrid").innerHTML=shown.map(card).join("");
   $("status").textContent = !supabase ? "Setup needed: add your Supabase project URL and anon/publishable key in config.js, then run the SQL in README." :
     shown.length ? `${shown.length} item${shown.length===1?"":"s"} available` : "No items found yet. Check back soon.";
   $("status").classList.toggle("hidden", !!shown.length);
 }
 async function loadItems() {
   if(!supabase){items=[];render();return;}
   const {data,error}=await supabase.from("offers").select("id,title,description,type,reward,destination_url,button_label,created_at").eq("status","published").order("created_at",{ascending:false});
   if(error){$("status").textContent="Could not load offers. Check the Supabase setup and table policies."; $("status").classList.remove("hidden"); return;}
   items=data||[];render();
 }
 function subscribe() {
   if(!supabase)return;
   channel=supabase.channel("public-offers-live").on("postgres_changes",{event:"*",schema:"public",table:"offers"},()=>loadItems()).subscribe();
 }
 function openModal(){ $("adminModal").classList.remove("hidden"); refreshAuth(); }
 function closeModal(){ $("adminModal").classList.add("hidden"); }
 $("adminOpen").addEventListener("click",openModal);
 document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeModal));
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
 $("refreshBtn").addEventListener("click",loadItems);
 $("searchInput").addEventListener("input",render);
 document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));render();}));
 async function refreshAuth(){
   if(!supabase){$("loginMessage").textContent="Set up Supabase in config.js first.";return;}
   const {data}=await supabase.auth.getSession();
   showAdmin(data.session?.user||null);
 }
 function showAdmin(user){$("loginPane").classList.toggle("hidden",!!user);$("dashboardPane").classList.toggle("hidden",!user);if(user){$("adminUser").textContent=user.email||"Admin";loadAdminItems();}}
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();message("loginMessage","Signing in…");const {data,error}=await supabase.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error){message("loginMessage",error.message,true);return;}message("loginMessage","");showAdmin(data.user);});
 $("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();showAdmin(null);toast("Signed out.");});
 function resetForm(){ $("offerForm").reset();$("editId").value="";$("offerButton").value="View details";$("saveOffer").textContent="Publish item";$("cancelEdit").classList.add("hidden"); }
 $("cancelEdit").addEventListener("click",resetForm);
 $("offerForm").addEventListener("submit",async e=>{
  e.preventDefault();message("adminMessage","Saving…");
  const id=$("editId").value;
  const payload={title:$("offerTitle").value.trim(),type:$("offerType").value,reward:$("offerReward").value.trim()||null,description:$("offerDescription").value.trim(),destination_url:$("offerUrl").value.trim()||null,status:$("offerStatus").value,button_label:$("offerButton").value.trim()||"View details",updated_at:new Date().toISOString()};
  if(payload.destination_url&&!safeUrl(payload.destination_url)){message("adminMessage","Use a valid http:// or https:// URL.",true);return;}
  const query=id?supabase.from("offers").update(payload).eq("id",id):supabase.from("offers").insert(payload);
  const {error}=await query;
  if(error){message("adminMessage",error.message,true);return;}
  message("adminMessage",id?"Item updated.":"Item saved.");resetForm();await loadAdminItems();await loadItems();
 });
 async function loadAdminItems(){
   const {data,error}=await supabase.from("offers").select("*").order("created_at",{ascending:false});
   if(error){$("adminList").innerHTML=`<p class="form-message error">Unable to load admin items. Check admin policies in README.</p>`;return;}
   $("adminList").innerHTML=(data||[]).map(x=>`<div class="admin-item"><div><strong>${esc(x.title)}</strong><small>${esc(x.type)} · ${esc(x.status)}</small></div><div class="admin-item-actions"><button class="mini-btn" data-edit="${esc(x.id)}">Edit</button><button class="mini-btn danger" data-delete="${esc(x.id)}">Delete</button></div></div>`).join("")||"<p class='subcopy'>No items yet. Add your first task above.</p>";
   $("adminList").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const x=data.find(y=>y.id===b.dataset.edit);if(!x)return;$("editId").value=x.id;$("offerTitle").value=x.title;$("offerType").value=x.type;$("offerReward").value=x.reward||"";$("offerDescription").value=x.description;$("offerUrl").value=x.destination_url||"";$("offerStatus").value=x.status;$("offerButton").value=x.button_label||"View details";$("saveOffer").textContent="Save changes";$("cancelEdit").classList.remove("hidden");$("offerForm").scrollIntoView({behavior:"smooth",block:"start"});}));
   $("adminList").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this item permanently?"))return;const {error}=await supabase.from("offers").delete().eq("id",b.dataset.delete);if(error){toast("Delete failed: "+error.message);return;}toast("Item deleted.");await loadAdminItems();await loadItems();}));
 }
 if(supabase){supabase.auth.onAuthStateChange(()=>refreshAuth());}
 loadItems();subscribe();
})();