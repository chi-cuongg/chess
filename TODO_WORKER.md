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


## T11 — Sửa lỗi review trực quan sau tích hợp

- **Mục tiêu**: Cả ba bàn cờ vừa chiều cao viewport 1255×706, kể cả nhãn a–h của cờ vua; font tiếng Việt hiển thị đúng, Chat chỉ hiện cho cờ vua, banner dùng tên chung, Caro theo màu theme.
- **Yêu cầu**: Tính kích thước theo `min(90vw, 100dvh - chiều cao header - lề/nhãn)`; cờ tướng giữ tỉ lệ 9×10, Caro 15×15. Thay font thiếu glyph tiếng Việt trong Harry Potter/Greek/Vampire; giữ Cyber đọc đúng. Không thêm dependency/CDN mới.
- **Kiểm tra**: Orca screenshot đủ 4 theme × 3 game tại 1255×706; kiểm tra thêm mobile và resize. `npm test` và `npm run lint` phải PASS trước commit `T11: ...`; ghi kết quả/blocker vào nhật ký. Không push.

---

## Nhật ký worker

<!-- Worker ghi lại tiến độ / blocker tại đây, mỗi task 1 dòng: T<id> — DONE/BLOCKED — ghi chú -->

- T1 — DONE — Manager điều phối nút chung; hủy AI/replay, khóa phòng online, lưu loại cờ. Test/lint PASS; kiểm tra UI tổng hợp ở T10.
- T2 — DONE — Module luật thuần, không mutate board; 13 test cờ tướng PASS cùng 12 test cờ vua; lint tự quét file mới PASS.
- T3 — DONE — UI dùng rules, delegation, gợi ý/chiếu/nước cuối/quân bị ăn, undo theo lượt AI và chọn Đen/lật bàn. Test/lint PASS; UI sẽ kiểm tra tổng hợp T10.
- T4 — DONE — AI negamax/alpha-beta, iterative deepening, MVV-LVA và vị trí; Worker có request id, fallback chia lát 8ms, hủy khi undo/new/destroy. 16 test cờ tướng và lint PASS.
- T5 — DONE — Luật Caro thuần và AI pattern tấn công/phòng thủ, radius 2, thắng/chặn ngay, alpha-beta sâu 2–4 có hạn thời gian. 15 test Caro PASS; toàn bộ test/lint PASS.
- T6 — DONE — Caro delegation, highlight nước cuối/5 ô thắng, hover preview, Worker và fallback chia lát, undo cặp nước hoặc một nước đang chờ AI, grid co giãn ô ≥22px. Test/lint PASS.
- T7 — DONE — Tối ưu render cờ vua: scope query selector vào boardEl, cache 64 ô cờ, event delegation trên board, diff piece & classes không tạo lại node, replay hủy khi destroy. Test/lint PASS.
- T8 — DONE — Hiệu năng hiệu ứng theme: dừng timer/bats khi tab ẩn và đổi theme, giới hạn particle pool max 20, nút toggle hiệu ứng (lưu localStorage), tối ưu animation dùng opacity/transform, pause animation khi tắt hiệu ứng và tôn trọng prefers-reduced-motion. Test/lint PASS.
- T9 — DONE (code) — Tiêu đề/nhãn theo game; layout mobile, ô Caro ≥22px, nút ≥40px, focus/disabled, aria, modal Esc/click nền/focus trap; sửa undo sau khi AI thắng Caro. 43 test và lint 22 file PASS; QA HTML/CSS và modal/undo bằng Node PASS. Chưa kiểm tra trực quan 360/768/1440px × 4 theme vì không có browser (Browser is not available: iab). CSS T9 chỉ thêm khối layout; không đổi theme.js, animation/effect hoặc nút hiệu ứng.
- T10 — DONE — Sau merge 9d8c259: sửa undo cờ vua (1 nước khi AI đang chờ, 2 sau trả lời; hủy Worker cũ và lên lịch lại nếu lượt khôi phục thuộc AI). Thêm 13 test hồi quy controller/lifecycle; tổng 56 test PASS, lint tự quét đủ 23 file PASS. Manager dọn timer/particle theme cũ khi đổi game, chỉ khởi động lại hiệu ứng nền theo tùy chọn; replay/AI/listener được destroy. Toggle hiệu ứng có aria-pressed, không trùng layout T9; README cập nhật AI ba game, luật, hiệu ứng, phím Tab/Esc, giới hạn kiểm thử. Orca browser PASS 36 tổ hợp layout (360/768/1440px × 3 game × 4 theme) và 28 kiểm tra hành vi (đổi game 5 vòng, Worker/fallback, undo, replay, theme/modal). Không thêm dependency/CDN, không push/PR. Cần người review: Electron app://, PeerJS thật giữa hai máy, đo CPU idle bằng DevTools Performance và kiểm tra trực quan toàn bộ theme (đo layout bằng DOM không thay thế review hình ảnh).
- T11 — DONE — Đã thêm mục giao việc trước khi sửa. Kích thước ba bàn theo 100dvh trừ header đo bằng ResizeObserver và 120px khung/lề/nhãn; cờ tướng giữ 9×10, nhãn a–h vừa màn hình. Thay Cinzel/IM Fell/Philosopher bằng Playfair Display + Times New Roman (font Google đã có, subset vietnamese), giữ Cyber; ẩn Chat ngoài cờ vua; banner chung cho ba game; Caro dùng biến màu từng theme cho nền/lưới/X/O/nước cuối/ô thắng. Orca screenshot đủ 12 ảnh 1255×706, đã xem ảnh: mép dưới cụm bàn/nhãn tối đa 686px, font tiếng Việt đúng; thêm 12 kiểm tra resize tại 360×800, 768×1024, 1255×550, 1440×900 đều PASS. Ảnh và metrics tại C:/Users/Admin/AppData/Local/Temp/chess-t11-qa/. 59 test PASS, lint 23/23 PASS; không thêm dependency/CDN, không push.
- T15 — DONE — Thư viện asset 3D thủ tục (6 loại cờ vua Lathe/Extrude <= 1.3k tris, 14 quân cờ tướng đĩa beveled 144 tris chữ Hán rõ, Caro X/O InstancedMesh; 3 bàn cờ gỗ procedural viền vát + sông 楚河漢界 khứ hồi tọa độ 379/379 ô); 4 preset theme; 8 test node --test test/assets3d.test.mjs và npm test, lint PASS; đã xem ảnh Orca screenshot 4 theme đẹp và nhận diện rõ.


