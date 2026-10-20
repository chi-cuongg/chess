# ♔ Bàn cờ Việt

Ứng dụng chơi cờ (cờ vua, cờ tướng, cờ XO) chạy trên trình duyệt hoặc desktop
(Electron). Hỗ trợ chơi 2 người, chơi với AI, chơi online P2P và nhiều giao diện
theo chủ đề.

## Tính năng

- **Cờ vua**: nhập thành, phong cấp, bắt tốt qua đường; phát hiện chiếu hết,
  hết nước (hòa), không đủ quân, luật 50 nước và lặp lại thế cờ 3 lần.
  AI minimax/alpha-beta chạy qua Web Worker; ba mức khó dùng độ sâu 2/4/6.
- **Cờ tướng**: luật cung/sông, cản chân mã/mắt tượng, ngòi pháo, cấm lộ mặt
  tướng và tự chiếu; chiếu bí hoặc hết nước đều thua. Có gợi ý nước hợp lệ,
  highlight nước cuối/tướng bị chiếu và danh sách quân bị ăn.
  AI negamax/alpha-beta tìm sâu dần với ngân sách khoảng 200/800/2000ms.
  Có thể chọn cầm Đỏ hoặc Đen; bàn tự lật khi cầm Đen đấu AI.
- **Cờ Caro**: bàn 15×15, ít nhất 5 quân liên tiếp thì thắng (không áp dụng
  luật chặn hai đầu); tô sáng 5 ô thắng, nước cuối và preview khi rê chuột.
  AI chấm pattern tấn công/phòng thủ, ưu tiên thắng ngay/chặn bốn;
  mức vừa/khó có tìm kiếm alpha-beta sâu tối đa 2/4. Người cầm X đi trước, AI cầm O.
- **AI và hoàn tác**: chọn độ khó rồi bấm “Chơi với AI”; chọn “Chơi 2 người”
  để tắt AI. Cả ba game dùng Worker. Cờ tướng/Caro có fallback chia lát trên
  main thread khi Worker không dùng được. Hoàn tác lùi cặp nước đã hoàn tất,
  hoặc chỉ nước người chơi nếu AI đang chờ; kết quả tìm kiếm cũ bị hủy.
- **Online P2P — chỉ cờ vua**: tạo/vào phòng qua PeerJS, chat, đầu hàng và
  đồng bộ nước đi. Không thể đổi loại cờ hay bật AI khi đang trong phòng.
- **Lịch sử — chỉ cờ vua**: lưu ván đấu vào `localStorage`, replay và xuất PGN
  dùng ký hiệu SAN. Đổi game dừng replay và AI của game cũ.
- **Giao diện**: bốn chủ đề Harry Potter, Hy Lạp, Cyber và Ma Cà Rồng.
  Nút “✨ Hiệu ứng” bật/tắt hiệu ứng, lưu lựa chọn cùng theme và loại cờ.
  Timer/particle được dọn khi ẩn tab, đổi theme hoặc đổi game;
  tôn trọng `prefers-reduced-motion` của hệ điều hành.
- **Responsive và bàn phím**: điều khiển chuyển xuống dưới bàn khi màn hình
  hẹp, bàn tự co theo chiều cao màn hình sau khi trừ header và khung/nhãn;
  cờ tướng giữ tỉ lệ 9×10. Caro dùng màu của theme; font có tiếng Việt.
  Nút tối thiểu 40px. Dùng Tab/Shift+Tab để đi qua các điều khiển;
  Esc hoặc click nền đóng modal. Đóng chọn phong cấp hủy lựa chọn để đi lại nước đó.

## Yêu cầu

