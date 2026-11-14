// تسجيل الدخول وإنشاء حساب مستشفى
const ADMIN_PHONE = "01126346329";
const ADMIN_PASSWORD = "66112009";

const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const msg = document.querySelector("#message");

function showMsg(text, isError) {
  msg.textContent = text;
  msg.classList.toggle("error", !!isError);
}
function homeFor(u) { return u.role === "owner" ? "dashboard.html" : "hospital.html"; }

// زر إظهار/إخفاء كلمة المرور
const togglePass = document.querySelector("#togglePass");
if (togglePass) {
  togglePass.addEventListener("click", () => {
    const inp = document.querySelector("#password");
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    togglePass.textContent = show ? "🙈" : "👁️";
  });
}

// زر تحديد الموقع الحالي GPS في صفحة التسجيل
const detectGpsBtn = document.querySelector("#detectGpsBtn");
if (detectGpsBtn) {
  detectGpsBtn.addEventListener("click", () => {
    if (!navigator.geolocation) return showMsg("المتصفح لا يدعم تحديد الموقع الجغرافي.", true);
    detectGpsBtn.disabled = true;
    detectGpsBtn.textContent = "⏳";
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        registerForm.location.value = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        detectGpsBtn.disabled = false;
        detectGpsBtn.textContent = "📍 موقعي";
        toast("تم تحديد إحداثيات الموقع بنجاح", "success");
      },
      () => {
        detectGpsBtn.disabled = false;
        detectGpsBtn.textContent = "📍 موقعي";
        showMsg("تعذّر الوصول للموقع. تأكد من تفعيل الـ GPS أو الصق الرابط يدوياً.", true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

if (loginForm) {
  const already = getUser();
  if (already) location.replace(homeFor(already));

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = loginForm.querySelector("button[type=submit]");
    const phone = loginForm.phone.value.trim();
    const password = loginForm.password.value;
    btn.disabled = true;
    showMsg("جاري التحقق من البيانات...");
    try {
      let user;
      if (phone === ADMIN_PHONE && password === ADMIN_PASSWORD) {
        user = { phone, name: "إدارة النظام", role: "owner" };
      } else {
        const { data, error } = await _supabase
          .from("hospitals")
          .select("*")
          .eq("phone", phone)
          .eq("password", password)
          .maybeSingle();
        if (error) throw error;
        if (!data) return showMsg("رقم الهاتف أو كلمة المرور غير صحيحة.", true);
        if (data.status !== "approved") return showMsg("حساب المستشفى لا يزال قيد المراجعة والتفعيل من الإدارة.", true);
        user = {
          id: data.id,
          phone: data.phone,
          name: data.hospital_name,
          address: data.address,
          location: data.location,
          role: "hospital"
        };
      }
      localStorage.setItem("ecoMedUser", JSON.stringify(user));
      location.href = homeFor(user);
    } catch (err) {
      console.error(err);
      showMsg("مشكلة في الاتصال بالخادم. حاول مرة أخرى.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = registerForm.querySelector("button[type=submit]");
    const f = registerForm;
    const fileInput = f.taxRegistry;
    
    if (!fileInput.files || !fileInput.files[0]) {
      return showMsg("يرجى رفع صوره السجل الضريبي.", true);
    }

    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      return showMsg("حجم الصورة كبير جداً. الحد الأقصى هو 5 ميجابايت.", true);
    }

    btn.disabled = true;
    showMsg("جاري قراءة الملف ورفع البيانات...");

    const reader = new FileReader();
    reader.onload = async function(event) {
      const base64Image = event.target.result;
      const row = {
        hospital_name: f.hospitalName.value.trim(),
        phone: f.phone.value.trim(),
        password: f.password.value,
        address: f.address.value.trim(),
        location: f.location.value.trim(),
        tax_registry: base64Image,
        status: "pending"
      };

      if (row.phone === ADMIN_PHONE) {
        btn.disabled = false;
        return showMsg("رقم الهاتف هذا غير متاح للتسجيل.", true);
      }
      if (!/^01[0125][0-9]{8}$/.test(row.phone)) {
        btn.disabled = false;
        return showMsg("أدخل رقم هاتف مصري صحيح مكون من 11 رقم.", true);
      }
      if (!/^https?:\/\//i.test(row.location)) {
        btn.disabled = false;
        return showMsg("رابط الموقع يجب أن يبدأ بـ https://", true);
      }

      try {
        const byPhone = await _supabase.from("hospitals").select("id").eq("phone", row.phone).limit(1);
        if (byPhone.error) throw byPhone.error;
        if (byPhone.data.length) {
          btn.disabled = false;
          return showMsg("رقم الهاتف مسجّل بالفعل لمستشفى أخرى.", true);
        }

        const byName = await _supabase.from("hospitals").select("id").eq("hospital_name", row.hospital_name).limit(1);
        if (byName.error) throw byName.error;
        if (byName.data.length) {
          btn.disabled = false;
          return showMsg("اسم المستشفى مسجّل بالفعل.", true);
        }

        // إدخال البيانات في جدول hospitals
        const { error } = await _supabase.from("hospitals").insert([row]);
        if (error) {
          // عرض الخطأ البرمجي الحقيقي القادم من Supabase لتشخيصه بدقة
          console.error("Supabase Insert Error:", error);
          throw new Error(error.message || error.details || "خطأ غير معروف في قاعدة البيانات");
        }

        showMsg("تم إنشاء الحساب بنجاح! في انتظار موافقة الإدارة لتفعيله.");
        toast("تم إرسال طلب تسجيل المستشفى", "success");
        registerForm.reset();
      } catch (err) {
        console.error("Registration Exception:", err);
        // عرض رسالة الخطأ الحقيقية للمستخدم على الشاشة
        showMsg("خطأ أثناء التسجيل: " + (err.message || JSON.stringify(err)), true);
      } finally {
        btn.disabled = false;
      }
    };
    reader.onerror = () => {
      btn.disabled = false;
      showMsg("فشل قراءة ملف الصورة.", true);
    };
    reader.readAsDataURL(file);
  });
}