---

# GIAI ĐOẠN 2 — Web-only + 3D Graphics & Animation

> Quyết định của Orchestrator (Tech Lead). Worker KHÔNG tự đổi các quyết định này; nếu thấy không khả thi,
> ghi vào "Nhật ký worker" và hỏi lại qua kênh orchestration.

## Quyết định công nghệ

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Nền tảng | **Chỉ web**. Xóa Electron (`main.js`, `run.bat`, dep `electron`, script `electron`) | Yêu cầu người dùng |
| Build/dev | **Vite 5.4.x** (`npm run dev`, `npm run build` → `dist/`, `npm run preview`) | Dev server nhanh, bundle ES module cho three.js, build tĩnh deploy được |
| 3D | **three@0.170.0** (npm, ghim chính xác) + `three/examples/jsm/controls/OrbitControls.js` | Ổn định, không cần CDN, CSP giữ `script-src 'self'` |
| Model 3D | **Sinh thủ tục bằng code** (không tải file .glb): quân cờ vua = `LatheGeometry` theo profile + Mã = `ExtrudeGeometry` từ Shape; quân cờ tướng = đĩa `CylinderGeometry` vát cạnh + `CanvasTexture` chữ Hán; Caro: X = 2 khối hộp bo chéo, O = `TorusGeometry` | Không phụ thuộc asset ngoài/giấy phép, nhẹ (KB thay vì MB), dễ đổi màu theo theme |
| Vật liệu/ánh sáng | `MeshStandardMaterial` + `RoomEnvironment` (PMREM) + 1 directional light có shadow (shadow map 1024, chỉ bật ở chất lượng cao) | Đẹp mà vẫn nhẹ |
| Animation | Tween tự viết (`src/3d/tween.js`, easing cubic), không thêm thư viện | Ít dependency |
| Hiệu năng | **Render on-demand** (chỉ render khi có animation/điều khiển camera/đổi state), `setPixelRatio(min(devicePixelRatio, 2))`, dùng chung geometry/material, `InstancedMesh` cho quân Caro, dispose đầy đủ khi đổi game, dừng khi `document.hidden`, 3 mức chất lượng (thấp/vừa/cao) | CPU/GPU idle ≈ 0 |
| Fallback | Không có WebGL hoặc người dùng chọn "2D" → dùng bàn cờ DOM hiện có (giữ nguyên, không xóa) | Truy cập & máy yếu |
| Cấu trúc code | ES module mới trong `src/` (`src/main.js` là entry, `src/3d/...`). Code luật/controller cổ điển giữ dạng script toàn cục, chuyển sang `public/js/` để Vite copy nguyên trạng | Không viết lại engine luật đã có test |

