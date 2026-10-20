# TODO_WORKER — Hoàn thiện web chơi Cờ vua / Cờ tướng / Cờ Caro

> Tài liệu giao việc cho Worker Agent. Orchestrator (Tech Lead) chỉ lập kế hoạch, KHÔNG code.
> Worker làm tuần tự từ trên xuống, **mỗi task = 1 commit riêng** (`git commit -m "T<id>: <tên>"`).

## Quy tắc chung (áp dụng cho MỌI task)

- Stack: Vanilla JS (không bundler, không framework), script nạp bằng `<script>` trong `index.html`,
  chạy được cả trình duyệt (`npm start`) và Electron (`npm run electron`, protocol `app://` trong `main.js`).
- KHÔNG thêm dependency npm mới. KHÔNG thêm CDN mới (CSP trong `index.html` sẽ chặn).
- File mới trong `js/` phải được thêm `<script>` vào `index.html` đúng thứ tự phụ thuộc
  và phải nằm trong danh sách mà `test/lint.js` kiểm tra (lint tự quét `js/` — xác nhận lại).
- Module logic thuần (rules/AI) phải **không đụng DOM** và export cho Node theo mẫu:
  `if (typeof module !== 'undefined' && module.exports) module.exports = {...};`
  để test bằng `node` (xem cách `test/chess.test.js` nạp `pieces.js`/`moves.js`/`ai.js`).
- Giữ nguyên ngôn ngữ UI tiếng Việt, giữ style code hiện có (class ES6, 4 spaces, `'` quote).
- Không phá vỡ cờ vua online (PeerJS) và lịch sử PGN đang hoạt động.
- Sau mỗi task chạy: `npm test` và `npm run lint` — cả hai phải PASS trước khi commit.
- Nếu một task bị chặn, ghi chú lý do vào mục "Nhật ký worker" cuối file, rồi chuyển task tiếp.

## Bối cảnh codebase (đã phân tích)

| File | Vai trò | Vấn đề phát hiện |
|---|---|---|
| `js/manager.js` | chuyển loại cờ | thay `#chessboard` bằng clone nhưng các nút `play-ai-btn`, `undo-btn`, `new-game-btn` vẫn bị `game.js` bind trực tiếp → bấm "Chơi với AI" khi đang ở cờ tướng/caro vẫn kích hoạt AI cờ vua; không hủy AI worker / replay timer của cờ vua khi đổi game; panel online & lịch sử vẫn hiện cho game không hỗ trợ |
| `js/game.js` | controller cờ vua | `document.querySelectorAll('.square')` toàn cục (trúng cả ô cờ tướng/caro); render lại toàn bộ 64 ô mỗi nước; listener gắn từng ô |
| `js/xiangqi.js` | cờ tướng (UI + luật trộn lẫn) | không có AI, không test được, luật nằm chung với DOM, chưa có gợi ý nước đi / highlight nước cuối / highlight bị chiếu |
| `js/xo.js` | caro 15x15 | không có AI, 225 listener riêng lẻ, không highlight đường thắng / nước cuối |
| `js/theme.js` | theme + hiệu ứng | `setInterval` dơi chạy cả khi tab ẩn, tạo/xóa DOM particle liên tục → tốn CPU; không tôn trọng `prefers-reduced-motion` |
| `styles.css` | 3045 dòng, 78 animation | nhiều animation vô hạn; responsive mới có breakpoint 1000/850px |

Lệnh kiểm tra cơ bản: `npm test` (12 test engine cờ vua) và `npm run lint` (16 file) đều đang PASS.

---

## T1 — Sửa điều phối đổi loại cờ (GameManager là nguồn sự thật duy nhất)

- **Mục tiêu**: Mọi nút điều khiển chung (Ván mới, Đi lại, Chơi với AI, Lịch sử, độ khó) đi qua
  `GameManager` và gọi vào game hiện tại; cờ vua chỉ xử lý khi đang active.
