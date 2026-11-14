// إعدادات الاتصال بـ Supabase
const SUPABASE_URL = "https://mebuzelncdmasqaxiqmx.supabase.co";
const SUPABASE_KEY = "sb_publishable_FhYEEsORc_fNsSbcxs5bzw_OErC_Yrp";

// إنشاء عميل الاتصال
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
