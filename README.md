# ♔ Bàn cờ Việt

Ứng dụng web chơi cờ vua, cờ tướng và Caro bằng Vite, có bàn 2D và 3D.
Hỗ trợ chơi 2 người, chơi với AI, chơi online P2P và nhiều giao diện
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

Chạy máy chủ phát triển, mở địa chỉ Vite in trong terminal (mặc định http://127.0.0.1:3000):

```bash
npm run dev
```

`npm start` là lệnh tương đương. Tạo và kiểm tra bản production:

```bash
npm run build
npm run preview
```

Mở http://127.0.0.1:4173 để kiểm tra bản trong `dist/`.
Triển khai tĩnh bằng cách đưa **toàn bộ nội dung `dist/`** lên máy chủ HTTP(S)
(ví dụ static hosting hoặc Nginx). Giữ nguyên `assets/`, `js/` và tên file;
Vite dùng `base: './'` nên có thể đặt tại thư mục con, ví dụ `/ban-co/`.
Không mở trực tiếp `index.html` bằng `file://`: module 3D và Worker cần HTTP(S).
Sau khi sửa mã, chạy build lại trước khi triển khai; máy chủ không cần Node.js.

> Chế độ online cần kết nối Internet vì dùng máy chủ PeerJS công khai để bắt tay
> kết nối P2P.

## Bàn 3D và chất lượng

Chọn **3D** trên thanh phía trên bàn; chọn **2D** để quay lại. Chế độ hiển thị,
chất lượng, theme và loại cờ được lưu trên thiết bị. Three.js và các view chỉ
được tải khi bật 3D; khởi động ở 2D không tải chunk Three.js. Nếu WebGL 2
không dùng được hoặc tải 3D lỗi, ứng dụng tự quay về 2D và hiện thông báo.

Ba bàn có quân thủ tục theo bốn theme: cờ vua giữa ô, cờ tướng trên giao điểm,
Caro X/O giữa ô. Có gợi ý nước đi, chọn/nâng quân, cung di chuyển, hiệu ứng ăn quân,
chiếu, lật camera và đường thắng Caro. Dùng chuột/chạm để chọn, kéo chuột hoặc
kéo hai ngón để xoay, cuộn/chụm hai ngón để thu phóng. Khi lật cờ tướng,
chữ trên quân xoay theo người chơi. Nút “✨ Hiệu ứng” và `prefers-reduced-motion`
giảm/tắt animation; các hiệu ứng chiếu/thắng tự kết thúc để renderer có thể nghỉ.
Bàn 2D vẫn được giữ cho screen reader; trạng thái nước đi được thông báo bằng aria-live.

| Chất lượng | Giới hạn mật độ pixel | Bóng đổ |
|---|---:|---|
| Thấp | 1× | Tắt |
| Vừa (mặc định) | 1,5× | Tắt |
| Cao | 2× | Bật |

Giới hạn thực tế còn phụ thuộc `devicePixelRatio`. Chọn Thấp nếu thiết bị nóng
hoặc thao tác chậm. Renderer chỉ vẽ khi có thay đổi/tween/tương tác camera,
dừng khi tab ẩn và giải phóng tài nguyên khi về 2D hoặc đổi view.

## Kiểm thử & kiểm tra cú pháp

```bash
npm test     # luật/AI, controller, asset và view 3D
npm run lint # tự quét và kiểm tra cú pháp tất cả file JS, gồm file mới
npm run build
```

## Cấu trúc thư mục

```
index.html          # khung giao diện + CSP
styles.css          # toàn bộ style và các theme
vite.config.js      # Vite, đường dẫn build tương đối
src/main.js         # tích hợp 2D/3D, lazy loading và nhập liệu
src/3d/             # engine, tween, assets thủ tục, ba view
public/js/
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

`npm test` chạy luật/AI, controller/lifecycle, asset và ba view 3D,
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
Kết quả T20, số đo renderer, lỗi đã sửa và giới hạn kiểm thử được ghi trong
`TODO_WORKER.md` (Nhật ký worker) và `T20_QA.md`.
Cần review riêng một ván PeerJS giữa hai máy và thiết bị cảm ứng/GPU thực;
kiểm tra bằng trình duyệt tự động không thay thế các lượt thử đó.

## Bảo mật

- `index.html` áp dụng Content-Security-Policy; script PeerJS từ CDN được ghim
  bằng `integrity` (SRI).
- Nội dung chat được escape trước khi hiển thị để tránh XSS.
