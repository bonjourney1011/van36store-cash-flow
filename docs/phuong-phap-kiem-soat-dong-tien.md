# Phương pháp kiểm soát dòng tiền cho mua bán máy cũ

Tài liệu này giải thích cách hệ thống tính từng con số, vì sao tính như vậy, và nên đọc số thế nào để ra quyết định.

- Mọi ví dụ dưới đây dùng **số minh hoạ tròn**, không phải số thật của cửa hàng.
- Tên các ngưỡng trong `code` là tên dòng tương ứng trong tab `Config`.

---

## 1. Vì sao "tổng tài sản" đánh lừa

Ví dụ một tháng như sau:

| | Đầu tháng | Cuối tháng |
|---|---|---|
| Tiền mặt + tài khoản | 60tr | 25tr |
| Máy tồn | 40tr | 70tr |
| COD đang về | 0 | 12tr |
| **Tổng** | **100tr** | **107tr** |

Nhìn tổng thì có vẻ "làm được 7tr", nhưng thực tế:

- **Tiền mặt giảm 35tr.** Tiền đã biến thành máy và thành đơn đang đi.
- 7tr "lãi" kia chưa có đồng nào về tay. Nếu 2 đơn COD bị hoàn, hoặc máy phải bán thấp hơn giá vốn, con số này có thể âm.
- Nếu máy tồn còn được tính theo **giá kỳ vọng**, tổng còn đẹp hơn nữa. Khi đó lãi bị ghi nhận trước khi bán được máy.

**Kết luận:** sức khoẻ của một business quay vòng hàng không nằm ở con số tổng. Nó nằm ở chỗ **tiền đang ở dạng nào, và bao lâu nữa quay về thành tiền mặt.**

## 2. Bốn phần tài sản

| Phần | Gồm | Định giá | Câu hỏi nó trả lời |
|---|---|---|---|
| **A. Tiền** | tiền mặt + tài khoản kinh doanh | số thực tế | Hôm nay tiêu được bao nhiêu? |
| **B. Chờ thu** | COD đang đi + mối còn nợ | giá bán − phần đã thu | Bao nhiêu tiền sắp về, và đã trễ chưa? |
| **C. Máy tồn** | máy chưa bán | **giá vốn** = giá mua + sửa + linh kiện + phí hoàn | Bao nhiêu vốn đang nằm im? |
| **D. Nợ** | tiền vay | số thực tế | Bao nhiêu trong số trên không phải của mình? |

**Vốn chủ = A + B + C − D.**

**Tỷ lệ tiền** = A ÷ (A + B + C). Đây là chỉ số sức khoẻ đơn giản nhất. Tỷ lệ này giảm dần qua các tuần là dấu hiệu vốn đang bị kẹt, kể cả khi vốn chủ vẫn tăng.

Vì sao máy tồn phải tính theo giá vốn: giá kỳ vọng chỉ là hy vọng. Cả thị trường máy cũ đều mất giá theo thời gian, đặc biệt quanh tháng 9 khi Apple ra máy mới. Hệ thống hiện riêng con số "lãi kỳ vọng nếu bán đúng giá" và ghi rõ đó **chưa phải tiền**.

## 3. Lãi đã thực hiện và lãi trên giấy

- **Lãi đã thực hiện** của một máy = giá bán − giá vốn − phí ship/COD − bảo hành sau bán. Lãi chỉ được tính khi **tiền đã về đủ**.
- Máy bị hoàn: phí hoàn được cộng vào giá vốn. Ví dụ máy vốn 10tr, hoàn mất 60k, thì vốn mới là 10,06tr. Lần bán sau, lãi sẽ phản ánh đúng chi phí thật.
- Phí COD: nhập **tổng tiền thực nhận** từ hãng vận chuyển. Phần chênh lệch so với tổng thu hộ được chia cho các đơn theo giá trị từng đơn. Anh không cần biết trước phí ship là bao nhiêu.

## 4. Chu kỳ tiền

Một đồng vốn đi qua 2 chặng trước khi quay về thành tiền:

```
Mua máy ──(nằm kho: DIO)──► Bán / gửi ──(chờ tiền: DSO)──► Tiền về
          └──────────────── Chu kỳ tiền (CCC) ────────────────┘
```

- **DIO** là số ngày máy nằm kho, tính trung bình trên các máy bán xong trong 90 ngày qua.
- **DSO** là số ngày chờ tiền về. Bán tại chỗ thì bằng 0, COD thường 3–7 ngày, mối thì tuỳ hạn.
- **CCC = DIO + DSO.** Ví dụ máy nằm 8 ngày, chờ COD 4 ngày, thì chu kỳ là 12 ngày.

Rút ngắn chu kỳ thì **cùng số vốn quay được nhiều vòng hơn.** Thường đây là cách tăng lãi rẻ nhất, rẻ hơn nhiều so với đi tìm thêm vốn.

## 5. Cần bao nhiêu vốn lưu động

> **Vốn lưu động cần ≈ giá vốn hàng bán mỗi ngày × chu kỳ tiền + vốn đệm**

