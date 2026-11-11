// เฟส 3: สร้าง/แก้ไข/ส่งออกร่างรายงาน IPB
(function () {
  const sb = window.APP_SB;
  const $ = id => document.getElementById(id);
  const say = m => { $('ipb-state').textContent = m; };
  if (!sb) { say('ต้องตั้งค่า Supabase และเข้าสู่ระบบก่อน'); return; }
  const pid = () => $('cl-proj').value;
  const BASIS = { data: 'จากข้อมูลระบบ', analyst_input: 'จากผู้วิเคราะห์', assumption: 'สมมติฐาน', not_available: 'ไม่มีข้อมูล' };
  const KIND = { drug_seizure: 'จับกุมของกลาง', border_crossing: 'ข้ามชายแดน', arrest_operation: 'ปฏิบัติการจับกุม', other: 'อื่นๆ' };
  let cur = null;

  const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); Object.assign(e, props); kids.forEach(k => e.append(k)); return e; };
  const auto = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  async function errMsg(error) {
    try { const j = await error.context.json(); if (j && j.error) return j.error; } catch (_) {}
    return error.message || String(error);
  }

  async function loadList() {
    const s = $('ipb-list'); s.replaceChildren();
    if (!pid()) return;
    const { data, error } = await sb.from('ipb_reports').select('id,title,created_at').eq('project_id', pid()).order('created_at', { ascending: false });
    if (error) return say(error.message);
    data.forEach(r => s.append(el('option', { value: r.id, textContent: `${r.title} (${r.created_at.slice(0, 10)})` })));
  }

  $('ipb-gen').onclick = async () => {
    if (!pid()) return say('เลือกโปรเจกต์ก่อน');
    if (!$('ev-ok').checked) return say('ต้องติ๊กยืนยันในส่วน "เหตุการณ์จาก PDF" ก่อน (ข้อมูลจะถูกส่งไปประมวลผลกับ LLM บนคลาวด์)');
    say('กำลังสร้างร่าง IPB (อาจใช้เวลาประมาณ 1 นาที)...');
    const { data, error } = await sb.functions.invoke('generate-ipb', { body: { project_id: pid(),
      notes: { terrain: $('ipb-terrain').value, weather: $('ipb-weather').value, civil: $('ipb-civil').value } } });
    if (error) return say('ไม่สำเร็จ: ' + await errMsg(error));
    await loadList(); $('ipb-list').value = data.id; await open(data.id);
  };
  $('ipb-open').onclick = () => { if ($('ipb-list').value) open($('ipb-list').value); };
  $('cl-proj').addEventListener('change', loadList);
  loadList();

  async function open(id) {
    const { data, error } = await sb.from('ipb_reports').select('id,title,content').eq('id', id).single();
    if (error) return say(error.message);
    cur = data; render(); say('เปิดรายงานแล้ว');
  }

  // ---------- ส่วนประกอบหน้ารายงาน ----------
  const sec = (ov, t) => ov.append(el('h2', { textContent: t }));
  function field(parent, key, label, lines) {
    const wrap = el('div', { className: 'ipb-f' });
    if (label) wrap.append(el('div', { className: 'ipb-l', textContent: label }));
    const t = el('textarea');
    t.value = lines ? (parent[key] || []).join('\n') : (parent[key] || '');
    t.oninput = () => { parent[key] = lines ? t.value.split('\n').filter(Boolean) : t.value; auto(t); };
    wrap.append(t); return wrap;
  }
  function basisField(parent, key, label) {
    if (!parent[key]) parent[key] = { text: '', basis: 'not_available' };
    const w = field(parent[key], 'text', label);
    w.firstChild.append(el('span', { className: 'ipb-b', textContent: BASIS[parent[key].basis] || '' }));
    return w;
  }
  const refsText = (refs, map) => (refs || []).map(r => map[r] ? `${r} (หน้า ${map[r].page ?? '-'})` : r).join(', ');

  function render() {
    let ov = $('ipb-ov');
    if (!ov) { ov = el('div', { id: 'ipb-ov' }); document.body.append(ov); }
    ov.replaceChildren();
    const c = cur.content, d = c.draft, map = c.ref_map || {}, s = c.inputs_summary || {};
    const bar = el('div', { className: 'noprint ipb-bar' });
    const btn = (t, fn) => bar.append(el('button', { textContent: t, onclick: fn }));
    btn('บันทึกการแก้ไข', save); btn('พิมพ์ / PDF', () => window.print());
    btn('ดาวน์โหลด Markdown', download); btn('ปิด', () => { ov.style.display = 'none'; });
    ov.append(bar);
    ov.append(el('h1', { textContent: cur.title }));
    ov.append(el('div', { className: 'ipb-warn', textContent: 'ร่างจากระบบ AI – ต้องผ่านการตรวจและแก้ไขโดยนักวิเคราะห์ก่อนใช้งาน ไม่ใช่ข้อสรุปข่าวกรอง' }));

    sec(ov, 'ข้อมูลนำเข้า (จากฐานข้อมูล เฉพาะเหตุการณ์ที่อนุมัติและปักหมุดแล้ว)');
    const st = el('div', { className: 'ipb-stats' });
    (s.aos || []).forEach(a => st.append(el('div', { textContent:
      `AO ${a.name}: ${a.area_km2} ตร.กม. | เหตุการณ์ในพื้นที่ ${a.events_total} | ประเภท ${JSON.stringify(a.by_kind)} | รายเดือน ${JSON.stringify(a.by_month)}` })));
    (s.nai || []).forEach(a => st.append(el('div', { textContent: `NAI ${a.name}: เหตุการณ์ภายใน ${a.events_inside}` })));
    (s.tai || []).forEach(a => st.append(el('div', { textContent: `TAI ${a.name}: เหตุการณ์ภายใน ${a.events_inside}` })));
    st.append(el('div', { textContent: `เหตุการณ์ที่อนุมัติทั้งหมด ${s.events_total_approved ?? 0} (ยังไม่ปักหมุด ${s.events_unplaced ?? 0}) | เส้นทางลาดตระเวน ${s.routes ?? 0}` }));
    ov.append(st);

    sec(ov, 'ขั้นที่ 1 กำหนดสภาพแวดล้อมปฏิบัติการ');
    d.step1 = d.step1 || {};
    ov.append(field(d.step1, 'summary', 'สรุป'), field(d.step1, 'ao_notes', 'หมายเหตุ AO'));

    sec(ov, 'ขั้นที่ 2 ผลกระทบของสภาพแวดล้อม');
    d.step2 = d.step2 || {}; d.step2.terrain = d.step2.terrain || {};
    const T = d.step2.terrain;
    [['observation', 'การสังเกตและพื้นยิง (O)'], ['cover', 'ที่กำบังและซ่อนพราง (C)'], ['obstacles', 'สิ่งกีดขวาง (O)'],
     ['key_terrain', 'พื้นที่สำคัญ (K)'], ['approaches', 'เส้นทางเข้าถึง (A)']].forEach(([k, l]) => ov.append(basisField(T, k, l)));
    ov.append(basisField(d.step2, 'weather', 'สภาพอากาศ/ฤดูกาล'), basisField(d.step2, 'civil', 'ปัจจัยพลเรือน'));

    sec(ov, 'ขั้นที่ 3 ประเมินฝ่ายตรงข้าม (รูปแบบกิจกรรม)');
    d.step3 = d.step3 || { patterns: [] };
    d.step3.patterns.forEach(p => {
      const f = field(p, 'text'); f.append(el('div', { className: 'ipb-r', textContent: 'อ้างอิง: ' + (refsText(p.refs, map) || '-') })); ov.append(f);
    });

    sec(ov, 'ขั้นที่ 4 แนวทางปฏิบัติที่เป็นไปได้ของฝ่ายตรงข้าม');
    ((d.step4 || {}).coas || []).forEach((a, i) => {
      const box = el('div', { className: 'ipb-coa' });
      box.append(field(a, 'name', `แนวทางที่ ${i + 1}`), field(a, 'description', 'รายละเอียด'), field(a, 'indicators', 'ตัวชี้วัดที่ใช้เฝ้าสังเกต (บรรทัดละข้อ)', true));
      box.append(el('div', { className: 'ipb-r', textContent:
        `NAI: ${(a.nai || []).join(', ') || '-'} | TAI: ${(a.tai || []).join(', ') || '-'} | ความเชื่อมั่น: ${a.confidence} | อ้างอิง: ${refsText(a.refs, map) || '-'}` }));
      ov.append(box);
    });

    sec(ov, 'ช่องว่างข่าวกรอง');
    ov.append(field(d, 'gaps', null, true));
    sec(ov, 'คำถามสำคัญที่ควรรวบรวม');
    (d.collection || []).forEach(q => { ov.append(field(q, 'question'), el('div', { className: 'ipb-r', textContent: 'NAI: ' + (q.nai || '-') })); });

    sec(ov, 'ภาคผนวก: เหตุการณ์อ้างอิง');
    Object.entries(map).forEach(([r, e]) => ov.append(el('div', { className: 'ipb-r', textContent:
      `${r} | ${e.date || '-'} | ${KIND[e.kind] || e.kind} | ${e.location || '-'} | หน้า ${e.page ?? '-'}` })));

    ov.style.display = 'block';
    ov.querySelectorAll('textarea').forEach(auto);
  }

  async function save() {
    const { error } = await sb.from('ipb_reports').update({ content: cur.content, updated_at: new Date().toISOString() }).eq('id', cur.id);
    say(error ? 'บันทึกไม่สำเร็จ: ' + error.message : 'บันทึกการแก้ไขแล้ว');
  }

  function download() {
    const c = cur.content, d = c.draft, map = c.ref_map || {}, L = [];
    const nd = n => n ? `${n.text} _(${BASIS[n.basis] || ''})_` : '';
    L.push(`# ${cur.title}`, '', '> ร่างจากระบบ AI – ต้องผ่านการตรวจโดยนักวิเคราะห์ก่อนใช้งาน', '');
    L.push('## ขั้นที่ 1 กำหนดสภาพแวดล้อมปฏิบัติการ', d.step1?.summary || '', d.step1?.ao_notes || '', '');
    const T = d.step2?.terrain || {};
    L.push('## ขั้นที่ 2 ผลกระทบของสภาพแวดล้อม',
      `- การสังเกตและพื้นยิง: ${nd(T.observation)}`, `- ที่กำบังและซ่อนพราง: ${nd(T.cover)}`, `- สิ่งกีดขวาง: ${nd(T.obstacles)}`,
      `- พื้นที่สำคัญ: ${nd(T.key_terrain)}`, `- เส้นทางเข้าถึง: ${nd(T.approaches)}`,
      `- สภาพอากาศ: ${nd(d.step2?.weather)}`, `- ปัจจัยพลเรือน: ${nd(d.step2?.civil)}`, '');
    L.push('## ขั้นที่ 3 ประเมินฝ่ายตรงข้าม');
    (d.step3?.patterns || []).forEach(p => L.push(`- ${p.text} (อ้างอิง: ${refsText(p.refs, map) || '-'})`));
    L.push('', '## ขั้นที่ 4 แนวทางปฏิบัติที่เป็นไปได้');
    (d.step4?.coas || []).forEach((a, i) => {
      L.push(`### ${i + 1}. ${a.name}`, a.description, `- ตัวชี้วัด: ${(a.indicators || []).join('; ')}`,
        `- NAI: ${(a.nai || []).join(', ') || '-'} | TAI: ${(a.tai || []).join(', ') || '-'} | ความเชื่อมั่น: ${a.confidence}`, '');
    });
    L.push('## ช่องว่างข่าวกรอง', ...(d.gaps || []).map(g => `- ${g}`), '', '## คำถามสำคัญที่ควรรวบรวม',
      ...(d.collection || []).map(q => `- ${q.question} (NAI: ${q.nai || '-'})`), '', '## ภาคผนวก: เหตุการณ์อ้างอิง',
      ...Object.entries(map).map(([r, e]) => `- ${r}: ${e.date || '-'} | ${KIND[e.kind] || e.kind} | ${e.location || '-'} | หน้า ${e.page ?? '-'}`));
    const a = el('a', { href: URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' })), download: 'ipb-report.md' });
    a.click();
  }
  say('พร้อมใช้งาน – ต้องมี AO ที่บันทึกขึ้นฐานข้อมูลและเหตุการณ์ที่อนุมัติแล้ว');
})();