- [Node.js](https://nodejs.org/) 18 trở lên (khuyến nghị 20+).

## Cài đặt

```bash
npm install
```

## Chạy ứng dụng

Chạy trên trình duyệt (live-server, mở sẵn `index.html`):

```bash
npm start
```

Chạy như ứng dụng desktop (Electron):

```bash
npm run electron
```

Trên Windows cũng có thể nháy đúp `run.bat`.

> Chế độ online cần kết nối Internet vì dùng máy chủ PeerJS công khai để bắt tay
> kết nối P2P.

## Kiểm thử & kiểm tra cú pháp

```bash
npm test     # luật/AI cả ba game và hồi quy controller/lifecycle
npm run lint # tự quét và kiểm tra cú pháp tất cả file JS, gồm file mới
```

## Cấu trúc thư mục

```
index.html          # khung giao diện + CSP
styles.css          # toàn bộ style và các theme
main.js             # tiến trình chính Electron (custom app:// protocol)
run.bat             # chạy nhanh trên Windows
js/
  pieces.js         # định nghĩa quân và sinh nước đi theo quân
  moves.js          # luật đặc biệt, kiểm tra hợp lệ / chiếu hết / hòa
  ai.js             # đánh giá thế cờ + minimax
  ai-worker.js      # Web Worker định tuyến AI của cả ba game
  game.js           # bộ điều khiển cờ vua (UI + luật)
  online.js         # kết nối P2P PeerJS
  chat.js           # chat trong ván online
  history.js        # lưu / xem lại / xuất PGN
  theme.js          # chuyển theme + hiệu ứng
  xiangqi-rules.js  # luật cờ tướng thuần, export cho Node
  xiangqi-ai.js     # AI cờ tướng, có tìm kiếm chia lát
  xiangqi.js        # UI/controller cờ tướng
  xo-rules.js       # luật Caro thuần, kiểm tra đường thắng
  xo-ai.js          # AI Caro theo pattern + alpha-beta
  xo.js             # UI/controller Caro
  manager.js        # chọn loại cờ, điều phối ván
  bootstrap.js      # khởi tạo online/chat/history
test/
  chess.test.js     # test engine cờ vua (Node, không cần thư viện)
  xiangqi.test.js   # luật và AI cờ tướng
  xo.test.js        # luật và AI Caro
  controllers.test.js # undo/Worker, render/replay/PGN, theme và Manager
  lint.js           # tự quét các file JS để kiểm tra cú pháp
```

## Phạm vi kiểm thử tích hợp

`npm test` chạy 59 test (12 cờ vua, 16 cờ tướng, 15 Caro và 16 controller/lifecycle),
không cần cài thư viện test mới. Bộ hồi quy có trường hợp undo khi AI đang chờ,
bỏ kết quả Worker trả muộn, giữ node render T7, dừng replay, xuất SAN PGN,
dọn timer theme T8, toggle hiệu ứng và khóa đổi game trong phòng online.

Đã kiểm tra trên browser Orca: 36 tổ hợp của 360/768/1440px × ba game × bốn theme
về kích thước bàn, tràn ngang, kích thước nút và vị trí toggle hiệu ứng;
28 kiểm tra hành vi gồm năm vòng đổi game, Worker/fallback, undo và modal.
Sau review T11, đã chụp lại 12 ảnh Orca ở 1255×706 (bốn theme × ba game):
hàng cuối và nhãn a–h nằm trọn trong viewport, Chat ẩn ở cờ tướng/Caro,
banner dùng tên chung và màu Caro thay đổi theo theme. Kiểm tra resize thêm
360×800, 768×1024, 1255×550 và 1440×900 không phát hiện tràn bàn.
Cần review riêng Electron `app://`, một ván PeerJS giữa hai máy và đo CPU idle
bằng DevTools Performance; các kiểm tra browser/Node trên không thay thế ba mục này.

## Bảo mật

- Tiến trình renderer của Electron chạy với `contextIsolation: true` và
  `nodeIntegration: false`.
- `index.html` áp dụng Content-Security-Policy; script PeerJS từ CDN được ghim
  bằng `integrity` (SRI).
- Nội dung chat được escape trước khi hiển thị để tránh XSS.
