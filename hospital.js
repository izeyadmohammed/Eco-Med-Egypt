// لوحة المستشفى: إدارة الطلبات والتتبع اللحظي
const me = getUser() || {};
const $ = id => document.getElementById(id);
$("welcomeTitle").textContent = "أهلاً، " + (me.name || "");

const body = $("requestsBody");
const empty = $("emptyState");
const form = $("requestForm");
const msg = $("formMessage");
const searchInput = $("searchInput");
const statusFilter = $("statusFilter");

let myRequests = [];
let selectedReq = null;

function renderStepper(status) {
  const step = STATUS_STEP[status] || 1;
  const isFinal = status === "closed";
  return `<div class="stepper" title="${esc(STATUS[status] || status)}">
    ${[1, 2, 3, 4].map(n => `<span class="step-dot ${n <= step ? "done" : ""} ${isFinal ? "final" : ""}"></span>`).join("")}
  </div>`;
}

function draw() {
  $("myTotal").textContent = myRequests.length;
  $("myPending").textContent = myRequests.filter(r => r.status === "pending").length;
  $("myTransit").textContent = myRequests.filter(r => r.status === "transit" || r.status === "arrived").length;
  $("myWeight").textContent = myRequests.reduce((s, r) => s + Number(r.quantity || 0), 0).toFixed(1);

  const q = searchInput.value.trim().toLowerCase();
  const st = statusFilter.value;

  const filtered = myRequests.filter(r => {
    const matchSt = st === "all" || r.status === st;
    const code = reqCode(r.id).toLowerCase();
    const waste = (WASTE[r.waste_type] || r.waste_type || "").toLowerCase();
    const notes = (r.notes || "").toLowerCase();
    const matchQ = !q || code.includes(q) || waste.includes(q) || notes.includes(q);
    return matchSt && matchQ;
  });

  empty.hidden = filtered.length > 0;
  empty.classList.remove("error");
  empty.textContent = myRequests.length ? "لا توجد طلبات مطابقة للبحث أو التصفية." : "لا توجد طلبات مسجلة بعد. أرسل أول طلب من النموذج الجانبي.";

  body.innerHTML = filtered.map(r => {
    const icon = WASTE_ICONS[r.waste_type] || "♻️";
    return `<tr>
      <td data-label="رقم الطلب"><span class="request-id">${esc(reqCode(r.id))}</span></td>
      <td data-label="التصنيف والكمية">
        <div class="cell-val">
          <strong>${icon} ${esc(WASTE[r.waste_type] || r.waste_type)}</strong> — ${esc(r.quantity)} كجم
          ${r.priority === "high" ? '<span class="tag-high">عاجل</span>' : ""}
          ${r.notes ? `<span class="note-preview">${esc(r.notes)}</span>` : ""}
        </div>
      </td>
      <td data-label="تاريخ الطلب"><small class="cell-date">${esc(fmtDate(r.created_at))}</small></td>
      <td data-label="حالة المسار">
        <div class="status-cell">
          <span class="status status-${esc(r.status)}">${esc(STATUS[r.status] || r.status)}</span>
          ${renderStepper(r.status)}
        </div>
      </td>
      <td data-label="التفاصيل" class="td-actions">
        <button type="button" class="button button-secondary button-sm" data-view="${esc(r.id)}">📄 الإيصال</button>
      </td>
    </tr>`;
  }).join("");
}

async function load(silent = false) {
  const { data, error } = await _supabase
    .from("requests")
    .select("*")
    .eq("hospital_name", me.name)
    .order("created_at", { ascending: false });

  if (error) {
    if (!silent) {
      empty.hidden = false;
      empty.classList.add("error");
      empty.textContent = "تعذّر تحميل الطلبات. تأكد من الاتصال بالإنترنت.";
    }
    return;
  }
  myRequests = data || [];
  draw();
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  const payload = {
    hospital_name: me.name,
    waste_type: $("wasteType").value,
    quantity: Number($("quantity").value),
    priority: $("priority").value,
    notes: $("notes").value.trim(),
    status: "pending"
  };
  const { error } = await _supabase.from("requests").insert([payload]);
  btn.disabled = false;
  msg.classList.toggle("error", !!error);
  msg.textContent = error ? "تعذّر إرسال الطلب. حاول مرة أخرى." : "تم إرسال الطلب بنجاح!";
  if (!error) {
    toast("تم تسجيل طلب التخلص بنجاح", "success");
    form.reset();
    load(true);
  }
});