- **Đọc**: `js/manager.js`, `js/game.js` (constructor, `bindEvents`, `toggleAI`, `makeAIMove`, replay), `index.html`.
- **Sửa**: `js/manager.js`, `js/game.js`, `index.html` (nếu cần thêm id/attr).
- **Yêu cầu**:
  - Định nghĩa interface chung mỗi game cần có: `init()`, `newGame()`, `undoMove()`, `setAI(enabled, difficulty)`,
    `destroy()` (hủy timer, AI đang chạy, listener toàn cục). Manager gọi `destroy()` game cũ trước khi đổi.
  - `game.js` bỏ bind trực tiếp các nút chung (hoặc kiểm tra `gameManager.gameType === 'chess'`), tránh bind trùng
    gây gọi 2 lần (`new-game-btn` hiện bị cả manager và có thể game.js bind — xác minh).
  - Ẩn/disable panel Online và nút Lịch sử khi game không phải cờ vua (online/lịch sử chỉ hỗ trợ cờ vua);
    không cho đổi loại cờ khi đang trong phòng online (selector disabled + thông báo).
  - Lưu loại cờ đã chọn vào `localStorage` (try/catch) và khôi phục khi tải trang.
- **Edge cases**: đổi game khi AI cờ vua đang suy nghĩ (kết quả trả về muộn không được áp lên bàn mới — dùng
  token/generation id); đổi game khi đang replay lịch sử; modal game-over đang mở; đổi qua lại nhiều lần không rò listener.
- **Kiểm tra**: `npm test && npm run lint`; thủ công `npm start` → đổi chess→xiangqi→xo→chess 5 lần, bấm AI/undo/new ở từng game.

## T2 — Tách luật cờ tướng thành module thuần + unit test

- **Mục tiêu**: Có `js/xiangqi-rules.js` thuần (không DOM): sinh nước đi hợp lệ, kiểm tra chiếu, chiếu bí, hết nước,
  lộ mặt tướng; dùng được trong Node, UI và Web Worker.
- **Đọc**: `js/xiangqi.js` (toàn bộ phần luật), `test/chess.test.js` (mẫu test).
- **Sửa/Tạo**: `js/xiangqi-rules.js` (mới), `test/xiangqi.test.js` (mới), `package.json` (script `test` chạy cả 2 file test,
  ví dụ `node test/chess.test.js && node test/xiangqi.test.js`).
- **Yêu cầu luật**: Tướng/Sĩ trong cung; Tượng không qua sông + chặn mắt tượng; Mã bị cản chân; Xe; Pháo cần đúng 1 ngòi khi ăn;
  Tốt chỉ đi ngang sau khi qua sông, không đi lùi; cấm lộ mặt tướng; nước đi không được để tướng mình bị chiếu.
  API đề xuất: `createInitialBoard()`, `generateLegalMoves(board, color)`, `isInCheck(board, color)`,
  `isCheckmate(board,color)`, `isStalemate(board,color)` (trong cờ tướng hết nước = THUA), `applyMove(board, move)` trả board mới.
- **Test tối thiểu (≥10)**: số nước hợp lệ ban đầu của Đỏ = 44; mã bị cản chân; tượng bị chặn mắt; tượng không qua sông;
  pháo ăn qua 1 ngòi, không ăn khi 0/2 ngòi; tốt trước/sau qua sông; lộ mặt tướng bị cấm; một thế chiếu bí đơn giản; hết nước = thua.
- **Edge cases**: board dùng key dạng `'R_K'`, `'B_P'` như hiện tại để tương thích UI; không mutate board đầu vào.
- **Kiểm tra**: `npm test && npm run lint`.

## T3 — Cờ tướng UI dùng rules module + UX đầy đủ

- **Mục tiêu**: `js/xiangqi.js` chỉ còn phần UI, gọi `xiangqi-rules.js`; thêm trải nghiệm tương đương cờ vua.
- **Đọc**: `js/xiangqi.js`, `js/xiangqi-rules.js`, phần `.xiangqi-board` trong `styles.css`.
- **Sửa**: `js/xiangqi.js`, `index.html` (thêm `<script src="js/xiangqi-rules.js">` trước `xiangqi.js`), `styles.css` (chỉ khối xiangqi).
- **Yêu cầu**: chấm gợi ý nước đi hợp lệ khi chọn quân (vòng tròn cho ô ăn quân); highlight nước đi cuối (from/to);
  highlight tướng đang bị chiếu; hiển thị "Chiếu tướng!" trên status; vẽ sông "楚河 漢界" và cung bằng CSS/SVG nhẹ;
  danh sách quân bị ăn; undo hoạt động đúng cả khi chơi với AI (lùi 2 nước); event delegation 1 listener trên board;
  hỗ trợ lật bàn (nếu người chơi cầm Đen khi đấu AI).