## Hợp đồng chung (mọi task 3D phải tuân thủ — KHÔNG đổi chữ ký nếu chưa được Orchestrator duyệt)

**1. State snapshot** — mỗi controller (`ChessGame`, `XiangqiGame`, `XOGame`) phát sự kiện sau MỖI thay đổi trạng thái
(chọn quân, đi quân, undo, ván mới, AI đi, game over, lật bàn):

```js
window.dispatchEvent(new CustomEvent('game:state', { detail: {
  game: 'chess' | 'xiangqi' | 'xo',
  rows, cols,                       // 8x8 | 10x9 | 15x15
  board,                            // [row][col]: chess 'K','q',... (hoa = trắng); xiangqi 'R_K','B_P',...; xo 'X'|'O'; trống = null
  turn,                             // 'white'|'black' | 'red'|'black' | 'X'|'O'
  selected: {row, col} | null,
  hints: [{row, col, capture: bool}],
  lastMove: {from:{row,col}, to:{row,col}} | null,   // xo: from === to
  captured: {row, col, piece} | null,                 // quân vừa bị ăn ở nước cuối (để animate)
  check: {row, col} | null,                           // vua/tướng đang bị chiếu
  winLine: [{row, col}] | null,                       // caro
  gameOver: bool, flipped: bool, aiThinking: bool,
  moveId                                              // số tăng dần, đổi khi có nước đi mới/undo/ván mới
}}));
```
API nhập liệu chung: `controller.selectSquare(row, col)` (tương đương click ô 2D) và `controller.getState()` trả snapshot hiện tại.

**2. Engine 3D** — `src/3d/engine.js`:
```js
export class Engine3D {
  constructor(container, { quality })   // renderer, camera, OrbitControls (giới hạn góc, không xuyên bàn), ánh sáng, môi trường
  setView(view)                         // dispose view cũ, gọi view.init(this), bay camera mượt tới view.cameraPreset
  setTheme(themeId)                     // 'harry-potter'|'greek'|'cyber'|'vampire' → view.setTheme(preset)
  setQuality(level)                     // 'low'|'medium'|'high'
  requestRender()                       // render on-demand
  animate(durationMs, onUpdate, easing) // -> Promise; onUpdate(t in 0..1); tự requestRender mỗi frame
  pick(clientX, clientY, objects)       // -> Intersection | null
  dispose()
  // public: scene, camera, renderer, controls
}
```
**3. Board view** — mỗi game một module `src/3d/views/<game>View.js` export class có:
`init(engine)`, `update(state, prevState)` (diff & animate, không dựng lại toàn bộ), `pickSquare(intersection) -> {row,col}|null`,
`setTheme(preset)`, `dispose()`, thuộc tính `cameraPreset = {position:[x,y,z], target:[x,y,z]}` và `root` (THREE.Group).

**4. Assets** — `src/3d/assets/`:
- `pieces-chess.js`: `createChessPiece(code) -> Object3D` (cache geometry)
- `pieces-xiangqi.js`: `createXiangqiPiece(code) -> Object3D`
- `pieces-xo.js`: `createXOMeshes(maxCount) -> { x: InstancedMesh, o: InstancedMesh }`
- `boards.js`: `createChessBoard()`, `createXiangqiBoard()`, `createXOBoard(size)`; mỗi hàm trả `{ group, squareToWorld(row,col) -> Vector3, worldToSquare(point) -> {row,col}|null }`
- `themes.js`: 4 preset (màu nền/sương mù, màu + roughness/metalness quân 2 phe, màu bàn, cường độ đèn, màu highlight)
- Material dùng chung theo theme, mỗi module có `dispose()`.