// فتح نافذة تفاصيل الطلب وإيصال التسليم
body.addEventListener("click", e => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;
  const r = myRequests.find(x => String(x.id) === btn.dataset.view);
  if (!r) return;
  selectedReq = r;
  $("modalTitle").textContent = "إيصال طلب نقل مخلفات طبية — " + reqCode(r.id);
  $("printManifestArea").innerHTML = `
    <div style="text-align:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px dashed var(--line);">
      <strong style="font-size:18px; color:var(--accent);">♻ Eco Med Egypt</strong>
      <div style="font-size:12px; color:var(--muted);">وثيقة تتبع وتسليم مخلفات طبية خطرة</div>
    </div>
    <div class="detail-grid">
      <div class="detail-box"><span>رقم المرجع</span><strong>${esc(reqCode(r.id))}</strong></div>
      <div class="detail-box"><span>حالة الطلب</span><strong>${esc(STATUS[r.status] || r.status)}</strong></div>
      <div class="detail-box"><span>الجهة المولّدة (المستشفى)</span><strong>${esc(r.hospital_name)}</strong></div>
      <div class="detail-box"><span>تاريخ الإنشاء</span><strong>${esc(fmtDate(r.created_at))}</strong></div>
      <div class="detail-box"><span>تصنيف المخلفات</span><strong>${esc(WASTE[r.waste_type] || r.waste_type)}</strong></div>
      <div class="detail-box"><span>الكمية / الوزن</span><strong>${esc(r.quantity)} كجم (${r.priority === "high" ? "عاجل" : "عادي"})</strong></div>
    </div>
    <div class="detail-box" style="margin-bottom:10px;">
      <span>ملاحظات التسليم</span>
      <strong>${esc(r.notes || "لا توجد ملاحظات إضافية")}</strong>
    </div>
    <div style="font-size:11.5px; color:var(--muted); text-align:center; margin-top:10px;">
      تم إصدار هذه الوثيقة إلكترونياً عبر منصة Eco Med Egypt
    </div>
  `;
  const cancelBtn = $("cancelPendingBtn");
  cancelBtn.hidden = r.status !== "pending";
  $("detailModal").hidden = false;
});

$("closeModalBtn").onclick = () => { $("detailModal").hidden = true; };
$("detailModal").addEventListener("click", e => {
  if (e.target.id === "detailModal") $("detailModal").hidden = true;
});

$("cancelPendingBtn").onclick = async () => {
  if (!selectedReq || selectedReq.status !== "pending") return;
  if (!confirm("هل تريد إلغاء هذا الطلب نهائياً؟")) return;
  const { error } = await _supabase.from("requests").delete().eq("id", selectedReq.id);
  if (error) return toast("تعذّر إلغاء الطلب", "error");
  toast("تم إلغاء الطلب بنجاح", "info");
  $("detailModal").hidden = true;
  load(true);
};

$("exportHospitalBtn").onclick = () => {
  if (!myRequests.length) return toast("لا توجد بيانات لتصديرها", "warn");
  exportCSV(
    `EcoMed-${me.name || "Hospital"}-Report.csv`,
    ["رقم الطلب", "نوع المخلفات", "الكمية (كجم)", "الأولوية", "الحالة", "تاريخ الطلب", "ملاحظات"],
    myRequests.map(r => [
      reqCode(r.id),
      WASTE[r.waste_type] || r.waste_type,
      r.quantity,
      r.priority === "high" ? "عاجلة" : "عادية",
      STATUS[r.status] || r.status,
      fmtDate(r.created_at),
      r.notes || ""
    ])
  );
};

searchInput.addEventListener("input", draw);
statusFilter.addEventListener("change", draw);

// تحديث لحظي تلقائي عند تغيير حالة الطلب من المالك (مع دعم التحديث الدوري كبديل آمن)
try {
  if (window.WebSocket && location.protocol.startsWith("http")) {
    _supabase
      .channel("hospital-requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => load(true))
      .subscribe();
  }
} catch (e) {
  setInterval(() => load(true), 8000);
}

load();
