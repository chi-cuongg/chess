# ♔ Chess Master

Ứng dụng chơi cờ (cờ vua, cờ tướng, cờ XO) chạy trên trình duyệt hoặc desktop
(Electron). Hỗ trợ chơi 2 người, chơi với AI, chơi online P2P và nhiều giao diện
theo chủ đề.

## Tính năng

- **Cờ vua**: đầy đủ luật cơ bản (nhập thành, phong cấp, bắt tốt qua đường),
  phát hiện chiếu hết, hết nước (stalemate), không đủ quân, luật 50 nước và
  lặp lại thế cờ 3 lần.
- **AI**: minimax + cắt tỉa alpha-beta, có bảng giá trị theo vị trí; chạy trong
  Web Worker để không chặn giao diện (tự động fallback nếu Worker bị chặn).
- **Cờ tướng**: luật quân cơ bản, cấm lộ mặt tướng, phát hiện chiếu bí / hết nước.
- **Cờ XO (Caro)**: bàn 15x15, thắng khi có 5 quân liên tiếp, hòa khi kín bàn.
- **Online P2P**: tạo phòng / vào phòng qua PeerJS, có chat, đầu hàng, đồng bộ
  nước đi.
- **Lịch sử**: lưu ván đấu vào `localStorage`, xem lại (replay) và xuất PGN
  (chuẩn SAN).
- **Giao diện**: 4 chủ đề (Harry Potter, Hy Lạp, Cyber, Ma Cà Rồng) kèm hiệu ứng.

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
npm test    # chạy test cho engine cờ vua (move generation, luật, AI)
npm run lint # kiểm tra cú pháp tất cả file JS
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
  ai-worker.js      # Web Worker bọc AI
  game.js           # bộ điều khiển cờ vua (UI + luật)
  online.js         # kết nối P2P PeerJS
  chat.js           # chat trong ván online
  history.js        # lưu / xem lại / xuất PGN
  theme.js          # chuyển theme + hiệu ứng
  xiangqi.js        # cờ tướng
  xo.js             # cờ XO
  manager.js        # chọn loại cờ, điều phối ván
  bootstrap.js      # khởi tạo online/chat/history
test/
  chess.test.js     # test engine cờ vua (Node, không cần thư viện)
  lint.js           # kiểm tra cú pháp các file JS
```

## Bảo mật

- Tiến trình renderer của Electron chạy với `contextIsolation: true` và
  `nodeIntegration: false`.
- `index.html` áp dụng Content-Security-Policy; script PeerJS từ CDN được ghim
  bằng `integrity` (SRI).
- Nội dung chat được escape trước khi hiển thị để tránh XSS.