**5. Animation tối thiểu**: quân di chuyển theo cung parabol (300–450ms); quân bị ăn bay lên + mờ dần/rơi khỏi bàn;
chọn quân → nâng lên + phát sáng; chấm gợi ý nước đi (vòng phát sáng, vòng đỏ cho ô ăn quân); highlight nước cuối;
vua/tướng bị chiếu đập nhịp đỏ; Caro: quân "rơi" xuống + đường thắng phát sáng; đổi game/lật bàn → camera bay mượt;
game over → hiệu ứng nhẹ. Tất cả tắt/giảm khi `prefers-reduced-motion` hoặc khi tắt "Hiệu ứng".

## Quy tắc chung giai đoạn 2
- Chỉ sửa file trong mục "Sửa" của task. Không sửa file thuộc task của worker khác.
- Sau mỗi task: `npm test && npm run lint` (và `npm run build` khi đã có Vite). Mỗi task 1 commit: `T<id>: <tên>`.
- Kiểm tra trực quan bằng Orca browser (`orca tab create --url http://127.0.0.1:<port>/`, `orca screenshot`) và XEM ảnh trước khi báo xong.
- Không thêm dependency ngoài `vite` và `three`.

---

## Wave 1 (song song)

### T12 — [Codex] Bỏ Electron, chuyển sang Vite
- **Mục tiêu**: Dự án chỉ chạy web qua Vite; build tĩnh `dist/` chạy đúng mọi tính năng hiện có.
- **Đọc**: `package.json`, `index.html`, `main.js`, `run.bat`, `test/*.js`, `README.md`.
- **Sửa**: `package.json` (+lock), `index.html`, `vite.config.js` (mới); xóa `main.js`, `run.bat`; chuyển `js/` → `public/js/`, cập nhật đường dẫn trong `test/*.js`, `test/lint.js`.
- **Yêu cầu**: scripts `dev`, `build`, `preview`, `test`, `lint`, `start` (= dev); cài `vite@5.4.x` (devDep) và `three@0.170.0` (dep, ghim chính xác);
  thêm `<script type="module" src="/src/main.js">` (file mới, tạm chỉ log); CSP bỏ `file:`/`app:`; Web Worker AI chạy được sau build; PeerJS giữ SRI.
- **Edge cases**: `importScripts` trong worker trỏ đúng đường dẫn mới; `npm run preview` chơi được 3 game + AI.
- **Kiểm tra**: `npm test && npm run lint && npm run build`; `npm run preview` + Orca screenshot.

### T13 — [Codex] State snapshot + API nhập liệu chung (Hợp đồng mục 1)
- **Đọc/Sửa**: `public/js/game.js`, `public/js/xiangqi.js`, `public/js/xo.js` (+ `public/js/manager.js` nếu cần phát state khi đổi game).
- **Yêu cầu**: thêm `getState()`, `selectSquare(row,col)` (giữ tên cũ `handleSquareClick`/`handleClick` làm alias), phát `game:state` đúng mọi thời điểm; test Node cho snapshot (stub `window`/`CustomEvent`).
- **Edge cases**: AI đi cũng phát state; undo phát state với `moveId` mới; `captured` chỉ có ở nước vừa đi.
- **Kiểm tra**: `npm test && npm run lint && npm run build`.

### T14 — [Codex] Engine 3D lõi (Hợp đồng mục 2) + tween
- **Sửa/Tạo**: `src/3d/engine.js`, `src/3d/tween.js`, `src/main.js` (container `#board3d` phủ vùng bàn cờ, phát hiện WebGL, nối `game:state` → view hiện tại; tạm dùng 1 view demo là mặt phẳng + khối lập phương).
- **Yêu cầu**: render on-demand thật sự (idle không render); resize bằng ResizeObserver; dừng khi tab ẩn; 3 mức chất lượng; `dispose()` giải phóng renderer/geometry/material/texture.
- **Kiểm tra**: `npm run build`; Orca screenshot thấy cảnh demo; `renderer.info.render.frame` không tăng khi idle (ghi số liệu vào nhật ký).

