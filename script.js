// لوحة المالك: التحليلات وإدارة جميع الطلبات لحظياً
const body = document.querySelector("#requestsBody");
const filter = document.querySelector("#statusFilter");
const priorityFilter = document.querySelector("#priorityFilter");
const searchInput = document.querySelector("#searchInput");
const empty = document.querySelector("#emptyState");
const $ = id => document.getElementById(id);

let all = [];
let hospitalMap = {};

const NEXT_STATUS = {
  pending: { to: "transit", label: "🚚 بدء النقل" },
  transit: { to: "arrived", label: "🏭 تأكيد الوصول" },
  arrived: { to: "closed", label: "✅ إغلاق الطلب" }
};

async function loadHospitalsMeta() {
  const { data } = await _supabase.from("hospitals").select("*");
  if (!data) return;
  hospitalMap = {};
  let pendingHosp = 0;
  data.forEach(h => {
    hospitalMap[h.hospital_name] = h;
    if (h.status !== "approved") pendingHosp++;
  });
  $("activeHospCount").textContent = data.filter(h => h.status === "approved").length;
  const badge = $("pendingHospBadge");
  if (pendingHosp > 0) {
    badge.hidden = false;
    badge.textContent = pendingHosp;
  } else {
    badge.hidden = true;
  }
}

async function load(silent = false) {
  await loadHospitalsMeta();
  const { data, error } = await _supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      empty.hidden = false;
      empty.classList.add("error");
      empty.textContent = "تعذّر تحميل الطلبات. تأكد من الاتصال وحدّث الصفحة.";
    }
    return;
  }
  all = data || [];
  drawCharts();
  draw();
}

