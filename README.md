# Thái Hòa SHOP – Ứng dụng bán hàng & tính tiền

Web app bán hàng đơn giản cho shop nhỏ, dùng được trên **điện thoại** và **máy tính**.

- **Tính tiền:** bấm món để thêm vào giỏ, giảm giá (theo số tiền hoặc %), tính tiền thối, lưu hóa đơn, in hóa đơn khổ 80mm.
- **Quản lý món:** thêm / sửa / ẩn / xóa món, ảnh món, quản lý nhóm món.
- **Lịch sử hóa đơn:** lọc theo ngày, xem chi tiết, in lại, hủy hóa đơn.
- **Thống kê:** doanh thu hôm nay, 7 ngày, tháng này; top món bán chạy (theo giờ Việt Nam, không tính hóa đơn đã hủy).
- **Mua hàng:** ghi lại các lần đi chợ ngay trên điện thoại (gợi ý tên hàng, tự điền đơn vị và giá lần trước), lọc theo ngày / đợt nấu.
- **Đợt nấu & tính giá mâm:** gom chi phí của một đơn tiệc, chia theo nhóm hàng, tính giá vốn và giá bán gợi ý mỗi mâm, lãi theo giá chốt; lưu giá mâm thành món để bán ở màn hình Tính tiền; sao chép đợt cho đơn tiệc lặp lại.
- **Lãi lỗ:** doanh thu − chi phí mua hàng theo tháng (biểu đồ cột), chi phí theo nhóm hàng, theo dõi giá mua của từng mặt hàng.
- **Backup:** xuất file Excel danh sách món, hóa đơn, mua hàng và bảng tính giá các đợt nấu.

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

### 1.2. Tạo bảng dữ liệu (chạy migration)

Toàn bộ cấu trúc cơ sở dữ liệu nằm trong thư mục [supabase/migrations](supabase/migrations), mỗi file là một lần thay đổi, tên file bắt đầu bằng thời điểm nên luôn chạy theo đúng thứ tự:

| File | Nội dung |
|---|---|
| `20261127000000_khoi_tao.sql` | Nhóm món, món, hóa đơn, bảo mật, hàm tạo hóa đơn & thống kê, kho ảnh món, món mẫu |
| `20261127110000_mua_hang.sql` | Mua hàng, danh mục hàng, đợt nấu, tính giá mâm, báo cáo lãi lỗ |

