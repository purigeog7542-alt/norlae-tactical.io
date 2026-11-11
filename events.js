// เฟส 2: อัปโหลด PDF -> สกัดเหตุการณ์ -> ตรวจ/ปักหมุด/อนุมัติ -> ชั้นเหตุการณ์บนแผนที่
(function () {
  const sb = window.APP_SB;
  const $ = id => document.getElementById(id);
  const KIND = { drug_seizure: 'จับกุมของกลาง', border_crossing: 'ข้ามชายแดน', arrest_operation: 'ปฏิบัติการจับกุม', other: 'อื่นๆ' };
  const COLOR = ['match', ['get', 'status'], 'approved', '#22c55e', 'pending', '#f59e0b', '#6b7280'];
  let evs = [];
  const say = m => { $('ev-state').textContent = m; };
  if (!sb) { say('ต้องตั้งค่า Supabase และเข้าสู่ระบบก่อน'); return; }
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

  const projectId = () => $('cl-proj').value;

  function initLayers() {
    map.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'ev-heat', type: 'heatmap', source: 'events', filter: ['==', ['get', 'status'], 'approved'],
      layout: { visibility: 'none' }, paint: { 'heatmap-radius': 30, 'heatmap-opacity': .7 } });
    map.addLayer({ id: 'ev-pt', type: 'circle', source: 'events',
      paint: { 'circle-radius': 7, 'circle-color': COLOR, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
    map.on('click', 'ev-pt', e => {
      const p = e.features[0].properties;
      const box = document.createElement('div');
      box.style.cssText = 'color:#111;max-width:260px;font-size:12px';
      [`${KIND[p.kind] || p.kind} | ${p.event_date || 'ไม่ระบุวันที่'}`, p.location_text || '', `หน้า ${p.source_page ?? '-'}: ${p.source_quote || ''}`]
        .forEach(t => { const d = document.createElement('div'); d.textContent = t; box.append(d); });
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    });
    map.on('mouseenter', 'ev-pt', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'ev-pt', () => map.getCanvas().style.cursor = '');
  }
  if (map.getSource('user')) initLayers(); else map.once('load', initLayers);

  function render() {
    const src = map.getSource('events');
    if (src) src.setData({ type: 'FeatureCollection', features: evs.filter(e => e.lng != null).map(e => ({
      type: 'Feature', properties: e, geometry: { type: 'Point', coordinates: [e.lng, e.lat] } })) });
    const L = $('ev-list'); L.replaceChildren();
    evs.forEach(e => {
      const row = document.createElement('div');
      const t = document.createElement('div');
      t.textContent = `[${e.status}] ${e.event_date || '-'} ${KIND[e.kind] || e.kind} | ${e.location_text || 'ไม่ระบุสถานที่'}` +
        (e.quantity != null ? ` | ${e.quantity} ${e.unit || ''}` : '') + (e.lng == null ? ' | ยังไม่ปักหมุด' : '');
      t.title = `หน้า ${e.source_page ?? '-'}: ${e.source_quote || ''}`;
      const bar = document.createElement('div'); bar.className = 'row'; bar.style.marginTop = '3px';
      const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.append(b); };
      add('อนุมัติ', () => setStatus(e, 'approved'));
      add('ปฏิเสธ', () => setStatus(e, 'rejected'));
      add('ปักหมุด', () => place(e));
      add('แก้ไข', () => edit(e));
      if (e.lng != null) add('ไปที่', () => map.flyTo({ center: [e.lng, e.lat], zoom: 13 }));
      row.append(t, bar); L.append(row);
    });
    say(`เหตุการณ์ ${evs.length} รายการ`);
  }

  async function load() {
    const pid = projectId(); if (!pid) return say('เลือกโปรเจกต์ก่อน');
    const f = $('ev-filter').value || null;
    const { data, error } = await sb.rpc('get_events', { p_project: pid, p_status: f });
    if (error) return say('โหลดไม่สำเร็จ: ' + error.message);
    evs = data; render();
  }
  async function setStatus(e, status) {
    const { error } = await sb.from('events').update({ status }).eq('id', e.id);
    if (error) return say(error.message);
    e.status = status; render();
  }
  async function edit(e) {
    const loc = prompt('สถานที่', e.location_text || ''); if (loc === null) return;
    const date = prompt('วันที่ (YYYY-MM-DD หรือเว้นว่าง)', e.event_date || ''); if (date === null) return;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return say('รูปแบบวันที่ไม่ถูกต้อง');
    const patch = { location_text: loc || null, event_date: date || null };
    const { error } = await sb.from('events').update(patch).eq('id', e.id);
    if (error) return say(error.message);
    Object.assign(e, patch); render();
  }
  function place(e) {
    say('คลิกบนแผนที่เพื่อปักหมุดเหตุการณ์นี้ (กด Esc เพื่อยกเลิก)');
    map.getCanvas().style.cursor = 'crosshair';
    const done = () => { map.getCanvas().style.cursor = ''; document.removeEventListener('keydown', esc); };
    const esc = k => { if (k.key === 'Escape') { map.off('click', once); done(); say('ยกเลิกการปักหมุด'); } };
    const once = async ev => {
      map.off('click', once); done();
      const { error } = await sb.rpc('set_event_location', { p_event: e.id, p_lng: ev.lngLat.lng, p_lat: ev.lngLat.lat });
      if (error) return say(error.message);
      e.lng = ev.lngLat.lng; e.lat = ev.lngLat.lat; render();
    };
    document.addEventListener('keydown', esc);
    setTimeout(() => map.on('click', once), 0);
  }

  async function extractPages(buf) {
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      pages.push({ page: i, text: tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim() });
    }
    return pages;
  }

  $('ev-file').onchange = async ev => {
    const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
    const pid = projectId();
    if (!pid) return say('เลือกโปรเจกต์ก่อน');
    if (!$('ev-ok').checked) return say('ต้องติ๊กยืนยันว่าเอกสารไม่มีชั้นความลับก่อน');
    try {
      say('กำลังอ่านข้อความจาก PDF...');
      const pages = await extractPages(await file.arrayBuffer());
      const chars = pages.reduce((n, p) => n + p.text.length, 0);
      if (chars < 50) return say('ไฟล์นี้ไม่มีข้อความ (อาจเป็นภาพสแกน) – ยังไม่รองรับ OCR ในเวอร์ชันนี้');
      say('กำลังอัปโหลดไฟล์...');
      const path = `${pid}/${crypto.randomUUID()}.pdf`;
      let r = await sb.storage.from('documents').upload(path, file, { contentType: 'application/pdf' });
      if (r.error) throw r.error;
      const d = await sb.from('documents').insert({ project_id: pid, file_path: path, title: file.name }).select('id').single();
      if (d.error) throw d.error;
      say('กำลังสกัดเหตุการณ์ด้วย LLM (อาจใช้เวลาหลายสิบวินาที)...');
      const f = await sb.functions.invoke('extract-events', { body: { document_id: d.data.id, pages } });
      if (f.error) throw f.error;
      say(`สกัดได้ ${f.data.inserted} รายการ – ตรวจสอบก่อนอนุมัติ`);
      $('ev-filter').value = 'pending'; await load();
    } catch (err) { say('ผิดพลาด: ' + (err.message || err)); }
  };
  $('ev-reload').onclick = load;
  $('ev-filter').onchange = load;
  $('cl-proj').addEventListener('change', load);
  $('ev-heat').onchange = e => map.setLayoutProperty('ev-heat', 'visibility', e.target.checked ? 'visible' : 'none');
  say('พร้อมใช้งาน – เลือกโปรเจกต์แล้วอัปโหลด PDF');
})();
