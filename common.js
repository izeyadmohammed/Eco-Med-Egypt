// common.js — الثيم + الحماية + الإشعارات + دوال مساعدة (يتحمّل في <head>)
(function () {
  const root = document.documentElement;
  const sys = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset.theme = localStorage.getItem("ecoTheme") || sys;
})();

window.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

window.safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "#");

window.getUser = () => {
  try { return JSON.parse(localStorage.getItem("ecoMedUser")); }
  catch { return null; }
};

window.WASTE = {
  glass: "زجاج طبي",
  pharmaceutical: "أدوية منتهية الصلاحية",
  chemical: "مخلفات كيميائية",
  supplies: "مستلزمات طبية",
  infectious: "مخلفات معدية",
  sharps: "أدوات حادة ملوثة",
  general: "مخلفات عامة"
};

window.WASTE_ICONS = {
  glass: "🧪",
  pharmaceutical: "💊",
  chemical: "⚗️",
  supplies: "🩺",
  infectious: "☣️",
  sharps: "💉",
  general: "🗑️"
};

window.STATUS = {
  pending: "في انتظار النقل",
  transit: "قيد النقل",
  arrived: "وصلت للمنشأة",
  closed: "تم الانتهاء"
};

window.STATUS_STEP = { pending: 1, transit: 2, arrived: 3, closed: 4 };

window.fmtDate = iso => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) +
      " • " + d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

window.reqCode = id => "EM-" + String(id ?? "").slice(0, 6).toUpperCase();

// نظام إشعارات Toast احترافي
window.toast = (msg, type = "info", duration = 3600) => {
  let box = document.getElementById("toastContainer");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastContainer";
    box.className = "toast-container";
    document.body.appendChild(box);
  }
  const icons = { success: "✅", error: "⚠️", info: "♻️", warn: "🔔" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || "♻️"}</span><span class="toast-text">${esc(msg)}</span>`;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, duration);
};

// تصدير البيانات إلى ملف CSV يدعم العربية (UTF-8 BOM)
window.exportCSV = (filename, headers, rows) => {
  const escapeCell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows.map(r => r.map(escapeCell).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("تم تحميل ملف التقرير بنجاح", "success");
};

// حماية الصفحة حسب الدور: <script src="common.js" data-role="owner">
(function () {
  const need = document.currentScript && document.currentScript.dataset.role;
  if (!need) return;
  const u = getUser();
  if (!u || u.role !== need) {
    location.replace(u ? (u.role === "owner" ? "dashboard.html" : "hospital.html") : "index.html");
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const actions = document.querySelector(".topbar-actions");

  // زر تبديل الوضع النهاري/الليلي
  if (!document.querySelector(".theme-toggle")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle" + (actions ? "" : " floating");
    const paint = () => {
      const light = root.dataset.theme === "light";
      btn.textContent = light ? "🌙" : "☀️";
      btn.title = btn.ariaLabel = light ? "تفعيل الوضع الليلي" : "تفعيل الوضع النهاري";
    };
    btn.onclick = () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      localStorage.setItem("ecoTheme", root.dataset.theme);
      paint();
    };
    paint();
    actions ? actions.prepend(btn) : document.body.appendChild(btn);
  }

  // عرض اسم المستخدم وشارته في الهيدر
  const u = getUser();
  if (u && actions) {
    const tag = document.createElement("span");
    tag.className = "topbar-user";
    tag.innerHTML = `<span class="user-dot"></span><span>${esc(u.name)}</span>`;
    actions.prepend(tag);
  }

  // زر تسجيل الخروج
  const out = document.querySelector("#logoutBtn");
  if (out) {
    out.onclick = () => {
      localStorage.removeItem("ecoMedUser");
      location.href = "index.html";
    };
  }
});
