# Thái Hòa SHOP – Ứng dụng bán hàng & tính tiền

Web app bán hàng đơn giản cho shop nhỏ, dùng được trên **điện thoại** và **máy tính**.

- **Tính tiền:** bấm món để thêm vào giỏ, giảm giá (theo số tiền hoặc %), tính tiền thối, lưu hóa đơn, in hóa đơn khổ 80mm.
- **Quản lý món:** thêm / sửa / ẩn / xóa món, ảnh món, quản lý nhóm món.
- **Lịch sử hóa đơn:** lọc theo ngày, xem chi tiết, in lại, hủy hóa đơn.
- **Thống kê:** doanh thu hôm nay, 7 ngày, tháng này; top món bán chạy (theo giờ Việt Nam, không tính hóa đơn đã hủy).
- **Backup:** xuất file Excel danh sách món và hóa đơn.

Công nghệ: Vite + React + TypeScript + Tailwind CSS, dữ liệu lưu trên **Supabase**, đưa lên mạng bằng **Netlify**. Cả hai đều có gói **miễn phí**.

---

## Chuẩn bị

Bạn cần:

1. Một địa chỉ email.
2. Tài khoản **GitHub** (miễn phí) – https://github.com – để Netlify lấy code.
3. Phần mềm **Node.js** bản LTS (từ 22 trở lên) – tải ở https://nodejs.org rồi cài như phần mềm bình thường.
   Kiểm tra: mở *Terminal* (macOS) hoặc *Command Prompt / PowerShell* (Windows), gõ `node -v` → hiện `v22...` trở lên là được.

---

## Bước 1 – Tạo cơ sở dữ liệu trên Supabase

### 1.1. Tạo project

1. Vào https://supabase.com → **Start your project** → đăng nhập (có thể dùng GitHub).
2. Bấm **New project**:
   - **Name:** `thaihoashop`
   - **Database Password:** đặt mật khẩu mạnh và **ghi lại** ở nơi an toàn.
   - **Region:** chọn **Southeast Asia (Singapore)** cho nhanh.
3. Bấm **Create new project**, đợi 1–2 phút.

### 1.2. Chạy file `schema.sql`

1. Ở menu bên trái, chọn **SQL Editor** → **New query**.
2. Mở file [schema.sql](schema.sql) trong thư mục code, **chép toàn bộ** nội dung và dán vào ô soạn thảo.
3. Bấm **Run** (hoặc Ctrl + Enter). Thấy dòng *Success. No rows returned* là xong.

File này sẽ tạo các bảng, bật bảo mật (chỉ người đăng nhập mới xem được dữ liệu), tạo kho ảnh món, và thêm vài món mẫu.
Có thể chạy lại file này nhiều lần mà **không mất dữ liệu**.

### 1.3. Tạo tài khoản đăng nhập cho chủ shop

1. Menu trái → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Nhập **email** và **mật khẩu** bạn sẽ dùng để đăng nhập app.
3. Đánh dấu **Auto Confirm User** → **Create user**.

### 1.4. Tắt đăng ký công khai (quan trọng)

Để người lạ không tự tạo tài khoản được:

1. **Authentication** → **Sign In / Providers** (ở một số phiên bản là **Providers** hoặc **Settings**).
2. Tắt mục **Allow new users to sign up** → **Save**.

### 1.5. Lấy thông tin kết nối

Vào **Project Settings** (biểu tượng bánh răng) → **API** (hoặc **Data API** / **API Keys**), ghi lại 2 thông tin:

- **Project URL** – dạng `https://abcdxyz.supabase.co`
- **anon public key** – một chuỗi dài bắt đầu bằng `eyJ...` (bản Supabase mới có thể gọi là **Publishable key**, bắt đầu bằng `sb_publishable_...` – dùng được như nhau).

> ⚠️ **Không dùng** khóa `service_role` / `secret` cho app này.

---

## Bước 2 – Chạy thử trên máy tính

1. Mở Terminal tại thư mục code (thư mục chứa file `package.json`).
2. Tạo file cấu hình: sao chép file `.env.example` thành file mới tên **`.env`**, rồi điền 2 thông tin ở bước 1.5:

   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. Cài thư viện (chỉ cần làm lần đầu):

   ```
   npm install
   ```

4. Chạy app:

   ```
   npm run dev
   ```

5. Mở trình duyệt vào **http://localhost:5173**, đăng nhập bằng tài khoản đã tạo ở bước 1.3.

