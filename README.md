# ♔ Chess Master

Ứng dụng chơi cờ chạy trên trình duyệt và Windows (Electron), hỗ trợ **Cờ Vua**, **Cờ Tướng** và **Cờ Caro (Gomoku)**.

## Tính năng

### ♟️ Cờ Vua
- Đầy đủ luật: nhập thành, bắt tốt qua đường (en passant), phong cấp
- Luật hòa: hết nước (stalemate), không đủ quân, luật 50 nước, lặp vị trí 3 lần
- Chơi với AI (minimax + cắt tỉa alpha–beta, chạy trong Web Worker nên không đơ giao diện) với 3 mức độ khó
- **Chơi online P2P** qua PeerJS: tạo phòng, chia sẻ link/mã phòng, chat trong ván
- Lưu lịch sử ván đấu (localStorage), xem lại từng nước, xuất file **PGN** chuẩn SAN
- Hoàn tác nước đi (chơi cục bộ và với AI)

### 🧧 Cờ Tướng
- Đầy đủ luật di chuyển các quân, luật lộ mặt tướng
- Phát hiện chiếu, chiếu bí và hết nước đi

### ⭕ Cờ Caro
- Bàn 15×15, thắng khi có 5 quân liên tiếp, phát hiện hòa khi bàn đầy

### 🎨 Giao diện
4 chủ đề: Harry Potter, Hy Lạp Cổ Đại, Cyber Tech, Ma Cà Rồng — kèm hiệu ứng ăn quân riêng cho từng chủ đề.

## Cách chạy

```bash
npm install

# Chạy trên trình duyệt (http://localhost:3000)
npm start

# Chạy bản desktop (Electron)
npm run electron

# Chạy unit test cho logic cờ
npm test
```

Trên Windows có thể chạy nhanh bằng `run.bat`.

## Cấu trúc mã nguồn

```
index.html        Giao diện chính
main.js           Electron entry point
js/
  pieces.js       Định nghĩa quân cờ + sinh nước đi từng loại quân
  moves.js        Luật nâng cao: nhập thành, en passant, chiếu/chiếu bí
  ai.js           AI minimax + bảng đánh giá vị trí
  ai-worker.js    Web Worker chạy AI ngoài main thread
  game.js         Điều khiển ván cờ vua (ChessGame)
  online.js       Chơi online P2P (PeerJS)
  chat.js         Chat trong ván online
  history.js      Lưu / xem lại / xuất PGN
  xiangqi.js      Cờ Tướng
  xo.js           Cờ Caro
  manager.js      Chuyển đổi giữa các loại cờ
  theme.js        Chủ đề giao diện + hiệu ứng
tests/
  run-tests.js    Unit test cho logic cờ vua
```

## Giấy phép

[MIT](LICENSE)
