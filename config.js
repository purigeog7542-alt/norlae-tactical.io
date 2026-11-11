// ใส่ค่าจาก Supabase -> Project Settings -> API
// anon key ออกแบบให้อยู่ในหน้าเว็บได้ เพราะความปลอดภัยอยู่ที่ Row Level Security
// ห้ามใส่ service_role key หรือ API key ของ LLM ในไฟล์นี้เด็ดขาด[cite: 1]
window.APP_CONFIG = {
  SUPABASE_URL: "https://wtyvtjvzvgurybtcnnsf.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_JLPzS9fSB0-mJN9D3Vssiw_ibQEXq4d"
};