**Thử trên điện thoại** (cùng mạng Wi-Fi với máy tính): chạy `npm run dev -- --host`, rồi mở trên điện thoại địa chỉ `http://<IP-máy-tính>:5173` hiện trong Terminal.

Dừng app: bấm **Ctrl + C** trong Terminal.

---

## Bước 3 – Đưa lên mạng bằng Netlify

### 3.1. Đưa code lên GitHub

1. Vào https://github.com/new → đặt tên `thaihoashop` → chọn **Private** → **Create repository**.
2. Trong Terminal tại thư mục code, chạy lần lượt (thay `TEN-CUA-BAN` bằng tên tài khoản GitHub):

   ```
   git add .
   git commit -m "Thai Hoa SHOP"
   git branch -M main
   git remote add origin https://github.com/TEN-CUA-BAN/thaihoashop.git
   git push -u origin main
   ```

   File `.env` **không** bị đưa lên GitHub (đã được loại trừ trong `.gitignore`).

### 3.2. Tạo site trên Netlify

1. Vào https://app.netlify.com → đăng nhập bằng GitHub.
2. **Add new site** (hoặc **Add new project**) → **Import an existing project** → **GitHub** → chọn repo `thaihoashop`.
3. Phần cấu hình build Netlify tự đọc từ file `netlify.toml` (lệnh `npm run build`, thư mục `dist`) – giữ nguyên.
4. Mở **Add environment variables** (hoặc sau khi tạo: **Site configuration → Environment variables**) và thêm 2 biến:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL ở bước 1.5 |
   | `VITE_SUPABASE_ANON_KEY` | anon key ở bước 1.5 |

5. Bấm **Deploy**. Sau 1–2 phút bạn có địa chỉ dạng `https://ten-ngau-nhien.netlify.app`.

> Nếu thêm/sửa biến môi trường **sau khi** đã deploy: vào **Deploys → Trigger deploy → Deploy site** để áp dụng.
>
> Từ nay, mỗi lần `git push` code mới lên GitHub, Netlify sẽ tự cập nhật site.

### 3.3. Đổi tên site / gắn tên miền riêng (nếu có)

- **Đổi tên miễn phí:** **Site configuration → Change site name** → ví dụ `thaihoashop` → địa chỉ thành `https://thaihoashop.netlify.app`.
- **Tên miền riêng** (ví dụ `thaihoashop.vn` đã mua ở nhà cung cấp tên miền):
  1. Netlify: **Domain management → Add a domain** → nhập tên miền → làm theo hướng dẫn.
  2. Tại trang quản lý tên miền của nhà cung cấp, thêm bản ghi DNS theo Netlify chỉ dẫn, thường là:
     - `CNAME` cho `www` → `thaihoashop.netlify.app`
     - `A` cho tên miền gốc (`@`) → `75.2.60.5`
  3. Đợi DNS cập nhật (vài phút đến vài giờ). Netlify tự cấp **HTTPS miễn phí**.

### 3.4. Thêm vào màn hình chính điện thoại

Mở địa chỉ site trên điện thoại:
- **Android (Chrome):** menu ⋮ → **Thêm vào màn hình chính**.
- **iPhone (Safari):** nút Chia sẻ → **Thêm vào MH chính**.

---

## Bước 4 – Backup dữ liệu định kỳ

Gói miễn phí của Supabase **không có** bản sao lưu tự động mà bạn tải về được, nên hãy tự backup:

### Cách 1 – Xuất Excel trong app (khuyên dùng, mỗi tuần hoặc cuối tháng)

1. Vào mục **Backup** trong app.
2. Bấm **Xuất Excel danh sách món**.
3. Chọn khoảng ngày (ví dụ **Tháng này**) → bấm **Xuất Excel hóa đơn**. File gồm 2 trang: *Hóa đơn* và *Chi tiết*.
4. Cất các file vào Google Drive / máy tính / USB. Đặt nhắc lịch hằng tháng để không quên.

### Cách 2 – Tải toàn bộ bảng từ Supabase (backup đầy đủ)

1. Supabase → **Table Editor** → chọn lần lượt các bảng `categories`, `products`, `orders`, `order_items`.
2. Bấm **Export** (hoặc nút ⋯) → **Export to CSV** → lưu file.

### Lưu ý về gói miễn phí Supabase