Cách chạy: làm theo mục [Cập nhật cơ sở dữ liệu](#cập-nhật-cơ-sở-dữ-liệu-migration) bên dưới (lệnh `npx supabase db push` chạy hết các file theo thứ tự).

Không muốn dùng lệnh: vào **SQL Editor** → **New query**, dán **toàn bộ** nội dung từng file theo đúng thứ tự trên, mỗi file bấm **Run** một lần (thấy *Success. No rows returned* là xong).

Các file đều chạy lại được nhiều lần mà **không mất dữ liệu**.

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

## Cập nhật cơ sở dữ liệu (migration)

Mỗi thay đổi cơ sở dữ liệu là một file trong [supabase/migrations](supabase/migrations). Supabase **ghi nhớ file nào đã chạy**, nên lệnh `npx supabase db push` chỉ chạy những file mới. Lệnh dùng công cụ **Supabase CLI**, tự tải về qua `npx` (lần đầu `npx` hỏi *Ok to proceed?* → gõ `y`).

Mở Terminal / PowerShell **tại thư mục code** (thư mục có file `package.json`) rồi gõ các lệnh dưới đây.

### Chuẩn bị (chỉ làm 1 lần trên mỗi máy)

1. Tạo file cấu hình (bỏ qua nếu đã có file `supabase/config.toml`):

   ```
   npx supabase init
   ```

   Nếu được hỏi có tạo cài đặt cho VS Code / IntelliJ không → gõ `N`.

2. Đăng nhập Supabase (trình duyệt mở ra → bấm đồng ý):

   ```
   npx supabase login
   ```

3. Kết nối thư mục code với project. `<project-ref>` là đoạn chữ trong Project URL `https://<project-ref>.supabase.co`:

   ```
   npx supabase link --project-ref <project-ref>
   ```

   Khi được hỏi **Database password**: nhập mật khẩu đã đặt lúc tạo project (bước 1.1). Quên mật khẩu → Supabase → **Project Settings → Database → Reset database password**.

4. **Chỉ với project đã từng tạo bảng bằng SQL Editor** (shop đang dùng bản cũ, chạy file `schema.sql` – nay là file `..._khoi_tao.sql`): báo cho Supabase biết file khởi tạo đã chạy rồi:

   ```
   npx supabase migration repair --status applied 20261127000000
   ```

   Lỡ quên bước này cũng không sao: file khởi tạo chạy lại được, không mất dữ liệu.

### Mỗi lần có migration mới (cập nhật backend)

1. Xem file nào chưa chạy:

   ```
   npx supabase migration list
   ```

   Dòng có cột **Local** mà cột **Remote** trống là chưa chạy trên Supabase.

2. Chạy các file mới:

   ```
   npx supabase db push
   ```

   Lệnh liệt kê các file sẽ chạy và hỏi xác nhận → gõ `Y`. Mỗi file chạy trong một giao dịch: lỗi giữa chừng thì không có gì bị lưu dở.

3. Kiểm tra: chạy lại `npx supabase migration list` → hai cột **Local** và **Remote** khớp nhau. Với phần Mua hàng, menu **Table Editor** có thêm 4 bảng `ingredients`, `batches`, `purchases`, `purchase_items`.

**Thứ tự khi phát hành bản mới:** cập nhật cơ sở dữ liệu (`db push`) **trước**, rồi mới đưa code lên (`git push` → Netlify tự cập nhật site). Nếu lỡ đưa code lên trước: các màn hình cũ vẫn chạy bình thường, chỉ các màn hình mới báo *"Chưa cập nhật cơ sở dữ liệu..."* – chạy `db push` xong là hết.

**Không dùng được lệnh?** Vào **SQL Editor** → **New query**, dán toàn bộ file migration mới → **Run**. Cách này Supabase không ghi nhớ, nên sau này nếu chuyển sang dùng lệnh thì đánh dấu lại: `npx supabase migration repair --status applied <dãy số đầu tên file>`.

### Viết thay đổi cơ sở dữ liệu mới (dành cho người sửa code)

```
npx supabase migration new ten_thay_doi
```

Lệnh tạo file trống `supabase/migrations/<thời điểm>_ten_thay_doi.sql` → viết SQL vào đó → `npx supabase db push`. **Không sửa** file migration đã chạy lên Supabase – muốn đổi gì thì tạo file mới.

Ghi chú:
- Migration mua hàng **không đụng** tới món, hóa đơn đã có.
- Lần đầu bấm **Lưu giá mâm vào danh sách món**, app tự tạo nhóm món **Mâm tiệc**.

---

## Bước 4 – Backup dữ liệu định kỳ

Gói miễn phí của Supabase **không có** bản sao lưu tự động mà bạn tải về được, nên hãy tự backup:

### Cách 1 – Xuất Excel trong app (khuyên dùng, mỗi tuần hoặc cuối tháng)

1. Vào mục **Backup** trong app.
2. Bấm **Xuất Excel danh sách món**.
3. Chọn khoảng ngày (ví dụ **Tháng này**) → bấm **Xuất Excel hóa đơn**. File gồm 2 trang: *Hóa đơn* và *Chi tiết*.
4. Chọn khoảng ngày → **Xuất Excel mua hàng** (2 trang: *Lần mua* và *Chi tiết mua*).
5. Bấm **Xuất Excel các đợt nấu** (mỗi dòng một đợt: chi phí, giá vốn, giá bán, lãi).
6. Cất các file vào Google Drive / máy tính / USB. Đặt nhắc lịch hằng tháng để không quên.

Bảng tính giá chi tiết của **một** đợt (chia theo nhóm hàng + danh sách hàng đã mua): mở đợt đó → nút **⬇ Excel**.

### Cách 2 – Tải toàn bộ bảng từ Supabase (backup đầy đủ)

1. Supabase → **Table Editor** → chọn lần lượt các bảng `categories`, `products`, `orders`, `order_items`, `ingredients`, `batches`, `purchases`, `purchase_items`.
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

**Menu trên điện thoại:** thanh dưới cùng có **Tính tiền, Mua hàng, Đợt nấu, Hóa đơn**; các mục **Món, Thống kê, Lãi lỗ, Backup** và **Đăng xuất** nằm trong nút **☰ Thêm**.

**Mua hàng (khi đi chợ)**
1. Mục **Mua hàng** → **+ Lần mua mới** (hoặc trong trang một đợt nấu → **+ Thêm lần mua**).
2. Chọn **Đợt nấu** (hoặc để *Mua chung* nếu là hàng dùng chung, không thuộc đơn tiệc nào).
3. Gõ tên hàng → bấm vào gợi ý: app tự điền đơn vị, nhóm và **giá lần trước**. Gõ không dấu cũng được (`thit` → *Thịt heo*).
4. Nhập **số lượng** (được nhập số lẻ, vd `1,5`) và **đơn giá** → app tự tính **thành tiền**. Không nhớ đơn giá thì nhập thẳng **thành tiền**, app tự tính đơn giá.
5. Bấm **➕ Thêm dòng** (hoặc nút *Tiếp/Enter* trên bàn phím ở ô tiền) để nhập món tiếp theo. Bấm **💾 Lưu** khi xong.
- Hàng mới chưa có trong danh mục sẽ được **tự thêm** vào danh mục. Sửa tên gõ sai / đổi nhóm ở nút **📦 Danh mục hàng**.
- Lỡ thoát ra hoặc điện thoại tải lại trang: phiếu đang nhập dở vẫn được giữ, lần sau mở **+ Lần mua mới** app sẽ hỏi có tiếp tục không.
- Bấm vào một lần mua trong danh sách để sửa hoặc xóa.

**Đợt nấu & tính giá mâm**
1. Mục **Đợt nấu** → **+ Tạo đợt**: nhập tên (vd *Tiệc nhà anh Nam 30/11*), ngày, số mâm, % lãi mong muốn (mặc định 30%).
2. Ghi các lần mua của đợt (xem phần Mua hàng). Trang đợt hiện:
   - **Tổng chi phí** và chi phí theo nhóm (thịt, cá, rau, gạo, gia vị, chi phí khác) kèm %; bấm vào một nhóm để xem từng mặt hàng.
   - **Giá vốn / mâm** = tổng chi phí ÷ số mâm.
   - **Giá bán gợi ý** = giá vốn × (1 + % lãi), làm tròn lên 5.000đ.
3. Nhập **Giá bán chốt** (hoặc bấm **Dùng giá gợi ý**) → app hiện **lãi mỗi mâm** và **tổng lãi cả đợt**. Đổi số mâm / % lãi là số liệu tính lại ngay và **tự lưu**.
4. **Lưu giá mâm vào danh sách món:** tạo (hoặc cập nhật) món *Mâm [tên đợt]* trong nhóm *Mâm tiệc* để bán ở màn hình **Tính tiền**.
5. **Chốt đợt** khi đã mua xong (đợt đã chốt không hiện trong ô chọn đợt khi nhập lần mua mới; bấm **Mở lại đợt** nếu cần mua thêm).
6. **Sao chép** (đơn tiệc lặp lại): tạo đợt mới nhớ danh sách hàng của đợt gốc. Trong đợt mới bấm **🛒 Mua hàng theo danh sách đợt gốc** để điền sẵn các dòng hàng (giá lấy theo lần mua gần nhất), sửa lại số lượng / giá cho đúng rồi lưu.
- Xóa một đợt: các lần mua của đợt **không bị xóa** mà chuyển thành *Mua chung*, vẫn được tính vào chi phí.

**Lãi lỗ**
- Chọn năm bằng nút ‹ ›. Biểu đồ cột so sánh **doanh thu** (hóa đơn bán, không tính hóa đơn đã hủy) và **chi phí mua hàng** từng tháng; bảng bên dưới có số liệu và **lãi / lỗ** mỗi tháng.
- Bấm vào một tháng (trên biểu đồ hoặc trong bảng) để xem riêng tháng đó, kể cả bảng **chi phí theo nhóm hàng**.
- **Theo dõi giá mua:** gõ tên một mặt hàng (vd *thịt heo*) để xem giá qua các lần mua, tăng / giảm bao nhiêu so với lần trước và lần đầu.

**In hóa đơn khổ 80mm:** khi hộp thoại in hiện ra, chọn máy in nhiệt, khổ giấy **80mm** (hoặc 80 x 297mm), **Lề (Margins): Không/None**, tắt **Đầu trang & chân trang (Headers and footers)**.

**Đổi tên shop hoặc lời cảm ơn trên hóa đơn:** sửa file [src/config.ts](src/config.ts), rồi `git push` lại.

---

## Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Trang đăng nhập báo *Chưa cấu hình kết nối Supabase* | Kiểm tra file `.env` (trên máy) hoặc biến môi trường trên Netlify, rồi chạy lại `npm run dev` / Trigger deploy. |
| *Sai email hoặc mật khẩu* | Kiểm tra lại tài khoản ở Supabase → Authentication → Users. Có thể đặt lại mật khẩu tại đó. |
| *Không kết nối được máy chủ* | Kiểm tra mạng; xem project Supabase có đang bị tạm dừng không. |
| Báo lỗi *function create_order does not exist* | Chưa tạo bảng dữ liệu – làm lại bước 1.2. |
| Mục Mua hàng / Đợt nấu / Lãi lỗ báo *Chưa cập nhật cơ sở dữ liệu...* | Chạy `npx supabase db push` – xem mục [Cập nhật cơ sở dữ liệu](#cập-nhật-cơ-sở-dữ-liệu-migration). |
| `db push` / `link` báo sai mật khẩu hoặc không kết nối được | Đặt lại mật khẩu ở **Project Settings → Database → Reset database password**, rồi chạy lại `npx supabase link --project-ref <project-ref>`. Kiểm tra project không bị tạm dừng. |
| `db push` báo *Cannot find project ref* | Chưa kết nối project – chạy bước 3 phần *Chuẩn bị* (`npx supabase link ...`). |
| Gõ tên hàng không thấy gợi ý | Gợi ý chỉ có sau khi hàng đó được lưu ít nhất một lần. Kiểm tra tên trong **📦 Danh mục hàng**. |
| Không tải được ảnh món | Dán lại file `supabase/migrations/20261127000000_khoi_tao.sql` vào SQL Editor và **Run** để tạo kho ảnh `product-images`. |
| Mở đường link trang con trên Netlify bị lỗi 404 | Đảm bảo file `public/_redirects` có trong code. |

---

## Cấu trúc thư mục

```
supabase/
  migrations/            Cấu trúc cơ sở dữ liệu, chạy theo thứ tự tên file (npx supabase db push)
    20261127000000_khoi_tao.sql   Bảng món, hóa đơn, bảo mật, hàm tạo hóa đơn & thống kê, kho ảnh, món mẫu
    20261127110000_mua_hang.sql   Bảng & hàm cho Mua hàng, Đợt nấu, tính giá mâm, báo cáo lãi lỗ
  config.toml            Cấu hình Supabase CLI (tạo bằng npx supabase init)
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
    costing.ts           Nhóm hàng, công thức giá vốn / giá gợi ý / lãi mỗi mâm
  components/            Thành phần dùng chung (menu, thông báo, hộp xác nhận, in hóa đơn...)
  pages/
    LoginPage.tsx        Đăng nhập
    PosPage.tsx          Tính tiền
    ProductsPage.tsx     Quản lý món (+ products/ProductForm, products/CategoryManager)
    OrdersPage.tsx       Lịch sử hóa đơn
    StatsPage.tsx        Thống kê
    BackupPage.tsx       Xuất Excel
    purchases/           Mua hàng: danh sách, nhập / sửa lần mua, danh mục hàng
    batches/             Đợt nấu: danh sách, trang chi tiết & tính giá mâm, form tạo / sao chép
    profit/              Lãi lỗ: biểu đồ theo tháng, theo dõi giá mua
```

Lệnh hữu ích: `npm run dev` (chạy thử), `npm run build` (kiểm tra lỗi & đóng gói), `npm run preview` (xem bản đã đóng gói).
