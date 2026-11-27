-- =====================================================================
--  THÁI HÒA SHOP - MIGRATION 2: QUẢN LÝ MUA HÀNG & TÍNH GIÁ MÂM
--
--  Chạy SAU migration 1 (cần các bảng món, nhóm món, hóa đơn có sẵn).
--  Áp dụng: npx supabase db push   (xem README, mục "Cập nhật cơ sở dữ liệu")
--  hoặc dán toàn bộ file vào Supabase > SQL Editor > Run.
--  Có thể chạy lại nhiều lần mà không mất dữ liệu.
--  ĐÃ ÁP DỤNG LÊN SUPABASE THÌ KHÔNG SỬA FILE NÀY - thay đổi mới viết vào migration mới.
--
--  Nhóm hàng (cột item_group) nhận một trong các giá trị:
--    'thịt' | 'cá/hải sản' | 'rau củ' | 'gạo/đồ khô' | 'gia vị' | 'chi phí khác'
--  Tiền là số nguyên (VND). Số lượng được có số lẻ (vd 1,5 kg).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG
-- ---------------------------------------------------------------------

-- Danh mục hàng hay mua: dùng để gợi ý tên, đơn vị, giá lần trước khi nhập
create table if not exists public.ingredients (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  unit        text not null default '',
  item_group  text not null default 'chi phí khác'
              check (item_group in ('thịt', 'cá/hải sản', 'rau củ', 'gạo/đồ khô', 'gia vị', 'chi phí khác')),
  last_price  integer check (last_price >= 0),             -- đơn giá lần mua gần nhất
  created_at  timestamptz not null default now()
);

-- Không cho trùng tên hàng (không phân biệt hoa thường, bỏ khoảng trắng 2 đầu)
create unique index if not exists ingredients_name_key on public.ingredients (lower(btrim(name)));

-- Đợt nấu / đơn tiệc
create table if not exists public.batches (
  id              bigint generated always as identity primary key,
  name            text not null check (length(trim(name)) > 0),   -- vd "Tiệc nhà anh Nam 30/11"
  date            date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  tray_count      integer not null default 1 check (tray_count > 0),           -- số mâm
  profit_percent  integer not null default 30 check (profit_percent between 0 and 1000),
  final_price     integer check (final_price >= 0),                            -- giá bán chốt / mâm
  note            text,
  status          text not null default 'đang mua' check (status in ('đang mua', 'đã chốt')),
  product_id      bigint references public.products(id) on delete set null,    -- món "Mâm ..." đã tạo
  copied_from_id  bigint references public.batches(id) on delete set null,     -- đợt gốc khi sao chép
  created_at      timestamptz not null default now()
);

-- Lần mua hàng. batch_id để trống = mua chung, không thuộc đợt nào.
-- Xóa đợt nấu thì các lần mua vẫn giữ (chuyển thành mua chung) để không mất chi phí.
create table if not exists public.purchases (
  id            bigint generated always as identity primary key,
  batch_id      bigint references public.batches(id) on delete set null,
  purchased_at  timestamptz not null default now(),
  place         text,                                       -- nơi mua (tùy chọn)
  note          text,
  total         integer not null default 0 check (total >= 0),
  created_at    timestamptz not null default now()
);

-- Từng dòng hàng trong lần mua. item_name / item_group / unit là bản lưu
-- tại thời điểm mua: sửa danh mục sau này thì lần mua cũ vẫn đúng.
create table if not exists public.purchase_items (
  id             bigint generated always as identity primary key,
  purchase_id    bigint not null references public.purchases(id) on delete cascade,
  ingredient_id  bigint references public.ingredients(id) on delete set null,
  item_name      text not null check (length(trim(item_name)) > 0),
  item_group     text not null
                 check (item_group in ('thịt', 'cá/hải sản', 'rau củ', 'gạo/đồ khô', 'gia vị', 'chi phí khác')),
  quantity       numeric(12, 3) not null default 1 check (quantity > 0),
  unit           text not null default '',
  unit_price     integer not null check (unit_price >= 0),
  line_total     integer not null check (line_total >= 0)
);