- Project miễn phí **bị tạm dừng nếu không có ai dùng trong 7 ngày**. Nếu shop nghỉ lâu, vào https://supabase.com mở project và bấm **Restore** – dữ liệu không mất.
- Dung lượng miễn phí (500 MB dữ liệu, 1 GB ảnh) là dư dả cho shop nhỏ trong nhiều năm.

---

## Hướng dẫn sử dụng nhanh

**Bán hàng (mục Tính tiền)**
1. Bấm vào món để thêm vào giỏ (bấm nhiều lần để tăng số lượng). Có thể lọc theo nhóm hoặc gõ tìm kiếm (gõ không dấu cũng được, vd. `ca phe`).
2. Trên điện thoại, bấm thanh xanh **🛒 … món** ở dưới để mở giỏ hàng.
3. Nhập giảm giá (chọn **₫** hoặc **%**) nếu có.
4. Nhập **Tiền khách đưa** hoặc bấm nút nhanh **50k / 100k / 200k / 500k / Đủ tiền** → app tự tính **Tiền thối**. Để trống nghĩa là khách đưa vừa đủ.
5. Bấm **Thanh toán** → hóa đơn được lưu, có thể bấm **In hóa đơn**.

**Món đã bán rồi thì không xóa được** (để hóa đơn cũ luôn đúng) – hãy bấm **Ẩn**. Món ẩn không hiện ở màn hình Tính tiền nhưng vẫn còn trong lịch sử. Đổi giá món không làm thay đổi hóa đơn cũ.

Số lượng là số nguyên. Với hàng bán theo cân lạng, có thể tạo món theo đơn vị nhỏ hơn (ví dụ "100g").

**In hóa đơn khổ 80mm:** khi hộp thoại in hiện ra, chọn máy in nhiệt, khổ giấy **80mm** (hoặc 80 x 297mm), **Lề (Margins): Không/None**, tắt **Đầu trang & chân trang (Headers and footers)**.

**Đổi tên shop hoặc lời cảm ơn trên hóa đơn:** sửa file [src/config.ts](src/config.ts), rồi `git push` lại.

---

## Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Trang đăng nhập báo *Chưa cấu hình kết nối Supabase* | Kiểm tra file `.env` (trên máy) hoặc biến môi trường trên Netlify, rồi chạy lại `npm run dev` / Trigger deploy. |
| *Sai email hoặc mật khẩu* | Kiểm tra lại tài khoản ở Supabase → Authentication → Users. Có thể đặt lại mật khẩu tại đó. |
| *Không kết nối được máy chủ* | Kiểm tra mạng; xem project Supabase có đang bị tạm dừng không. |
| Báo lỗi *function create_order does not exist* | Chưa chạy `schema.sql` – làm lại bước 1.2. |
| Không tải được ảnh món | Chạy lại `schema.sql` để tạo kho ảnh `product-images`. |
| Mở đường link trang con trên Netlify bị lỗi 404 | Đảm bảo file `public/_redirects` có trong code. |

---

## Cấu trúc thư mục

```
schema.sql               Tạo bảng, bảo mật, hàm tạo hóa đơn & thống kê, dữ liệu mẫu
.env.example             Mẫu file cấu hình kết nối Supabase
netlify.toml             Cấu hình build cho Netlify
public/_redirects        Cho phép mở trực tiếp các trang con trên Netlify
src/
  config.ts              Tên shop, lời cảm ơn trên hóa đơn
  types.ts               Kiểu dữ liệu
  lib/
    supabase.ts          Kết nối Supabase
    api.ts               Tất cả lệnh đọc/ghi dữ liệu
    format.ts            Định dạng tiền (25.000 ₫), ngày giờ Việt Nam, tìm kiếm không dấu
    excel.ts             Xuất file Excel
  components/            Thành phần dùng chung (menu, thông báo, hộp xác nhận, in hóa đơn...)
  pages/
    LoginPage.tsx        Đăng nhập
    PosPage.tsx          Tính tiền
    ProductsPage.tsx     Quản lý món (+ products/ProductForm, products/CategoryManager)
    OrdersPage.tsx       Lịch sử hóa đơn
    StatsPage.tsx        Thống kê
    BackupPage.tsx       Xuất Excel
```

Lệnh hữu ích: `npm run dev` (chạy thử), `npm run build` (kiểm tra lỗi & đóng gói), `npm run preview` (xem bản đã đóng gói).