- **Edge cases**: click lại quân đang chọn để bỏ chọn; click quân khác cùng màu để đổi chọn; không cho tương tác khi game over
  hoặc khi AI đang nghĩ.
- **Kiểm tra**: `npm test && npm run lint`; thủ công chơi một ván ngắn tới chiếu bí.

## T4 — AI cờ tướng (Web Worker, không chặn UI)

- **Mục tiêu**: Chơi với máy cho cờ tướng, 3 mức độ khó dùng chung `#ai-difficulty`.
- **Đọc**: `js/ai.js`, `js/ai-worker.js`, `js/xiangqi-rules.js`, `js/xiangqi.js`.
- **Sửa/Tạo**: `js/xiangqi-ai.js` (mới, thuần), `js/ai-worker.js` (route theo `msg.game`), `js/xiangqi.js` (gọi worker).
- **Yêu cầu**: negamax + alpha-beta + iterative deepening có **giới hạn thời gian** (vd. dễ 200ms, vừa 800ms, khó 2000ms);
  move ordering (ăn quân MVV-LVA trước); bảng giá trị quân + bảng vị trí đơn giản; trả nước tốt nhất kịp khi hết giờ.
  Worker dùng `importScripts` các file thuần; fallback chạy trên main thread bằng `setTimeout` chia nhỏ nếu Worker lỗi.
  Thêm vài test cho `xiangqi-ai.js` vào `test/xiangqi.test.js` (trả nước hợp lệ; tìm được chiếu bí 1 nước).
- **Edge cases**: request id để bỏ kết quả cũ (sau undo / ván mới / đổi game); `worker.terminate()` trong `destroy()`;
  không để AI nghĩ khi game over.
- **Kiểm tra**: `npm test && npm run lint`.

## T5 — Cờ Caro: tách luật + AI

- **Mục tiêu**: Caro có luật thuần + AI đánh tốt mức người chơi phổ thông.
- **Đọc**: `js/xo.js`, `js/ai-worker.js`.
- **Sửa/Tạo**: `js/xo-rules.js` (mới: `checkWin(board,r,c)` trả mảng 5 ô thắng hoặc null, chỉ quét 4 hướng quanh nước vừa đi;
  `isFull`), `js/xo-ai.js` (mới), `test/xo.test.js` (mới; nhớ thêm vào script `npm test`).
- **Yêu cầu AI**: chỉ xét ô trống trong bán kính 2 quanh quân đã có (nước đầu: ô trung tâm); chấm điểm theo pattern
  (năm, bốn mở, bốn chặn, ba mở, …) cho cả tấn công & phòng thủ; mức khó cao thêm tìm kiếm alpha-beta độ sâu 2–4
  trên top-N ứng viên; luôn thắng ngay nếu có, luôn chặn bốn của đối thủ.
- **Test**: thắng ngang/dọc/chéo 2 hướng; 4 quân chưa thắng; AI hoàn thành 5 khi có 4 mở; AI chặn khi đối thủ có 4.
- **Edge cases**: bàn đầy → hòa; biên bàn cờ; không trả ô đã có quân.
- **Kiểm tra**: `npm test && npm run lint`.

## T6 — Cờ Caro UI + chơi với AI

- **Mục tiêu**: UI caro hoàn chỉnh, nhẹ.
- **Đọc**: `js/xo.js`, `js/xo-rules.js`, `js/xo-ai.js`, khối `.xo-board` trong `styles.css`.
- **Sửa**: `js/xo.js`, `styles.css` (khối xo), `index.html` (script tags `xo-rules.js`, `xo-ai.js` trước `xo.js`).
- **Yêu cầu**: 1 listener (event delegation) thay cho 225 listener; highlight nước đi cuối; tô sáng 5 ô thắng;
  hover preview quân của lượt hiện tại; chơi với AI (người X đi trước, AI là O) qua worker hoặc trực tiếp nếu < 50ms;
  undo lùi 2 nước khi chơi với AI; bàn cờ co giãn theo màn hình (CSS grid + `aspect-ratio`), ô tối thiểu 22px trên mobile.
- **Kiểm tra**: `npm test && npm run lint`; thủ công: thắng, thua, hòa, undo, ván mới.

## T7 — Hiệu năng render cờ vua

