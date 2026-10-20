# T20 — Hiệu năng, QA và tài liệu

Kiểm tra ngày 20/10/2026 trên Windows, Node v24.12.0, Orca browser,
bản production tại `http://127.0.0.1:4173/` (`npm run preview`).

## Kết quả

- `npm test`: **126 test PASS**: 12 cờ vua, 16 cờ tướng, 15 Caro,
  23 controller/lifecycle, 11 asset, 16 ChessView, 15 XiangqiView, 18 XOView.
- `npm run lint`: **39/39 file PASS**; `npm run build`: **PASS**.
- Chạy thêm asset test với `node --no-experimental-detect-module --test test/assets3d.test.mjs`:
  PASS, không cần Node tự đoán module. Chưa chạy trực tiếp bằng Node 18.
- **72 tổ hợp** = 3 game × 4 theme × 2D/3D × 1440×900, 768×1024, 360×800:
  không tràn ngang; bàn nằm trong viewport. Có screenshot từng tổ hợp và ảnh
  xuất trực tiếp từ canvas WebGL; đã xem ảnh ba bàn/bốn theme, desktop và mobile.
- Sai số giữa `squareToWorld` và tâm ô/giao điểm texture tối đa
  `6.3e-16` cho cờ vua/tướng, `1.9e-15` cho Caro. Xem ảnh xác nhận chân quân
  vua giữa ô, quân tướng ở giao điểm, X/O ở giữa ô.
- Raycast qua phép chiếu camera ở góc nghiêng: đúng **64/64**, **90/90**,
  **225/225** vị trí trên mặt bàn. Pointerdown/up qua canvas đặt được X ở tâm.
- Chuỗi nước đi bằng controller ở **cả bốn theme**: cờ vua e4–d5–exd5–Qxd5–Nc3–Qe5+
  có cung di chuyển, capture ghost, check và camera lật; cờ tướng pháo ăn mã qua
  đúng một ngòi, thế xe chiếu, lật đồng thời với đi quân, chữ xoay π và quân đáp đúng chỗ.
- Caro: đi nhanh hai nước đều đáp xuống, X thắng năm quân, marker/pulse hiện,
  đường thắng vẫn sáng sau khi vòng kết thúc tắt, undo xóa marker và không rơi lại quân cũ.
- Tắt Hiệu ứng: quân đặt ngay, không còn tween; unit test cũng kiểm tra motion disabled.
- **2D trên production**: click DOM, undo, AI Worker của cả ba game PASS;
  sau khi chơi cả ba, `board3d.engine === null` và resource list không chứa
  `three.module`, `engine-*` hoặc `*View-*`. Không tải chunk Three.js.

## Renderer thật khi tab đang hiển thị

Không sửa/bỏ qua `document.hidden`. Sau khi tab Orca được đưa ra foreground,
`document.hidden=false` trong các lượt đo sau. Đo chất lượng Vừa, warm-up từng
game; Caro có một X để GPU upload geometry như lượt chơi thật.

| Game | Geometry / texture ban đầu | Sau mỗi vòng 1–10 | Frame trước/sau idle 1,5 giây |
|---|---|---|---|
| Cờ vua | 9 / 2 | 9 / 2 | 7528 → 7528 |
| Cờ tướng | 4 / 16 | 4 / 16 | 7589 → 7589 |
| Caro | 6 / 2 | 6 / 2 | 7648 → 7648 |

Một vòng = vua → tướng → Caro, tổng **30 lần đổi view**; không tăng geometry/texture
so với baseline của cùng game. Idle đều có `engine.frame === null`.
Đổi Cao → Thấp → Vừa → Cao → Thấp trên Caro: texture **3 → 2 → 2 → 3 → 2**,
geometry luôn 6; chỉ Cao bật shadow. DPR môi trường khoảng 1 nên không đo được
khác biệt thực tế giữa trần DPR 1/1,5/2 trên màn hình mật độ cao.

## Lỗi đã sửa và file liên quan

1. `package.json`: thêm asset test bị thiếu vào `npm test`.
2. `src/package.json`: khai báo ESM cho `src/`; asset test trước đó chỉ chạy
   nhờ Node mới tự phát hiện module, thất bại khi tắt tính năng này.
3. `xoView.js`: drop có token riêng từng ô; snapshot AI không cắt ngang drop;
   undo/reset hủy callback cũ và không phát lại drop của nước trước.
4. `xoView.js`: tách vật liệu vòng kết thúc khỏi đường thắng, hủy pulse cũ khi undo.
5. `xoView.js`: cập nhật bounding sphere khi instance thay đổi để raycast không
   bỏ sót quân mới; gọi `InstancedMesh.dispose()` để giải phóng instance buffer.
6. `xiangqiView.js`: token xoay chữ riêng, lật bàn không hủy tween đi quân đang chạy.
7. `pieces-xiangqi.js`: đổi theme cập nhật cả quân đang tồn tại, cache theo mã quân,
   dispose texture bị thay thay vì giữ texture của mọi theme.
8. `boards.js`, `canvas-util.js`: đánh dấu CanvasTexture màu là sRGB, sửa màu/lưới/chữ bị nhạt.
9. `pieces-xiangqi.js`: nền mặt quân Đen tối ở Harry Potter/Greek để chữ vàng có tương phản.
10. README bỏ hướng dẫn Electron/live-server cũ; bổ sung Vite dev/build/preview,
    deploy toàn bộ `dist/`, lazy 3D, chất lượng, nhập liệu và giới hạn kiểm thử.

Các lỗi logic/lifecycle có test hồi quy trong ba file `test/*3d.test.mjs` liên quan.
Không thêm dependency, không đổi luật chơi, không push.

## Bằng chứng và giới hạn

Ảnh, JSON đo từng tổ hợp, behavior từng theme, `memory.json`, `2d.json`, `pick.json`
ở `C:/Users/Admin/AppData/Local/Temp/chess-t20-qa/`; script tái chạy ở thư mục Temp:
`t20-qa.ps1`, `t20-behavior.js/.ps1`, `t20-memory.js`, `t20-2d.js`, `t20-pick.js`.
Các JSON từng tổ hợp `*-2d-*.json`/`*-3d-*.json` là nguồn đủ 72 tổ hợp;
file `matrix-*` có thể chỉ chứa tập con của lượt chụp lại sau sửa lỗi.

Screenshot toàn trang desktop của Orca có lỗi compositor lặp dải khoảng 608px;
một số ảnh sau resize còn giữ hình cũ/scale sai. Vì vậy xác nhận hình 3D bằng
canvas PNG xuất ngay sau `renderer.render`, kết hợp đo layout DOM; chưa coi ảnh
toàn trang desktop là bằng chứng hoàn chỉnh về mọi pixel của HUD/font 2D.
Không thay điều kiện visibility của engine để né lỗi công cụ.

Chưa thử PeerJS giữa hai máy, đa chạm trên thiết bị vật lý, Safari/Firefox,
GPU/màn hình DPR cao hoặc đo CPU/GPU toàn tiến trình bằng Performance profiler.
Số liệu geometry/texture không chứng minh không rò mọi loại bộ nhớ JS/driver.
Build còn cảnh báo Three chunk khoảng 512kB (132kB gzip), chỉ tải khi bật 3D;
cảnh báo classic script không bundle là chủ ý vì `public/js/` được copy nguyên trạng.
