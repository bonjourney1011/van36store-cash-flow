# Dòng tiền máy cũ

Trang theo dõi dòng tiền cho việc mua bán iPhone và laptop cũ. Trang tách bạch ba phần mà trước đây thường bị gộp chung thành một con số:

- **Tiền:** tiền mặt và số dư tài khoản.
- **Chờ thu:** tiền COD đang trên đường về và tiền mối còn nợ.
- **Máy tồn:** tính theo **giá vốn**, không tính theo giá kỳ vọng.

Mỗi ngày trang cho biết: hôm nay mua được máy tối đa bao nhiêu tiền, máy nào nên xả trước, chờ giá còn đáng bao nhiêu ngày, và đơn hay mối nào đang trễ.

- Phương pháp đằng sau các con số: [docs/phuong-phap-kiem-soat-dong-tien.md](docs/phuong-phap-kiem-soat-dong-tien.md)
- Chi phí: 0đ. Hệ thống gồm GitHub Pages (trang), Google Apps Script (API) và Google Sheet (dữ liệu).
- Dữ liệu chỉ nằm trong Sheet. Repo này public nhưng **không chứa số liệu, token hay số tài khoản**.

---

## Cài đặt (khoảng 30 phút, làm 1 lần)

### Bước 1. Tạo Google Sheet và dán code

1. Vào `sheets.new` để tạo Sheet mới, đặt tên "Dòng tiền máy".
   - Nên tạo bằng tài khoản Google mà anh dùng hằng ngày, để email cảnh báo về đúng hộp thư của anh.
2. Mở **Tiện ích mở rộng → Apps Script**.
3. Với **từng file** trong thư mục `apps-script/`: bấm **＋ → Tập lệnh**, đặt tên đúng như tên file (bỏ đuôi `.gs`), rồi dán nội dung vào. Có 14 file:
   - `formatting-and-date-helpers`
   - `domain-constants`
   - `action-planner-common`
   - `action-planners-buy-and-sell`
   - `action-planners-money-in-and-adjust`
   - `cashflow-metrics-engine`
   - `machine-liquidity-analysis`
   - `action-recommendation-rules`
   - `dashboard-payload-builder`
   - `sheet-repository`
   - `setup-sheets-one-time`
   - `access-token-guard`
   - `main-web-app-handlers`
   - `owner-menu-and-daily-alert`
4. Vào **Cài đặt dự án ⚙️**, tick **"Hiển thị tệp kê khai appsscript.json"**. Sau đó mở `appsscript.json` và dán nội dung file cùng tên.
5. Ở thanh trên cùng, chọn hàm `setupSheets` rồi bấm **Chạy**.
   - Lần đầu Google sẽ hỏi quyền: bấm **Nâng cao → Đi tới… → Cho phép**.
   - Bước này tạo 4 tab `Config`, `May`, `SoTien`, `Snapshot` và đặt múi giờ GMT+7.

### Bước 2. Triển khai API

1. Bấm **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**, chọn:
   - Thực thi với tư cách: **Tôi**
   - Ai có quyền truy cập: **Bất kỳ ai**

   Chọn "Bất kỳ ai" là để trang gọi được API. Dữ liệu vẫn được bảo vệ bằng token ở bước 4.
2. Copy URL có đuôi `/exec`. Mở URL đó trên trình duyệt: nếu thấy `{"ok":true,"service":"dong-tien-may-cu"}` là API đã chạy.
3. Dán URL vào `assets/js/site-config.js` ở dòng `apiUrl: '...'`.
4. **Khi sửa code về sau:** vào **Quản lý việc triển khai → ✏️ → Phiên bản: Mới**. Cách này giữ nguyên URL. Chỉ sửa dữ liệu trong Sheet thì không cần triển khai lại.

### Bước 3. Đưa trang lên GitHub Pages

1. Đẩy thư mục này lên một repo GitHub. Thư mục `plans/` đã được loại khỏi git.
2. Vào **Settings → Pages**, chọn Branch `main` và thư mục `/ (root)`.
3. Copy link trang (dạng `https://<tên>.github.io/<repo>/`), dán vào tab `Config`, dòng `site_url`.

### Bước 4. Tạo link riêng cho anh

1. Mở lại Sheet. Đợi vài giây sẽ thấy menu **Dòng tiền** xuất hiện.
2. Chọn **Dòng tiền → 🔑 Tạo link mới cho anh**, rồi copy link có dạng `.../#t=...`.
3. Gửi link qua **tin nhắn riêng**. Anh mở link 1 lần trên điện thoại là trang tự nhớ, sau đó có thể "Thêm vào màn hình chính".
4. Ai có link là xem được số liệu. Nếu lỡ lộ link, chạy lại mục 🔑: link cũ hết hiệu lực ngay.
5. Nhập sai token 5 lần trong 10 phút thì API tự khoá 10 phút.

### Bước 5. Bật nhắc mỗi sáng

1. Chọn **Dòng tiền → ⏰ Bật nhắc 8h sáng hằng ngày** và cho phép quyền Gmail.
2. Mỗi sáng hệ thống ghi một điểm cho biểu đồ, và **chỉ gửi email khi có việc cần làm**.
3. Muốn email về hộp thư khác: vào Apps Script → **Cài đặt dự án → Thuộc tính tập lệnh**, thêm `NOTIFY_EMAIL` = địa chỉ email đó.
4. Bấm **📨 Chạy kiểm tra + gửi email ngay** để thử.

### Bước 6. Kiểm kê đầu kỳ (anh làm)