- **Mục tiêu**: Giảm công việc DOM mỗi nước đi.
- **Đọc/Sửa**: `js/game.js` (chỉ file này; có thể đụng `js/online.js` nếu nó gọi hàm render đổi tên).
- **Yêu cầu**: scope mọi `querySelectorAll('.square')` vào `this.boardEl`; cache mảng 64 phần tử ô; event delegation
  1 listener trên board (`closest('.square')`); `renderBoard` chỉ cập nhật ô thay đổi (diff với trạng thái trước) hoặc
  ít nhất không tạo lại node; gom cập nhật class trong 1 frame (`requestAnimationFrame`) nếu cần; replay dùng 1 timer, hủy khi `destroy()`.
- **Edge cases**: lật bàn (online quân Đen) vẫn đúng; promotion modal; en passant/castling hiển thị đúng; drag (nếu có).
- **Kiểm tra**: `npm test && npm run lint`; thủ công chơi ván cờ vua 2 người + với AI + replay lịch sử.

## T8 — Hiệu năng hiệu ứng theme (CPU/GPU)

- **Mục tiêu**: Hiệu ứng theme không ngốn CPU khi rảnh.
- **Đọc/Sửa**: `js/theme.js`, `styles.css` (chỉ các khối animation/effect), `index.html` (nút bật/tắt hiệu ứng).
- **Yêu cầu**: dừng `batsInterval` & mọi timer khi `document.hidden` (visibilitychange) và khi đổi theme; giới hạn số particle
  đồng thời (pool/tái sử dụng node, tối đa ~20); tôn trọng `@media (prefers-reduced-motion: reduce)` (tắt animation vô hạn);
  thêm toggle "✨ Hiệu ứng" (lưu localStorage); animation chỉ dùng `transform`/`opacity`; bỏ `box-shadow`/`filter` animate liên tục;
  animation vô hạn chuyển sang `animation-play-state: paused` khi tắt hiệu ứng.
- **Kiểm tra**: `npm run lint`; thủ công: DevTools Performance — tab ẩn thì không còn timer chạy; CPU idle gần 0%.

## T9 — UI/UX tổng thể & responsive

- **Mục tiêu**: Giao diện thống nhất cho 3 loại cờ, dùng tốt trên mobile (360px) đến desktop.
- **Đọc/Sửa**: `index.html`, `styles.css` (phần layout chung, không đụng khối theme effect đã sửa ở T8).
- **Yêu cầu**: tiêu đề/turn-indicator đổi theo game (Trắng/Đen, Đỏ/Đen, X/O); bàn cờ dùng `min(90vw, 80vh)` không tràn ngang;
  sidebar điều khiển xếp dưới bàn cờ khi < 850px; nút đủ lớn (≥40px) cho cảm ứng; `aria-label` cho nút icon, `:focus-visible` rõ;
  modal đóng bằng Esc và click nền; trạng thái disabled rõ ràng; meta viewport đúng.
- **Edge cases**: 4 theme đều phải đọc được (độ tương phản chữ), không có horizontal scroll ở 360px.
- **Kiểm tra**: `npm run lint`; thủ công DevTools device mode 360px / 768px / 1440px với cả 4 theme.

## T10 — Kiểm thử hồi quy & tài liệu

- **Mục tiêu**: Chốt chất lượng.
- **Đọc/Sửa**: `README.md`, `test/lint.js` (đảm bảo quét file mới), `package.json` (script `test` chạy đủ test).
- **Yêu cầu**: README cập nhật tính năng mới (AI cờ tướng/caro, hiệu ứng tắt được, phím tắt nếu có); chạy toàn bộ test;
  liệt kê trong "Nhật ký worker" những gì chưa làm được hoặc cần người review.
- **Kiểm tra**: `npm test && npm run lint` (phải PASS toàn bộ); `git log --oneline` có đủ commit T1..T10.

---

## Nhật ký worker

<!-- Worker ghi lại tiến độ / blocker tại đây, mỗi task 1 dòng: T<id> — DONE/BLOCKED — ghi chú -->

- T1 — DONE — Manager điều phối nút chung; hủy AI/replay, khóa phòng online, lưu loại cờ. Test/lint PASS; kiểm tra UI tổng hợp ở T10.
- T2 — DONE — Module luật thuần, không mutate board; 13 test cờ tướng PASS cùng 12 test cờ vua; lint tự quét file mới PASS.
