-- =====================================================================
--  THÁI HÒA SHOP - Cơ sở dữ liệu
--  Cách dùng: mở Supabase > SQL Editor > New query, dán toàn bộ file
--  này vào rồi bấm "Run". Có thể chạy lại nhiều lần mà không mất dữ liệu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG
-- ---------------------------------------------------------------------

-- Nhóm món (Đồ uống, Đồ ăn, ...)
create table if not exists public.categories (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Món / sản phẩm. Giá lưu bằng số nguyên (VND).
create table if not exists public.products (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  price       integer not null check (price >= 0),
  unit        text not null default 'phần',
  category_id bigint references public.categories(id) on delete set null,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hóa đơn. Mọi số tiền là số nguyên (VND).
create table if not exists public.orders (
  id             bigint generated always as identity primary key,
  code           text not null unique,              -- VD: HD-20261127-001
  created_at     timestamptz not null default now(),
  subtotal       integer not null check (subtotal >= 0),
  discount       integer not null default 0 check (discount >= 0),
  total          integer not null check (total >= 0),
  amount_paid    integer not null check (amount_paid >= 0),
  change_amount  integer not null default 0 check (change_amount >= 0),
  note           text,
  status         text not null default 'paid' check (status in ('paid', 'cancelled'))
);

-- Chi tiết hóa đơn.
-- product_name và unit_price là bản lưu tại thời điểm bán:
-- đổi tên/giá món sau này thì hóa đơn cũ vẫn đúng.
create table if not exists public.order_items (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders(id) on delete cascade,
  -- "on delete restrict": không thể xóa hẳn món đã từng có trong hóa đơn
  product_id    bigint references public.products(id) on delete restrict,
  product_name  text not null,
  unit_price    integer not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    integer not null check (line_total >= 0)
);

create index if not exists orders_created_at_idx      on public.orders (created_at desc);
create index if not exists order_items_order_id_idx   on public.order_items (order_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists products_category_id_idx   on public.products (category_id);

-- Tự cập nhật updated_at mỗi khi sửa món
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. BẢO MẬT (Row Level Security)
--    Chỉ người dùng đã đăng nhập mới được đọc/ghi. Khách vãng lai
--    (chưa đăng nhập) không thấy gì.
-- ---------------------------------------------------------------------
-- Cấp quyền cho người đã đăng nhập (cần khi project tắt mục
-- "Grant API access to new tables automatically"). Khách chưa đăng nhập
-- (anon) không được cấp quyền gì.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.categories, public.products, public.orders, public.order_items
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.categories, public.products, public.orders, public.order_items from anon;

alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Chỉ người đăng nhập" on public.categories;
create policy "Chỉ người đăng nhập" on public.categories
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.products;
create policy "Chỉ người đăng nhập" on public.products
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.orders;
create policy "Chỉ người đăng nhập" on public.orders
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.order_items;
create policy "Chỉ người đăng nhập" on public.order_items
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. HÀM TẠO HÓA ĐƠN
--    Lưu hóa đơn + chi tiết trong MỘT giao dịch (không bao giờ bị lưu
--    dở dang), tự sinh mã HD-YYYYMMDD-NNN theo ngày giờ Việt Nam.
--    Tên và giá món được lấy trực tiếp từ bảng products lúc thanh toán.
--
--    p_items: [{"product_id": 1, "quantity": 2}, ...]
--    p_discount_type: 'amount' (giảm theo số tiền) | 'percent' (giảm theo %)
--    p_amount_paid: tiền khách đưa; để trống = khách đưa đủ tiền
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_items          jsonb,
  p_discount_type  text    default 'amount',
  p_discount_value integer default 0,
  p_amount_paid    integer default null,
  p_note           text    default null
)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefix    text := 'HD-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-';
  v_seq       integer;
  v_count     integer;
  v_subtotal  integer;
  v_discount  integer := 0;
  v_total     integer;
  v_paid      integer;
  v_order     public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng đang trống';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer)
    where i.quantity is null or i.quantity <= 0
  ) then
    raise exception 'Số lượng món không hợp lệ';
  end if;

  -- Tính tạm tính theo giá hiện tại của món
  select count(*), coalesce(sum(p.price * i.quantity), 0)
    into v_count, v_subtotal
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity integer)
  join public.products p on p.id = i.product_id;

  if v_count <> jsonb_array_length(p_items) then
    raise exception 'Có món không còn tồn tại, vui lòng tải lại trang';
  end if;

  -- Giảm giá: không âm, không vượt quá tạm tính
  if p_discount_type = 'percent' then
    v_discount := round(v_subtotal * least(greatest(coalesce(p_discount_value, 0), 0), 100) / 100.0);
  else
    v_discount := least(greatest(coalesce(p_discount_value, 0), 0), v_subtotal);
  end if;

  v_total := v_subtotal - v_discount;
  v_paid  := coalesce(p_amount_paid, v_total);

  if v_paid < v_total then
    raise exception 'Tiền khách đưa chưa đủ';
  end if;

  -- Khóa để 2 lần bấm thanh toán cùng lúc không bị trùng mã
  perform pg_advisory_xact_lock(hashtext('thaihoashop_order_code'));

  select coalesce(max(substring(code from length(v_prefix) + 1)::integer), 0) + 1
    into v_seq
  from public.orders
  where code like v_prefix || '%';

  insert into public.orders (code, subtotal, discount, total, amount_paid, change_amount, note, status)
  values (
    v_prefix || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0'),
    v_subtotal, v_discount, v_total, v_paid, v_paid - v_total,
    nullif(trim(coalesce(p_note, '')), ''),
    'paid'
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  select v_order.id, p.id, p.name, p.price, i.quantity, p.price * i.quantity
  from rows from (jsonb_to_recordset(p_items) as (product_id bigint, quantity integer))
       with ordinality as i(product_id, quantity, ord)
  join public.products p on p.id = i.product_id
  order by i.ord;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. HÀM THỐNG KÊ (theo giờ Việt Nam, bỏ qua hóa đơn đã hủy)
-- ---------------------------------------------------------------------

-- Thống kê từ một thời điểm đến hiện tại: doanh thu, số hóa đơn, top món
create or replace function public.period_stats(p_from timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'revenue', coalesce((
      select sum(total) from public.orders
      where status = 'paid' and created_at >= p_from
    ), 0),
    'orders', (
      select count(*) from public.orders
      where status = 'paid' and created_at >= p_from
    ),
    'top', coalesce((
      select jsonb_agg(t order by t.quantity desc, t.revenue desc)
      from (
        select max(oi.product_name) as name,
               sum(oi.quantity)     as quantity,
               sum(oi.line_total)   as revenue
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.status = 'paid' and o.created_at >= p_from
        group by coalesce(oi.product_id::text, oi.product_name)
        order by sum(oi.quantity) desc, sum(oi.line_total) desc
        limit 10
      ) t
    ), '[]'::jsonb)
  );
$$;

-- Hôm nay / 7 ngày (gồm hôm nay) / tháng này
create or replace function public.get_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'Asia/Ho_Chi_Minh';  -- giờ VN hiện tại
begin
  return jsonb_build_object(
    'today', public.period_stats(date_trunc('day', v_local) at time zone 'Asia/Ho_Chi_Minh'),
    'week',  public.period_stats((date_trunc('day', v_local) - interval '6 days') at time zone 'Asia/Ho_Chi_Minh'),
    'month', public.period_stats(date_trunc('month', v_local) at time zone 'Asia/Ho_Chi_Minh')
  );
end;
$$;

-- Chỉ người đã đăng nhập mới được gọi các hàm
revoke execute on function public.create_order(jsonb, text, integer, integer, text) from public, anon;
revoke execute on function public.period_stats(timestamptz) from public, anon;
revoke execute on function public.get_stats() from public, anon;
grant  execute on function public.create_order(jsonb, text, integer, integer, text) to authenticated;
grant  execute on function public.period_stats(timestamptz) to authenticated;
grant  execute on function public.get_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 5. KHO ẢNH MÓN (Supabase Storage, miễn phí)
--    Ảnh được xem công khai qua đường link; chỉ người đăng nhập được
--    tải lên / thay / xóa.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Thai Hoa - tải ảnh món" on storage.objects;
create policy "Thai Hoa - tải ảnh món" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "Thai Hoa - sửa ảnh món" on storage.objects;
create policy "Thai Hoa - sửa ảnh món" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "Thai Hoa - xóa ảnh món" on storage.objects;
create policy "Thai Hoa - xóa ảnh món" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ---------------------------------------------------------------------
-- 6. DỮ LIỆU MẪU (chỉ thêm khi chưa có nhóm món nào)
--    Có thể sửa / ẩn / xóa trong màn hình "Quản lý món".
-- ---------------------------------------------------------------------
do $$
declare
  v_uong bigint;
  v_an   bigint;
  v_sp   bigint;
begin
  if exists (select 1 from public.categories) then
    return;
  end if;

  insert into public.categories (name, sort_order) values ('Đồ uống', 1) returning id into v_uong;
  insert into public.categories (name, sort_order) values ('Đồ ăn', 2)   returning id into v_an;
  insert into public.categories (name, sort_order) values ('Sản phẩm', 3) returning id into v_sp;

  insert into public.products (name, price, unit, category_id) values
    ('Cà phê đen',        20000, 'ly',   v_uong),
    ('Cà phê sữa',        25000, 'ly',   v_uong),
    ('Bạc xỉu',           28000, 'ly',   v_uong),
    ('Trà đá',             5000, 'ly',   v_uong),
    ('Trà chanh',         15000, 'ly',   v_uong),
    ('Nước cam',          30000, 'ly',   v_uong),
    ('Bánh mì thịt',      25000, 'cái',  v_an),
    ('Bánh mì ốp la',     20000, 'cái',  v_an),
    ('Xôi gà',            30000, 'phần', v_an),
    ('Mì xào bò',         40000, 'phần', v_an),
    ('Nước suối',         10000, 'chai', v_sp),
    ('Bánh quy',          15000, 'gói',  v_sp),
    ('Hạt điều rang',    280000, 'kg',   v_sp);
end;
$$;