Ví dụ: bán 25 máy/tháng, giá vốn trung bình 10tr.

- Giá vốn bán ra mỗi ngày ≈ 250tr ÷ 30 ≈ **8,3tr/ngày**.
- Chu kỳ 12 ngày: cần 8,3tr × 12 ≈ **100tr** nằm trong máy và đơn đang đi.
- Cộng vốn đệm 15tr: tổng cần khoảng **115tr**.

Nếu chỉ có 100tr thì có hai lựa chọn: bán chậm lại, hoặc **rút chu kỳ xuống 10 ngày**. Với chu kỳ 10 ngày, số vốn cần là 8,3tr × 10 + 15tr ≈ 98tr, vừa đủ.

**Cứ rút ngắn chu kỳ 2 ngày là giải phóng được khoảng 17tr vốn**, mà không phải vay thêm đồng nào.

Hệ thống tính con số này từ dữ liệu thật, nằm ở mục "Nhịp quay vốn". Mục đó cũng cho biết vốn đang **thiếu hay dư** bao nhiêu so với nhịp bán hiện tại.

## 6. Chi phí cơ hội: con số r

**r = lãi mà mỗi đồng vốn tạo ra trong một ngày**, đo từ chính lịch sử bán hàng:

> r = tổng lãi đã thu ÷ tổng (giá vốn × số ngày vốn bị giữ)

Lấy ví dụ hai máy có cùng biên lãi 10%:

| | Vốn | Lãi | Số ngày giữ | Lãi/ngày/đồng vốn |
|---|---|---|---|---|
| Máy A | 10tr | 1tr | 5 ngày | 1tr ÷ (10tr × 5) = **2%/ngày** |
| Máy B | 30tr | 3tr | 30 ngày | 3tr ÷ (30tr × 30) = **0,33%/ngày** |

Hai máy cùng lãi 10%, nhưng máy A **hiệu quả gấp 6 lần**. Lý do là trong 30 ngày giữ máy B, 30tr đó lẽ ra quay được nhiều vòng máy kiểu A.

- Khi chưa đủ 5 máy bán xong, hệ thống dùng `r_mac_dinh` = 0,3%/ngày làm số tạm.
- Hệ thống cũng tính r theo từng nhóm máy (iPhone, Laptop…) để biết nên dồn vốn vào nhóm nào.

### "Đợi lâu bán được giá hơn": khi nào đáng?

Giữ máy thêm 1 ngày tốn hai khoản:

1. **Chi phí cơ hội:** giá vốn × r. Đó là phần lãi số vốn này lẽ ra kiếm được nếu quay vòng.
2. **Mất giá thị trường:** giá máy × `mat_gia_thang_pct` ÷ 30 (mặc định 3%/tháng).

> **Chỉ đáng chờ khi phần giá cao hơn > chi phí giữ mỗi ngày × số ngày chờ thêm**

Ví dụ: máy vốn 30tr, giá sàn (bán ngay được) 32tr, kỳ vọng 34tr, r = 0,5%/ngày.

- Chi phí mỗi ngày giữ = 30tr × 0,5% + 32tr × 3% ÷ 30 = 150k + 32k = **182k/ngày**.

| Chờ thêm | Phải bán cao hơn giá sàn ít nhất |
|---|---|
| 7 ngày | ~1,27tr |
| 14 ngày | ~2,55tr |
| 30 ngày | ~5,46tr |

- Kỳ vọng bán cao hơn giá sàn 2tr thì **chỉ đáng chờ tối đa khoảng 10 ngày** (2tr ÷ 182k).
- Quá 10 ngày mà chưa bán được giá kỳ vọng thì nên bán ở giá sàn. Phần còn lại không còn là "được giá" mà là đang lỗ ngầm.

Trên trang, mỗi máy tồn hiện 3 con số:
- "Giữ đã tốn ~X": chi phí cơ hội đã mất từ ngày mua.
- "Giữ thêm 7 ngày phải bán cao hơn ~Y".
- "Chờ giá còn đáng ~N ngày". Chỉ số này cần có cả **giá kỳ vọng** và **giá sàn**, nên điền đủ cả hai khi mua máy.

## 7. Quy tắc cho vốn mỏng (khoảng 100tr)

| Quy tắc | Mặc định | Vì sao |
|---|---|---|
| Một máy mua mới tối đa | 30% vốn chủ (`tran_1_may_pct`) | Một máy kẹt không làm tê liệt cả cửa hàng |
| "Máy vốn lớn" (từ 20% vốn trở lên) giữ tối đa | 14 ngày (`ngay_giu_toi_da_may_lon`) | Máy lớn có chi phí giữ mỗi ngày lớn nhất |
| Luôn giữ tiền đệm | 15% vốn chủ (`von_dem_pct`) | Đủ cho chi phí phát sinh và để ăn được deal tốt |
| Tiền nằm trong máy tồn tối đa | 75% vốn chủ (`ton_kho_toi_da_pct`) | Vượt mức này là đang mua nhanh hơn bán |
| Quá hạn tồn thì hạ giá theo bậc | 3% mỗi tuần (`buoc_ha_gia_pct`), không thấp hơn giá sàn | Xả dần, không để máy "chết" trong kho |
| Hạn tồn | iPhone 10 ngày, laptop 20 ngày | Laptop thường bán chậm hơn |
| COD trễ | sau 7 ngày (`cod_canh_bao_ngay`) | Đơn "om" là vốn mất dấu |
| Mối nợ | mặc định 3 ngày (`han_no_moi_mac_dinh`) | Nợ mối cũng là vốn đang bị kẹt |