function drawCharts() {
  const totalW = all.reduce((s, r) => s + Number(r.quantity || 0), 0);

  // 1. توزيع الأوزان حسب نوع المخلفات
  const byWaste = {};
  all.forEach(r => {
    const k = r.waste_type || "general";
    byWaste[k] = (byWaste[k] || 0) + Number(r.quantity || 0);
  });
  const wasteEntries = Object.entries(byWaste).sort((a, b) => b[1] - a[1]);
  $("wasteChart").innerHTML = wasteEntries.length
    ? wasteEntries.map(([k, w]) => {
        const pct = totalW ? Math.round((w / totalW) * 100) : 0;
        const icon = WASTE_ICONS[k] || "♻️";
        return `<div>
          <div class="bar-item-head">
            <span>${icon} ${esc(WASTE[k] || k)}</span>
            <span>${w.toFixed(1)} كجم (${pct}%)</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join("")
    : '<p class="empty-state" style="padding:16px">لا توجد بيانات كافية للتحليل بعد.</p>';

  // 2. أكثر المستشفيات نشاطاً
  const byHosp = {};
  all.forEach(r => {
    const h = r.hospital_name || "غير محدد";
    byHosp[h] = (byHosp[h] || 0) + Number(r.quantity || 0);
  });
  const hospEntries = Object.entries(byHosp).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxH = hospEntries.length ? hospEntries[0][1] : 0;
  $("hospitalChart").innerHTML = hospEntries.length
    ? hospEntries.map(([name, w]) => {
        const pct = maxH ? Math.round((w / maxH) * 100) : 0;
        return `<div>
          <div class="bar-item-head">
            <span>🏥 ${esc(name)}</span>
            <span>${w.toFixed(1)} كجم</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>`;
      }).join("")
    : '<p class="empty-state" style="padding:16px">لا توجد بيانات مستشفيات بعد.</p>';
}

function draw() {
  $("totalRequests").textContent = all.length;
  $("pendingRequests").textContent = all.filter(r => r.status === "pending").length;
  $("urgentCount").textContent = all.filter(r => r.status === "pending" && r.priority === "high").length;
  $("transitRequests").textContent = all.filter(r => r.status === "transit" || r.status === "arrived").length;
  $("completedCount").textContent = all.filter(r => r.status === "closed").length;
  $("totalWeight").textContent = all.reduce((s, r) => s + Number(r.quantity || 0), 0).toFixed(1);

  const q = searchInput.value.trim().toLowerCase();
  const st = filter.value;
  const pr = priorityFilter.value;

  const rows = all.filter(r => {
    const matchSt = st === "all" || r.status === st;
    const matchPr = pr === "all" || (r.priority || "normal") === pr;
    const code = reqCode(r.id).toLowerCase();
    const hosp = (r.hospital_name || "").toLowerCase();
    const notes = (r.notes || "").toLowerCase();
    const matchQ = !q || code.includes(q) || hosp.includes(q) || notes.includes(q);
    return matchSt && matchPr && matchQ;
  });

  empty.hidden = rows.length > 0;
  empty.classList.remove("error");
  empty.textContent = all.length ? "لا توجد طلبات مطابقة لخيارات البحث." : "لا توجد طلبات من المستشفيات حتى الآن.";

  body.innerHTML = rows.map(r => {
    const h = hospitalMap[r.hospital_name];
    const next = NEXT_STATUS[r.status];
    const icon = WASTE_ICONS[r.waste_type] || "♻️";
    return `<tr>
      <td data-label="رقم الطلب"><span class="request-id">${esc(reqCode(r.id))}</span></td>
      <td data-label="المستشفى والموقع">
        <strong>${esc(r.hospital_name)}</strong>
        ${h ? `<div style="font-size:12px; color:var(--muted);">
          <a href="${esc(safeUrl(h.location))}" target="_blank" rel="noopener">📍 الخريطة</a> •
          <a href="tel:${esc(h.phone)}">📞 ${esc(h.phone)}</a>
        </div>` : ""}
      </td>
      <td data-label="التصنيف والكمية">
        ${icon} ${esc(WASTE[r.waste_type] || r.waste_type)} — <strong>${esc(r.quantity)} كجم</strong>
        ${r.priority === "high" ? '<span class="tag-high">عاجل</span>' : ""}
        ${r.notes ? `<span class="note-preview">${esc(r.notes)}</span>` : ""}
      </td>
      <td data-label="التوقيت"><small style="color:var(--muted)">${esc(fmtDate(r.created_at))}</small></td>
      <td data-label="الحالة"><span class="status status-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span></td>
      <td data-label="إجراءات سريعة">
        <div class="row-tools">
          ${next ? `<button type="button" class="button button-primary button-sm" data-step="${esc(r.id)}" data-to="${next.to}">${next.label}</button>` : ""}
          <select data-id="${esc(r.id)}" aria-label="تغيير الحالة">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${v}</option>`).join("")}
          </select>
          <button type="button" class="button button-secondary button-sm" data-info="${esc(r.id)}" title="التفاصيل">👁️</button>
          <button type="button" class="button button-danger" data-del="${esc(r.id)}" title="حذف">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

async function updateStatus(id, newStatus) {
  const { error } = await _supabase.from("requests").update({ status: newStatus }).eq("id", id);
  if (error) return toast("تعذّر تحديث حالة الطلب", "error");
  toast("تم تحديث الحالة إلى: " + (STATUS[newStatus] || newStatus), "success");
  load(true);
}

filter.addEventListener("change", draw);
priorityFilter.addEventListener("change", draw);
searchInput.addEventListener("input", draw);

body.addEventListener("change", e => {
  const s = e.target.closest("select[data-id]");
  if (s) updateStatus(s.dataset.id, s.value);
});

body.addEventListener("click", async e => {
  const stepBtn = e.target.closest("button[data-step]");
  if (stepBtn) return updateStatus(stepBtn.dataset.step, stepBtn.dataset.to);

  const infoBtn = e.target.closest("button[data-info]");
  if (infoBtn) {
    const r = all.find(x => String(x.id) === infoBtn.dataset.info);
    if (!r) return;
    const h = hospitalMap[r.hospital_name] || {};
    $("ownerModalTitle").textContent = "تفاصيل الطلب — " + reqCode(r.id);
    $("ownerModalBody").innerHTML = `
      <div class="detail-grid">
        <div class="detail-box"><span>المستشفى</span><strong>${esc(r.hospital_name)}</strong></div>
        <div class="detail-box"><span>رقم الهاتف</span><strong>${esc(h.phone || "—")}</strong></div>
        <div class="detail-box"><span>العنوان</span><strong>${esc(h.address || "—")}</strong></div>
        <div class="detail-box"><span>الموقع الجغرافي</span><strong>${h.location ? `<a href="${esc(safeUrl(h.location))}" target="_blank">فتح الخريطة ↗</a>` : "—"}</strong></div>
        <div class="detail-box"><span>نوع المخلفات</span><strong>${esc(WASTE[r.waste_type] || r.waste_type)}</strong></div>
        <div class="detail-box"><span>الكمية والأولوية</span><strong>${esc(r.quantity)} كجم (${r.priority === "high" ? "عاجلة" : "عادية"})</strong></div>
      </div>
      <div class="detail-box">
        <span>ملاحظات المستشفى</span>
        <strong>${esc(r.notes || "لا توجد ملاحظات")}</strong>
      </div>
    `;
    $("ownerModal").hidden = false;
    return;
  }

  const delBtn = e.target.closest("button[data-del]");
  if (delBtn) {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب نهائياً؟")) return;
    const { error } = await _supabase.from("requests").delete().eq("id", delBtn.dataset.del);
    if (error) return toast("تعذّر حذف الطلب", "error");
    toast("تم حذف الطلب", "info");
    load(true);
  }
});

$("closeOwnerModal").onclick = () => { $("ownerModal").hidden = true; };
$("ownerModal").addEventListener("click", e => {
  if (e.target.id === "ownerModal") $("ownerModal").hidden = true;
});

$("exportAllBtn").onclick = () => {
  if (!all.length) return toast("لا توجد بيانات لتصديرها", "warn");
  exportCSV(
    `EcoMed-All-Requests-${new Date().toISOString().slice(0, 10)}.csv`,
    ["رقم الطلب", "المستشفى", "نوع المخلفات", "الكمية (كجم)", "الأولوية", "الحالة", "التوقيت", "ملاحظات"],
    all.map(r => [
      reqCode(r.id),
      r.hospital_name,
      WASTE[r.waste_type] || r.waste_type,
      r.quantity,
      r.priority === "high" ? "عاجلة" : "عادية",
      STATUS[r.status] || r.status,
      fmtDate(r.created_at),
      r.notes || ""
    ])
  );
};

// الاستماع اللحظي للطلبات الجديدة من المستشفيات (مع دعم التحديث الدوري كبديل آمن)
try {
  if (window.WebSocket && location.protocol.startsWith("http")) {
    _supabase
      .channel("owner-requests-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "requests" }, payload => {
        toast(`طلب جديد من ${payload.new.hospital_name} (${payload.new.quantity} كجم)`, "warn", 5000);
        load(true);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "requests" }, () => load(true))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "requests" }, () => load(true))
      .subscribe();
  }
} catch (e) {
  setInterval(() => load(true), 8000);
}

load();
