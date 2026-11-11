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
