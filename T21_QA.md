# T21 — Sửa khả năng đọc và khung bàn 3D

Ngày kiểm tra: 20/10/2026, worktree `ui-polish`, base `c07e4de`.

## Thay đổi

- Caro: năm quân thắng có bản vẽ MeshBasicMaterial màu highlight riêng, nâng 0,09 đơn vị và phóng 16%, cùng vạch nối sáng. Pulse hữu hạn giữ nguyên; khi pulse kết thúc, tắt hiệu ứng hoặc reduced motion, dấu thắng vẫn tồn tại. Undo/reset xóa dấu thắng. Không đổi màu các quân ngoài đường thắng; geometry dùng chung và material riêng được dispose.
- Cờ tướng: font mặt quân tăng từ 52% lên 60% texture; Đen Ma Cà Rồng dùng 64%, chữ gần trắng và viền hồng sáng. Emissive map cường độ 0,3 giữ chữ đọc được dưới ánh sáng theme, dùng lại symbol texture hiện có.
- Canvas: kích thước độc lập DOM board ẩn, dùng chiều rộng còn lại sau hai panel và khoảng cách, chiều cao theo viewport/header. Camera fit mọi góc bounds với khoảng đệm 8%, kể cả độ cao quân vua; resize cập nhật preset và giữ hướng lật, resize cùng kích thước giữ zoom. Bật 3D/đổi theme đồng bộ buffer ngay và vẫn có ResizeObserver/window resize.

## Kiểm tra

- `npm install` hoàn tất, không đổi dependency; npm báo hai advisory hiện có.
- `npm test`: **130 PASS**, gồm bốn test hồi quy mới cho thắng X/O có/không motion, font/theme texture, camera projection và resize engine (kể cả mid-flight/mid-flip).
- `npm run lint`: **40/40 PASS**; `git diff --check`: PASS.
- `npm run build`: PASS. Cảnh báo classic scripts và Three lazy chunk 514,04 kB còn như kiến trúc hiện tại.
- Vite production preview `http://127.0.0.1:4181/`: đã xuất và XEM đủ **24 PNG canvas**, ba game × bốn theme × hai viewport; tất cả `document.hidden=false`, không tràn ngang.

| Viewport | Khung canvas CSS | Drawing buffer DPR 1 | Kết quả |
|---|---|---|---|
| 1255×706 | 774×462 | 774×462 | Ba game/bốn theme nằm trọn khung |
| 360×800 | 324,8×388 | 324×388 | Ba game/bốn theme nằm trọn khung |

- So với khung lỗi báo ban đầu 506×488, diện tích canvas desktop tăng khoảng **45%**. Panel và thanh chế độ vẫn nằm ngoài canvas.
- Đã xem thêm cờ tướng Ma Cà Rồng lật 180°: chữ hướng người chơi, quân Đen sáng/rõ. Test resize giữ hướng lật sau khi thay tỉ lệ khung.
- Giả lập `prefers-reduced-motion: reduce`, bật hiệu ứng: engine báo `motion=false`, `tweens=false`, đủ **5** quân thắng, opacity **1**.
- Chuyển về 2D giải phóng engine, bàn DOM hiện lại và không tràn ngang.

## Ảnh và giới hạn môi trường

Thư mục `C:/Users/Admin/AppData/Local/Temp/chess-t21-qa/` chứa `desktop-<game>-<theme>.png/.json`, `mobile-<game>-<theme>.png/.json`, hai contact sheet, ảnh lật, script QA và log test/lint/build. Ảnh xuất qua `window.board3d.engine`: đồng bộ motion/resize, gọi `renderer.render(scene,camera)`, rồi `renderer.domElement.toDataURL('image/png')`.

Screenshot toàn cửa sổ Orca vẫn lặp dải compositor. Khi đổi viewport giả lập, có lúc CSS media giữ layout cũ cho tới reload; bộ ảnh cuối dùng reload tại mỗi kích thước và đối chiếu DOM/buffer. Resize thực tế được bảo vệ thêm bằng test projection/engine; chưa xác nhận trên thiết bị cảm ứng/GPU thật.

Không thêm dependency, không push, không merge.
