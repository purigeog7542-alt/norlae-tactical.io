# Fang Intel – เว็บแผนที่วิเคราะห์ภูมิประเทศ (เฟส 1)

## ตั้งค่า (ครั้งแรก)
1. สร้างโปรเจกต์ที่ supabase.com แล้วรัน `supabase/migrations/001_init.sql` ใน SQL Editor
2. Authentication -> Providers -> Email: **ปิด "Allow new users to sign up"** แล้วสร้างผู้ใช้เองที่ Authentication -> Users
3. แก้ `js/config.js` ใส่ Project URL และ anon key
4. ทดสอบในเครื่อง: VS Code -> ส่วนขยาย Live Server -> Open with Live Server
5. อัปขึ้น GitHub (แนะนำ repo แบบ **private**) -> Settings -> Pages -> Source: GitHub Actions

## ข้อควรระวัง
- ห้ามใส่ service_role key หรือ API key ของ LLM ในโค้ดหน้าเว็บ
- GitHub Pages ของ repo private ต้องใช้แพ็กเกจที่รองรับ ถ้าไม่รองรับ ให้โฮสต์ที่อื่น เช่น Cloudflare Pages / Netlify
- ข้อมูลภารกิจจริงเก็บใน Supabase เท่านั้น ไม่ commit ไฟล์ GeoJSON/PDF ลง repo

## เฟส 2: PDF ข่าว -> เหตุการณ์
1. รัน `supabase/migrations/002_events.sql` ใน SQL Editor
2. ติดตั้ง Supabase CLI แล้ว `supabase login` และ `supabase link --project-ref <ref>`
3. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (เก็บเป็น secret ฝั่งเซิร์ฟเวอร์เท่านั้น) และถ้าต้องการเปลี่ยนโมเดล `supabase secrets set ANTHROPIC_MODEL=<ชื่อโมเดล>`
4. `supabase functions deploy extract-events`
5. ในแอป: เข้าสู่ระบบ -> เลือกโปรเจกต์ -> ติ๊กยืนยัน -> อัปโหลด PDF -> ตรวจแต่ละรายการ (อนุมัติ/ปฏิเสธ/แก้ไข/ปักหมุด)

ข้อจำกัด: ยังไม่มี OCR (PDF ภาพสแกนใช้ไม่ได้), ยังไม่แปลงชื่อสถานที่เป็นพิกัดอัตโนมัติ (ปักหมุดเอง), ไม่มีการตรวจเหตุการณ์ซ้ำ

## เฟส 3: ร่าง IPB
1. รัน `supabase/migrations/003_ipb.sql` ใน SQL Editor
2. `supabase functions deploy generate-ipb` (ใช้ secret ชุดเดียวกับเฟส 2)
3. ในแอป: บันทึก AO/NAI/TAI ขึ้นฐานข้อมูล (เฟส 1) -> อนุมัติและปักหมุดเหตุการณ์ (เฟส 2) -> กรอกข้อมูลภูมิประเทศที่ทราบ -> "สร้างร่าง IPB"
4. ร่างทุกหัวข้อแก้ไขได้ในหน้ารายงาน แล้ว "บันทึกการแก้ไข" / "พิมพ์ / PDF" / ดาวน์โหลด Markdown

หลักการ: ระบบนับเหตุการณ์ใน AO/NAI/TAI ด้วย PostGIS (ตรวจสอบได้) ส่วน LLM เขียนเฉพาะข้อความตามข้อมูลนั้น ทุกหัวข้อภูมิประเทศระบุที่มา (ข้อมูลระบบ / ผู้วิเคราะห์ / สมมติฐาน / ไม่มีข้อมูล)
ข้อจำกัด: ยังไม่ดึงผล DEM/พืชคลุมดิน/อาคารอัตโนมัติ (ภูมิประเทศมาจากที่ผู้วิเคราะห์กรอก), รายงานยังไม่มีภาพแผนที่แนบ