create index if not exists batches_date_idx                 on public.batches (date desc);
create index if not exists purchases_purchased_at_idx       on public.purchases (purchased_at desc);
create index if not exists purchases_batch_id_idx           on public.purchases (batch_id);
create index if not exists purchase_items_purchase_id_idx   on public.purchase_items (purchase_id);
create index if not exists purchase_items_ingredient_id_idx on public.purchase_items (ingredient_id);

-- ---------------------------------------------------------------------
-- 2. BẢO MẬT (Row Level Security) - giống các bảng cũ:
--    chỉ người đã đăng nhập mới được đọc/ghi.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on
  public.ingredients, public.batches, public.purchases, public.purchase_items
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.ingredients, public.batches, public.purchases, public.purchase_items from anon;

alter table public.ingredients    enable row level security;
alter table public.batches        enable row level security;
alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;

drop policy if exists "Chỉ người đăng nhập" on public.ingredients;
create policy "Chỉ người đăng nhập" on public.ingredients
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.batches;
create policy "Chỉ người đăng nhập" on public.batches
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.purchases;
create policy "Chỉ người đăng nhập" on public.purchases
  for all to authenticated using (true) with check (true);

drop policy if exists "Chỉ người đăng nhập" on public.purchase_items;
create policy "Chỉ người đăng nhập" on public.purchase_items
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. HÀM LƯU / XÓA LẦN MUA
-- ---------------------------------------------------------------------

