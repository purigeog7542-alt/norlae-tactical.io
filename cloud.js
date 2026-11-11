// เชื่อมแผนที่กับ Supabase: เข้าสู่ระบบ, เลือกโปรเจกต์, บันทึก/โหลดฟีเจอร์
(function () {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const state = $('cl-state');
  const say = m => { state.textContent = m; };
  $('cl-login-box').style.display = 'none';
  $('cl-work').style.display = 'none';
  if (!window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR')) {
    say('ยังไม่ได้ตั้งค่า js/config.js (แผนที่ยังใช้งานแบบออฟไลน์ได้)');
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.APP_SB = sb;
  let user = null;

  function ui() {
    $('cl-login-box').style.display = user ? 'none' : '';
    $('cl-work').style.display = user ? '' : 'none';
    say(user ? 'เข้าสู่ระบบ: ' + user.email : 'ยังไม่ได้เข้าสู่ระบบ');
  }
  async function loadProjects() {
    const { data, error } = await sb.from('projects').select('id,name').order('created_at', { ascending: false });
    if (error) return say(error.message);
    const s = $('cl-proj'); s.replaceChildren();
    data.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; s.append(o); });
  }
  function onSession(session) { user = session ? session.user : null; ui(); if (user) loadProjects(); }
  sb.auth.onAuthStateChange((_e, s) => onSession(s));
  sb.auth.getSession().then(({ data }) => onSession(data.session));

  $('cl-login').onclick = async () => {
    const { error } = await sb.auth.signInWithPassword({ email: $('cl-email').value.trim(), password: $('cl-pass').value });
    $('cl-pass').value = '';
    if (error) say('เข้าสู่ระบบไม่สำเร็จ: ' + error.message);
  };
  $('cl-logout').onclick = () => sb.auth.signOut();
  $('cl-new').onclick = async () => {
    const name = $('cl-newname').value.trim(); if (!name) return;
    const { error } = await sb.from('projects').insert({ name });
    if (error) return say(error.message);
    $('cl-newname').value = ''; loadProjects();
  };
  $('cl-save').onclick = async () => {
    const pid = $('cl-proj').value; if (!pid) return say('เลือกโปรเจกต์ก่อน');
    if (!confirm('บันทึกทับข้อมูลเดิมของโปรเจกต์นี้ใช่หรือไม่?')) return;
    const { data, error } = await sb.rpc('save_features', { p_project: pid, p_features: feats });
    say(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกแล้ว ' + data + ' รายการ');
  };
  $('cl-load').onclick = async () => {
    const pid = $('cl-proj').value; if (!pid) return say('เลือกโปรเจกต์ก่อน');
    const { data, error } = await sb.rpc('get_features', { p_project: pid });
    if (error) return say('โหลดไม่สำเร็จ: ' + error.message);
    feats = data; refresh(); if (feats.length) zoomTo(feats);
    say('โหลดแล้ว ' + feats.length + ' รายการ');
  };
})();