1. Đếm tiền mặt và xem số dư tài khoản, rồi vào tab **Nhập → Kiểm kê đầu kỳ**.
   - Đang có khoản vay: ghi vào "Nợ vay đang có" trong "Thêm chi tiết".
   - Mọi thao tác khác bị khoá cho đến khi có đầu kỳ, để không bị trừ tiền 2 lần.
2. Với từng máy đang có: bấm nút xanh **📦 Thêm máy đang có**.
   - Nút này hiện trong 14 ngày đầu sau khi kiểm kê.
   - Giá vốn = giá mua + tiền đã sửa. Ngày mua ước chừng cũng được.
   - Máy này không bị trừ tiền. Lưu xong, form tự mở lại cho máy tiếp theo.
   - Phát hiện máy cũ sau 14 ngày: dùng **Mua máy**, mở "Thêm chi tiết", tick "Máy có sẵn".
3. Máy đang đi COD hoặc đang ở chỗ mối: thêm như bước 2, sau đó chọn **Bán / gửi máy** với ngày gửi cũ (trong "Thêm chi tiết").
   - Không ghi tiền cọc hay số mối đã trả **trước ngày kiểm kê**, vì số tiền đó đã nằm trong tiền đầu kỳ.
   - Thay vào đó, ghi giá bán bằng **số tiền còn phải thu**.
4. Ghi mã máy (M0001…) lên giấy dán vào máy, để khi bán chọn đúng máy.

---

## Dùng hằng ngày

Nguyên tắc: **chỉ nhập khi tiền hoặc máy đổi chỗ.** Ngày tự điền là hôm nay; nếu nhập bù thì đổi ngày trong "Thêm chi tiết".

| Khi nào | Bấm | Nhập |
|---|---|---|
| Trả tiền mua máy | **Mua máy** | nhóm, tên máy, giá mua (nên điền thêm giá kỳ vọng) |
| Trả tiền sửa hoặc linh kiện | **Chi sửa** | chọn máy, số tiền |
| Khách lấy máy tại chỗ | **Bán / gửi → Tại chỗ** | máy, giá bán |
| Giao cho shipper | **Bán / gửi → COD** | máy, giá bán, hãng (có cọc thì ghi tiền cọc) |
| Giao cho mối | **Bán / gửi → Mối** | máy, giá bán, tên mối, trả ngay hay nợ |
| **Thấy tiền vào tài khoản** (hãng đối soát hoặc mối trả) | **Tiền về** | tick các đơn, nhập tổng tiền thực nhận. Phần chênh lệch tự được ghi là phí ship/COD |
| Đơn bị hoàn, hoặc mối trả lại máy | **Hoàn hàng** | đơn, phí mất. Thường hãng trừ phí vào lần đối soát sau: khi đó bấm "Tiền về" và ghi "Phí hoàn hãng trừ" |
| Khách đổi máy cũ lấy máy khác | **Thu cũ đổi mới** | máy đưa khách, giá bán, máy nhận về, giá định |
| Rút tiền tiêu cá nhân, trả mặt bằng, góp vốn | **Thu / chi khác** | loại, số tiền |
| **Chủ nhật** | **Đối chiếu số dư** | tiền mặt đếm được, số dư tài khoản |

- **Cách gõ tiền:** gõ trên bàn phím số.
  - Ô giá (mua, bán, tiền nhận): tính theo **triệu**. `12,5` = 12.500.000.
  - Ô phí (sửa, ship, hoàn, bảo hành, cọc): tính theo **nghìn**. `300` = 300.000.
  - Trên máy tính gõ được `12tr5` hoặc `800k`.
  - Ô nhập luôn hiện số đã hiểu ngay bên dưới để kiểm tra.
- **Mỗi tối khoảng 1 phút:** mở app ngân hàng; có tiền đối soát hoặc tiền mối trả thì bấm "Tiền về".
- **Nhập nhầm:** sửa thẳng trong Sheet, ở tab `May` (thông tin máy) và tab `SoTien` (dòng tiền), rồi làm "Đối chiếu số dư".
  - Không đổi tên tab.
  - Không chèn cột vào giữa.
  - Không xoá dòng tiêu đề.
- **Đổi ngưỡng cảnh báo** (vốn đệm, trần 1 máy, số ngày tồn theo nhóm…): sửa trong tab `Config`, cột "ghi chú" giải thích từng dòng.

## Nhịp xem số

- **Mỗi ngày:** xem tab Tổng quan, phần "Nên làm gì".
- **Mỗi tuần:** đối chiếu số dư, rồi xem tab "Máy & đơn". Máy nằm trên cùng là máy kẹt nhiều vốn nhất.
- **Mỗi tháng:** xem "Tiền tháng này đi đâu" và "Nhịp quay vốn". Vốn đang thiếu hay dư so với nhịp bán? Nhóm máy nào cho lãi mỗi ngày cao nhất?

## Cho người sửa code

- `npm test` chạy unit test, gồm các file `.gs` thật chạy trong Node (`node:vm`, TZ Asia/Ho_Chi_Minh).
- `npm run serve` chạy trang ở máy để xem giao diện. Muốn có dữ liệu thì cần `apiUrl` thật.
- Phần logic (`action-planner*`, `cashflow-metrics-engine`, `machine-liquidity-analysis`, `action-recommendation-rules`, `dashboard-payload-builder`) là hàm thuần, không gọi dịch vụ Google.
  - Mọi thao tác trả về một plan `{ newMachines, updates, ledgerRows }`.
  - Chỉ `sheet-repository.gs` ghi plan đó vào Sheet.
- Thêm cột mới thì chỉ thêm vào **cuối** danh sách header trong `domain-constants.gs`, và thêm cột ở cuối tab tương ứng.
