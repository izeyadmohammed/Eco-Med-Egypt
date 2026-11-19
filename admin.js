// إدارة المستشفيات (للمالك)
const list = document.querySelector("#hospitalsList");
const hospSearch = document.querySelector("#hospSearch");
const hospFilter = document.querySelector("#hospFilter");
const $ = id => document.getElementById(id);

let hospitals = [];
let reqStatsByHosp = {};
let targetHospId = null;

async function render() {
  const [{ data, error }, { data: reqs }] = await Promise.all([
    _supabase.from("hospitals").select("*").order("created_at", { ascending: false }),
    _supabase.from("requests").select("hospital_name, quantity")
  ]);

  if (error) {
    list.innerHTML = '<div class="empty-state error">تعذّر تحميل المستشفيات. تأكد من الاتصال وحدّث الصفحة.</div>';
    return;
  }

  reqStatsByHosp = {};
  (reqs || []).forEach(r => {
    if (!reqStatsByHosp[r.hospital_name]) reqStatsByHosp[r.hospital_name] = { count: 0, weight: 0 };
    reqStatsByHosp[r.hospital_name].count++;
    reqStatsByHosp[r.hospital_name].weight += Number(r.quantity || 0);
  });

  hospitals = data || [];
  $("hospTotal").textContent = hospitals.length;
  $("hospApproved").textContent = hospitals.filter(h => h.status === "approved").length;
  $("hospPending").textContent = hospitals.filter(h => h.status !== "approved").length;

  draw();
}

function draw() {
  const q = hospSearch.value.trim().toLowerCase();
  const st = hospFilter.value;

  const filtered = hospitals.filter(u => {
    const ok = u.status === "approved";
    const matchSt = st === "all" || (st === "approved" ? ok : !ok);
    const matchQ = !q ||
      (u.hospital_name || "").toLowerCase().includes(q) ||
      (u.phone || "").includes(q) ||
      (u.address || "").toLowerCase().includes(q);
    return matchSt && matchQ;
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">لا توجد مستشفيات مطابقة للبحث.</div>';
    return;
  }

  list.innerHTML = filtered.map(u => {
    const ok = u.status === "approved";
    const stInfo = reqStatsByHosp[u.hospital_name] || { count: 0, weight: 0 };
    return `<article class="hospital-card">
      <div class="hospital-info">
        <div class="hospital-head">
          <strong>🏥 ${esc(u.hospital_name)}</strong>
          <span class="status ${ok ? "status-arrived" : "status-pending"}">${ok ? "حساب مفعّل" : "في انتظار الموافقة"}</span>
        </div>
        <div class="hospital-meta">
          <span>📞 <a href="tel:${esc(u.phone)}" dir="ltr" class="ltr-inline">${esc(u.phone)}</a></span>
          <span class="hosp-address">📍 ${esc(u.address)}</span>
          <a href="${esc(safeUrl(u.location))}" target="_blank" rel="noopener noreferrer">🗺️ فتح على الخريطة ↗</a>
        </div>
        <div class="hospital-meta">
          <span>📦 الطلبات: <strong>${stInfo.count}</strong></span>
          <span>⚖️ إجمالي الأوزان: <strong>${stInfo.weight.toFixed(1)} كجم</strong></span>
        </div>
      </div>

      <div class="row-actions">
        ${u.tax_registry ? `<button class="button button-secondary button-sm" data-act="tax" data-id="${esc(u.id)}">📄 السجل الضريبي</button>` : ""}
        <button class="button ${ok ? "button-secondary" : "button-primary"} button-sm" data-act="status" data-id="${esc(u.id)}" data-to="${ok ? "pending" : "approved"}">
          ${ok ? "⏸️ إيقاف مؤقت" : "✅ تفعيل الحساب"}
        </button>
        <button class="button button-secondary button-sm" data-act="pass" data-id="${esc(u.id)}">🔑 كلمة المرور</button>
        <button class="button button-danger" data-act="del" data-id="${esc(u.id)}">🗑️ حذف</button>
      </div>
    </article>`;
  }).join("");
}

hospSearch.addEventListener("input", draw);
hospFilter.addEventListener("change", draw);

list.addEventListener("click", async e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const h = hospitals.find(x => String(x.id) === b.dataset.id);
  if (!h) return;

  if (b.dataset.act === "tax") {
    if (!h.tax_registry) return toast("لا توجد صورة للسجل الضريبي مسجلة", "warn");
    const win = window.open();
    win.document.write(`<html dir="rtl"><head><title>السجل الضريبي - ${esc(h.hospital_name)}</title></head><body style="background:#061820;color:#fff;text-align:center;font-family:sans-serif;padding:20px;"><h2>السجل الضريبي للمستشفى: ${esc(h.hospital_name)}</h2><hr style="border-color:#194352;margin:20px 0;"><img src="${h.tax_registry}" style="max-width:100%;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);"></body></html>`);
    return;
  }

  if (b.dataset.act === "del") {
    if (!confirm(`سيتم حذف حساب "${h.hospital_name}" وجميع طلباته نهائياً. هل أنت متأكد؟`)) return;
    const r1 = await _supabase.from("requests").delete().eq("hospital_name", h.hospital_name);
    const res = r1.error ? r1 : await _supabase.from("hospitals").delete().eq("id", h.id);
    if (res.error) return toast("تعذّر حذف الحساب", "error");
    toast("تم حذف الحساب بنجاح", "info");
    render();
  } else if (b.dataset.act === "status") {
    const res = await _supabase.from("hospitals").update({ status: b.dataset.to }).eq("id", b.dataset.id);
    if (res.error) return toast("تعذّر تحديث حالة الحساب", "error");
    toast(b.dataset.to === "approved" ? "تم تفعيل حساب المستشفى" : "تم إيقاف الحساب", "success");
    render();
  } else if (b.dataset.act === "pass") {
    targetHospId = h.id;
    $("passModalTitle").textContent = "تغيير كلمة المرور — " + h.hospital_name;
    $("newPassInput").value = "";
    $("passModal").hidden = false;
  }
});

$("closePassModal").onclick = () => { $("passModal").hidden = true; };
$("passModal").addEventListener("click", e => {
  if (e.target.id === "passModal") $("passModal").hidden = true;
});

$("passForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!targetHospId) return;
  const p = $("newPassInput").value.trim();
  if (p.length < 6) return toast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "warn");
  const { error } = await _supabase.from("hospitals").update({ password: p }).eq("id", targetHospId);
  if (error) return toast("تعذّر تغيير كلمة المرور", "error");
  toast("تم تحديث كلمة المرور بنجاح", "success");
  $("passModal").hidden = true;
});

render();