-- Cập nhật "giá lần trước" (và đơn vị, nhóm) trong danh mục theo lần mua
-- MỚI NHẤT của từng mặt hàng. Gọi sau khi thêm / sửa / xóa lần mua.
create or replace function public.refresh_ingredient_prices(p_ids bigint[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.ingredients i
     set last_price = l.unit_price,
         unit       = l.unit,
         item_group = l.item_group
  from (
    select distinct on (pi.ingredient_id) pi.ingredient_id, pi.unit_price, pi.unit, pi.item_group
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
    where pi.ingredient_id = any (p_ids)
    order by pi.ingredient_id, p.purchased_at desc, pi.id desc
  ) l
  where i.id = l.ingredient_id;
$$;

-- Lưu một lần mua (thêm mới hoặc sửa) cùng toàn bộ dòng hàng trong MỘT giao dịch.
--   p_id: để trống = thêm mới; có giá trị = sửa lần mua đó (thay toàn bộ dòng hàng)
--   p_items: [{"item_name": "Thịt heo", "item_group": "thịt", "quantity": 1.5,
--              "unit": "kg", "unit_price": 120000, "line_total": 180000}, ...]
--     - Chỉ cần đơn giá HOẶC thành tiền, cái còn lại tự tính.
--     - Hàng chưa có trong danh mục sẽ được tự thêm vào danh mục.
create or replace function public.save_purchase(
  p_id           bigint,
  p_batch_id     bigint,
  p_purchased_at timestamptz,
  p_place        text,
  p_note         text,
  p_items        jsonb
)
returns public.purchases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_purchase public.purchases;
  v_old_ids  bigint[] := '{}';
  v_el       jsonb;
  v_name     text;
  v_group    text;
  v_qty      numeric;
  v_unit     text;
  v_price    integer;
  v_total    integer;
  v_ing      bigint;
  v_sum      bigint := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Chưa có dòng hàng nào';
  end if;

  if p_batch_id is not null and not exists (select 1 from public.batches where id = p_batch_id) then
    raise exception 'Đợt nấu không còn tồn tại, vui lòng tải lại trang';
  end if;

  if p_id is null then
    insert into public.purchases (batch_id, purchased_at, place, note)
    values (p_batch_id, coalesce(p_purchased_at, now()),
            nullif(trim(coalesce(p_place, '')), ''), nullif(trim(coalesce(p_note, '')), ''))
    returning * into v_purchase;
  else
    -- Nhớ các mặt hàng cũ để cập nhật lại giá lần trước sau khi sửa
    select coalesce(array_agg(distinct ingredient_id) filter (where ingredient_id is not null), '{}')
      into v_old_ids
    from public.purchase_items where purchase_id = p_id;

    update public.purchases
       set batch_id     = p_batch_id,
           purchased_at = coalesce(p_purchased_at, purchased_at),
           place        = nullif(trim(coalesce(p_place, '')), ''),
           note         = nullif(trim(coalesce(p_note, '')), '')
     where id = p_id
    returning * into v_purchase;

    if not found then
      raise exception 'Lần mua này không còn tồn tại, vui lòng tải lại trang';
    end if;

    delete from public.purchase_items where purchase_id = p_id;
  end if;

  for v_el in
    select e.value from jsonb_array_elements(p_items) with ordinality as e(value, ord) order by e.ord
  loop
    v_name  := trim(coalesce(v_el->>'item_name', ''));
    v_group := coalesce(nullif(v_el->>'item_group', ''), 'chi phí khác');
    v_qty   := coalesce(nullif(v_el->>'quantity', '')::numeric, 1);
    v_unit  := trim(coalesce(v_el->>'unit', ''));
    v_price := nullif(v_el->>'unit_price', '')::integer;
    v_total := nullif(v_el->>'line_total', '')::integer;

    if v_name = '' then
      raise exception 'Có dòng hàng chưa nhập tên';
    end if;
    if v_group not in ('thịt', 'cá/hải sản', 'rau củ', 'gạo/đồ khô', 'gia vị', 'chi phí khác') then
      raise exception 'Nhóm hàng của "%" không hợp lệ', v_name;
    end if;
    if v_qty <= 0 then
      raise exception 'Số lượng của "%" phải lớn hơn 0', v_name;
    end if;
    if v_price is null and v_total is null then
      raise exception '"%" chưa có đơn giá hoặc thành tiền', v_name;
    end if;

    -- Thiếu cái nào thì tự tính cái đó
    v_total := coalesce(v_total, round(v_qty * v_price)::integer);
    v_price := coalesce(v_price, round(v_total / v_qty)::integer);
    if v_total < 0 or v_price < 0 then
      raise exception 'Số tiền của "%" không hợp lệ', v_name;
    end if;

    -- Hàng mới chưa có trong danh mục thì tự thêm vào danh mục
    insert into public.ingredients (name, unit, item_group, last_price)
    values (v_name, v_unit, v_group, v_price)
    on conflict ((lower(btrim(name)))) do nothing;

    select id into v_ing from public.ingredients where lower(btrim(name)) = lower(v_name);

    insert into public.purchase_items
      (purchase_id, ingredient_id, item_name, item_group, quantity, unit, unit_price, line_total)
    values (v_purchase.id, v_ing, v_name, v_group, v_qty, v_unit, v_price, v_total);

    v_sum := v_sum + v_total;
  end loop;

  if v_sum > 2000000000 then
    raise exception 'Tổng tiền quá lớn, vui lòng kiểm tra lại';
  end if;

  update public.purchases set total = v_sum where id = v_purchase.id
  returning * into v_purchase;

  perform public.refresh_ingredient_prices(
    v_old_ids || array(select distinct ingredient_id from public.purchase_items
                       where purchase_id = v_purchase.id and ingredient_id is not null)
  );

  return v_purchase;
end;
$$;

-- Xóa một lần mua (kèm các dòng hàng) và cập nhật lại giá lần trước
create or replace function public.delete_purchase(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
begin
  select coalesce(array_agg(distinct ingredient_id) filter (where ingredient_id is not null), '{}')
    into v_ids
  from public.purchase_items where purchase_id = p_id;

  delete from public.purchases where id = p_id;

  perform public.refresh_ingredient_prices(v_ids);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. LƯU GIÁ MÂM VÀO DANH SÁCH MÓN
--    Tạo (lần đầu) hoặc cập nhật món "Mâm [tên đợt]" với giá bán chốt,
--    nằm trong nhóm món "Mâm tiệc", để bán ở màn hình Tính tiền.
-- ---------------------------------------------------------------------
create or replace function public.save_batch_product(p_batch_id bigint)
returns public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batch   public.batches;
  v_cat     bigint;
  v_product public.products;
  v_name    text;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then
    raise exception 'Đợt nấu không còn tồn tại, vui lòng tải lại trang';
  end if;
  if v_batch.final_price is null or v_batch.final_price <= 0 then
    raise exception 'Vui lòng nhập giá bán chốt trước';
  end if;

  v_name := 'Mâm ' || trim(v_batch.name);

  -- Đã tạo món trước đó: cập nhật tên + giá, hiện lại nếu đang ẩn
  if v_batch.product_id is not null then
    update public.products
       set name = v_name, price = v_batch.final_price, unit = 'mâm', is_active = true
     where id = v_batch.product_id
    returning * into v_product;
  end if;

  -- Chưa có (hoặc món cũ đã bị xóa): tạo món mới trong nhóm "Mâm tiệc"
  if v_product.id is null then
    select id into v_cat from public.categories where lower(trim(name)) = 'mâm tiệc' order by id limit 1;
    if v_cat is null then
      insert into public.categories (name, sort_order)
      values ('Mâm tiệc', coalesce((select max(sort_order) from public.categories), 0) + 1)
      returning id into v_cat;
    end if;

    insert into public.products (name, price, unit, category_id)
    values (v_name, v_batch.final_price, 'mâm', v_cat)
    returning * into v_product;

    update public.batches set product_id = v_product.id where id = v_batch.id;
  end if;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. BÁO CÁO LÃI LỖ THEO THÁNG (theo giờ Việt Nam)
--    Doanh thu = tổng hóa đơn đã thanh toán (bỏ hóa đơn đã hủy)
--    Chi phí   = tổng các lần mua hàng
--    Trả về 12 tháng của năm p_year:
--    [{"month": 1, "revenue": ..., "cost": ..., "groups": {"thịt": ..., ...}}, ...]
-- ---------------------------------------------------------------------
create or replace function public.profit_report(p_year integer)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Asia/Ho_Chi_Minh')     as start_at,
           make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Asia/Ho_Chi_Minh') as end_at
  ),
  rev as (
    select extract(month from o.created_at at time zone 'Asia/Ho_Chi_Minh')::int as m,
           sum(o.total) as revenue
    from public.orders o, bounds b
    where o.status = 'paid' and o.created_at >= b.start_at and o.created_at < b.end_at
    group by 1
  ),
  cost as (
    select extract(month from p.purchased_at at time zone 'Asia/Ho_Chi_Minh')::int as m,
           sum(p.total) as cost
    from public.purchases p, bounds b
    where p.purchased_at >= b.start_at and p.purchased_at < b.end_at
    group by 1
  ),
  grp as (
    select m, jsonb_object_agg(item_group, amount) as groups
    from (
      select extract(month from p.purchased_at at time zone 'Asia/Ho_Chi_Minh')::int as m,
             pi.item_group,
             sum(pi.line_total) as amount
      from public.purchase_items pi
      join public.purchases p on p.id = pi.purchase_id, bounds b
      where p.purchased_at >= b.start_at and p.purchased_at < b.end_at
      group by 1, 2
    ) t
    group by m
  )
  select jsonb_agg(
           jsonb_build_object(
             'month',   mo.m,
             'revenue', coalesce(rev.revenue, 0),
             'cost',    coalesce(cost.cost, 0),
             'groups',  coalesce(grp.groups, '{}'::jsonb)
           ) order by mo.m)
  from generate_series(1, 12) as mo(m)
  left join rev  on rev.m  = mo.m
  left join cost on cost.m = mo.m
  left join grp  on grp.m  = mo.m;
$$;

-- Chỉ người đã đăng nhập mới được gọi các hàm
revoke execute on function public.refresh_ingredient_prices(bigint[]) from public, anon;
revoke execute on function public.save_purchase(bigint, bigint, timestamptz, text, text, jsonb) from public, anon;
revoke execute on function public.delete_purchase(bigint) from public, anon;
revoke execute on function public.save_batch_product(bigint) from public, anon;
revoke execute on function public.profit_report(integer) from public, anon;
grant  execute on function public.refresh_ingredient_prices(bigint[]) to authenticated;
grant  execute on function public.save_purchase(bigint, bigint, timestamptz, text, text, jsonb) to authenticated;
grant  execute on function public.delete_purchase(bigint) to authenticated;
grant  execute on function public.save_batch_product(bigint) to authenticated;
grant  execute on function public.profit_report(integer) to authenticated;