### T15 — [Agy] Thư viện asset 3D thủ tục + preset theme (Hợp đồng mục 4)
- **Sửa/Tạo**: CHỈ file trong `src/3d/assets/` (gồm `src/3d/assets/preview.html`) và `test/assets3d.test.mjs`.
- **Ràng buộc**: KHÔNG sửa `package.json`/lockfile/`index.html`/`js/`/`public/` (Codex đang sửa). Cài three cục bộ: `npm i --no-save three@0.170.0`.
  Import `import * as THREE from 'three'`. Trang preview dùng `<script type="importmap">` map `three` → `/node_modules/three/build/three.module.js` và `three/addons/` → `/node_modules/three/examples/jsm/`; chạy `npx live-server --port=3200 --no-browser` rồi xem bằng Orca browser.
- **Yêu cầu**: 6 loại quân cờ vua đẹp, nhận diện rõ (Vua có thánh giá, Hậu vương miện răng cưa, Tượng có rãnh chéo, Xe có lỗ châu mai, Mã là đầu ngựa extrude vát cạnh, Tốt); ≤ 3k tam giác mỗi quân; 7 loại quân cờ tướng (chữ Hán rõ, Đỏ/Đen khác màu chữ và viền); X/O caro; 3 bàn cờ (gỗ procedural bằng CanvasTexture, viền vát; cờ tướng có sông 楚河 漢界 + đường chéo cung; caro lưới 15x15); 4 preset theme.
- **Test** (`node --test test/assets3d.test.mjs`): mọi factory tạo được object, số tam giác trong ngưỡng, `squareToWorld`/`worldToSquare` khứ hồi đúng mọi ô của 3 bàn. Test không dùng `document` (cho phép inject canvas factory, test dùng stub).
- **Kiểm tra**: `node --test test/assets3d.test.mjs`; Orca screenshot trang preview có đủ quân & 3 bàn ở 4 theme.

## Wave 2 (sau khi Orchestrator merge Wave 1; song song)

### T16 — [Codex] Chess 3D view + animation
- **Sửa/Tạo**: `src/3d/views/chessView.js`, `src/main.js` (đăng ký view).
- **Yêu cầu**: Hợp đồng mục 3 & 5; phong cấp: tốt biến hình thành quân mới; nhập thành: Xe và Vua cùng di chuyển; bắt tốt qua đường xóa đúng quân; lật bàn = xoay camera 180°.

### T17 — [Agy] Xiangqi 3D view + animation
- **Sửa/Tạo**: chỉ `src/3d/views/xiangqiView.js` (đăng ký view do Codex làm ở T19).
- **Yêu cầu**: Hợp đồng mục 3 & 5; quân đặt tại GIAO ĐIỂM; chữ luôn hướng về người chơi khi lật bàn.

### T18 — [Agy] Caro 3D view + animation
- **Sửa/Tạo**: chỉ `src/3d/views/xoView.js`.
- **Yêu cầu**: InstancedMesh, hover preview quân mờ theo lượt, quân rơi xuống, winLine phát sáng; pick chính xác 225 ô kể cả khi nhìn nghiêng.

### T19 — [Codex] Tích hợp UI 3D
- **Sửa**: `src/main.js`, `index.html`, `styles.css` (khối mới `/* === 3D UI === */`).
- **Yêu cầu**: đăng ký 3 view; nút 2D/3D (lưu localStorage); chọn chất lượng; màn hình loading; đổi theme → `engine.setTheme`; panel dạng HUD bán trong suốt quanh canvas; mobile: canvas full width, chạm chọn, kéo 2 ngón xoay; khi 3D bật thì ẩn DOM board nhưng giữ cho screen reader (aria-live thông báo nước đi).

## Wave 3

### T20 — [Codex] Hiệu năng, QA & tài liệu
- **Sửa**: chỉ file có lỗi phát hiện + `README.md`.
- **Yêu cầu**: đo bằng Orca browser + `renderer.info`: idle không render; đổi game 10 lần không tăng `renderer.info.memory.geometries/textures`; QA 3 game × 4 theme × (2D/3D) × (1440x900, 768x1024, 360x800); README hướng dẫn `npm run dev/build/preview` và deploy tĩnh.