**Hạn mức "Hôm nay mua máy tối đa"** = số nhỏ hơn giữa (tiền − đệm) và (30% × vốn chủ). Đây là câu cần hỏi **trước** mỗi lần chốt mua.

Gợi ý vận hành để rút ngắn chu kỳ:

- **COD:**
  - Đơn giá trị lớn thì **thu cọc hoặc phí ship trước**: giảm tỷ lệ hoàn, đồng thời một phần tiền về ngay.
  - Ưu tiên hãng vận chuyển đối soát nhanh.
  - Đơn quá 7 ngày thì hỏi hãng ngay, không để om.
- **Mối:**
  - Chỉ cho nợ với mối từng trả đúng hạn.
  - Mối đang quá hạn thì **không giao máy tiếp** cho đến khi trả.
- **Tiền cá nhân:**
  - Tách tài khoản kinh doanh khỏi tài khoản cá nhân.
  - Mỗi lần lấy tiền tiêu thì ghi "Rút cá nhân". Tốt hơn nữa là rút một khoản "lương" cố định mỗi tháng.
  - Nếu không ghi, số tiền trên trang sẽ sai, và con số lãi bị nhầm với tiền tiêu.
- **Dồn vốn:** cuối tháng xem bảng nhóm máy, dồn vốn vào nhóm có lãi/ngày/đồng vốn cao nhất.

## 8. Nhịp làm việc

| Khi nào | Việc | Mất khoảng |
|---|---|---|
| Khi tiền hoặc máy đổi chỗ | Nhập đúng 1 thao tác | 20 giây |
| Mỗi tối | Xem app ngân hàng, có tiền đối soát hoặc mối trả thì bấm "Tiền về" | 1 phút |
| Mỗi sáng | Đọc email hoặc mục "Nên làm gì" | 1 phút |
| Chủ nhật | **Đối chiếu số dư:** đếm tiền mặt, xem số dư tài khoản, nhập vào | 3 phút |
| Cuối tháng | Đọc "Tiền tháng này đi đâu" và "Nhịp quay vốn", chỉnh ngưỡng trong Config nếu cần | 15 phút |

**Đối chiếu số dư là thói quen quan trọng nhất.** Mọi con số khác đều dựa trên việc số tiền trong sổ khớp với thực tế. Phần lệch được ghi thành "Điều chỉnh", kèm lý do (tiêu cá nhân / quên nhập / khác). Lệch nhiều và lặp lại là dấu hiệu đang có khoản không được ghi.

## 9. Câu hỏi FP&A nên hỏi mỗi tháng

1. Vốn chủ tăng bao nhiêu? **Trong đó bao nhiêu là tiền thật**, bao nhiêu chỉ là máy và đơn tăng lên?
2. Chu kỳ tiền tháng này ngắn lại hay dài ra? Chặng nào chậm: nằm kho hay chờ tiền?
3. Nhóm máy nào có lãi/ngày/đồng vốn cao nhất? Có nên dồn vốn vào đó?
4. Bao nhiêu % vốn đang nằm ở máy tồn quá 30 ngày?
5. Phí ship, COD, hoàn và bảo hành ăn bao nhiêu % lãi gộp? Kênh nào đắt nhất?
6. Tiền rút cá nhân so với lãi đã thu về: đang rút ít hơn, bằng hay nhiều hơn phần làm ra?
7. Vốn lưu động hiện có so với mức cần cho nhịp bán: đang thiếu hay dư?
8. Lần đối chiếu gần nhất lệch bao nhiêu, vì sao?

## 10. Giới hạn của mô hình

Nên biết để không tin tuyệt đối vào từng con số:

- **r đo từ ít máy thì dao động mạnh.** Ví dụ 5 máy bán rất nhanh có thể đẩy r lên cao. Nên xem r trong ít nhất 1–2 tháng trước khi kết luận.
- **Mất giá 3%/tháng là ước tính chung.** Mức thật khác nhau theo từng dòng máy và theo mùa.
- **Giá sàn và giá kỳ vọng do anh tự điền**, nên các chỉ số "chờ giá còn đáng" chỉ đúng khi hai giá này sát thực tế.
- **Phí COD được chia theo giá trị đơn**, nên lãi từng máy có thể lệch vài nghìn đồng so với bảng đối soát của hãng. Tổng tiền vẫn khớp.
- **Chưa tính thuế** và chưa có công nợ phải trả cho mối bán máy. Nếu sau này có mua chịu thì cần thêm phần đó.
