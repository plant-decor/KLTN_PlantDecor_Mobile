# PlantDecor

**Ứng dụng mua bán cây cảnh & thiết kế không gian xanh thông minh tích hợp AI**

PlantDecor là ứng dụng di động giúp người dùng khám phá, mua sắm cây cảnh và sử dụng AI để thiết kế không gian xanh cho ngôi nhà, văn phòng hoặc bất kỳ không gian sống nào.

---

## Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Mua sắm cây cảnh** | Duyệt, tìm kiếm, lọc theo danh mục, mức độ chăm sóc, kích thước, giá cả |
| **Thiết kế AI** | Chụp ảnh không gian → AI gợi ý bố trí cây cảnh phù hợp phong cách |
| **Chat AI** | Tư vấn chăm sóc cây, kiến thức về cây cảnh thông qua AI chatbot |
| **Giỏ hàng & Thanh toán** | Quản lý giỏ hàng, đặt hàng, theo dõi đơn hàng, thanh toán an toàn |
| **Tài khoản** | Đăng ký, đăng nhập, quản lý hồ sơ, lịch sử đơn hàng, Google Sign-In |
| **Đánh giá sản phẩm** | Xem đánh giá và review từ người dùng khác |
| **Theo dõi cây của tôi** | Quản lý danh sách cây trong nhà, theo dõi độ ẩm, ánh sáng |
| **Dịch vụ chăm sóc** | Đặt lịch dịch vụ chăm sóc cây tại nhà |
| **Dịch vụ thiết kế** | Thiết kế không gian xanh chuyên nghiệp từ designer |
| **Chat hỗ trợ** | Liên hệ trực tiếp với team support qua chat real-time |
| **Danh sách yêu thích** | Lưu sản phẩm yêu thích để mua sau |

---

## Tech Stack

| Công nghệ | Mô tả |
|---|---|
| **React Native** (Expo SDK 54) | Framework mobile cross-platform |
| **TypeScript** | Type-safe JavaScript |
| **Zustand** | Lightweight state management |
| **React Navigation** | Bottom Tabs + Native Stack |
| **Axios** | HTTP client với interceptors & token refresh |
| **Expo SecureStore** | Lưu trữ token bảo mật |
| **Expo ImagePicker** | Chọn ảnh / chụp ảnh cho AI Design |
| **i18next + react-i18next** | Đa ngôn ngữ (English / Vietnamese) |

---

## Cấu trúc dự án

```
src/
├── components/          # Reusable UI components
│   ├── branding/        # Brand components (logo, etc.)
│   ├── media/           # Media components (image gallery, etc.)
│   └── Notify/          # Notification components
├── config/              # Configuration files
│   └── env.ts           # Environment setup
├── constants/           # Colors, fonts, spacing, API endpoints
│   └── index.ts
├── i18n/                # i18n config + translation resources
│   ├── index.ts
│   └── translations/
│       ├── en.ts
│       └── vi.ts
├── hooks/               # Custom React hooks
│   ├── index.ts
│   └── useDebounce.ts
├── navigation/          # React Navigation setup
│   ├── BottomTabNavigator.tsx
│   ├── RootNavigator.tsx
│   └── index.ts
├── screens/             # Các màn hình chính
│   ├── AIChat/          # AI Chat interface
│   ├── AIChatSessions/  # Chat history/sessions
│   ├── AIDesign/        # AI Design feature
│   ├── Cart/            # Giỏ hàng
│   ├── Catalog/         # Catalog/Danh sách sản phẩm
│   ├── Checkout/        # Thanh toán
│   ├── ComboDetail/     # Combo product details
│   ├── Home/            # Trang chủ
│   ├── Login/           # Đăng nhập
│   ├── MaterialDetail/  # Material details
│   ├── OrderDetail/     # Chi tiết đơn hàng
│   ├── OrderHistory/    # Lịch sử đơn hàng
│   ├── PlantDetail/     # Chi tiết sản phẩm
│   ├── PlantInstanceDetail/ # User plant instance details
│   ├── Profile/         # Tài khoản
│   ├── Register/        # Đăng ký
│   ├── ServiceHub/      # Service hub/marketplace
│   ├── SupportChat/     # Chat support
│   ├── UserPlants/      # My plants
│   ├── Wishlist/        # Danh sách yêu thích
│   ├── DesignService/   # Design service screens
│   ├── CareService*/    # Care service related screens
│   ├── Caretaker*/      # Caretaker/Worker screens
│   ├── Shipper*/        # Shipper/Delivery screens
│   ├── ForgotPassword/  # Password recovery
│   ├── VerifyCode/      # OTP verification
│   ├── EditProfile/     # Edit profile
│   ├── PaymentWebView/  # Payment gateway
│   ├── PaymentSuccess/  # Payment confirmation
│   └── index.ts
├── services/            # API service layer
│   ├── api.ts           # Axios instance + interceptors
│   ├── authService.ts   # Auth API calls
│   ├── aiChatService.ts # AI Chat API
│   ├── cartService.ts   # Cart operations
│   ├── careService.ts   # Care service API
│   ├── designService.ts # Design service API
│   ├── enumService.ts   # Enum/lookup data
│   ├── googleSignInService.ts # Google auth
│   ├── orderService.ts  # Order management
│   ├── paymentService.ts # Payment integration
│   ├── plantService.ts  # Plant data
│   ├── returnTicketService.ts # Return management
│   ├── roomDesignService.ts # Room design API
│   ├── supportRealtimeService.ts # Real-time support
│   ├── supportService.ts # Support service
│   ├── wishlistService.ts # Wishlist operations
│   └── index.ts
├── stores/              # Zustand state management
│   ├── useAuthStore.ts
│   ├── useAIDesignStore.ts
│   ├── useCartStore.ts
│   ├── useEnumStore.ts
│   ├── useNotificationStore.ts
│   ├── usePlantStore.ts
│   ├── useUserPlantStore.ts
│   ├── useWishlistStore.ts
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
└── utils/               # Helper functions
    ├── authErrors.ts
    ├── authFlow.ts
    ├── caretakerProgress.ts
    ├── dateTime.ts
    └── ... (other utilities)
```

---

## Bắt đầu

### Yêu cầu

- **Node.js** >= 18
- **npm** hoặc **yarn**
- **Expo CLI** (`npx expo`)
- **Expo Go** app trên điện thoại (hoặc Android Emulator / iOS Simulator)

### Cài đặt

```bash
# Clone repository
git clone <repo-url>
cd KLTN_PlantDecor_Mobile

# Cài đặt dependencies
npm install

# Chạy ứng dụng
npx expo start
```

### Chạy trên thiết bị

```bash
# Android
npm run android

# iOS (macOS only)
npm run ios

# Web
npm run web
```

---

## Zustand Stores

### `useAuthStore`
Quản lý xác thực người dùng: đăng nhập, đăng ký, đăng xuất, cập nhật hồ sơ, kiểm tra token.

### `useCartStore`
Quản lý giỏ hàng: thêm/xóa sản phẩm, tăng/giảm số lượng, tính tổng tiền.

### `usePlantStore`
Quản lý sản phẩm: fetch danh sách, tìm kiếm, phân trang, lọc theo danh mục.

### `useUserPlantStore`
Quản lý các cây của người dùng: thêm, cập nhật, xóa thông tin cây trong nhà.

### `useAIDesignStore`
Quản lý thiết kế AI: upload ảnh, gọi API sinh thiết kế, lưu lịch sử.

### `useWishlistStore`
Quản lý danh sách yêu thích: thêm/xóa sản phẩm yêu thích.

### `useEnumStore`
Quản lý dữ liệu lookup: danh mục, loại không gian, phong cách, mức độ chăm sóc, v.v.

### `useNotificationStore`
Quản lý thông báo: hiển thị/ẩn notifications, quản lý trạng thái.

---

## Đa ngôn ngữ

- Ứng dụng hỗ trợ 2 ngôn ngữ: **English (`en`)** và **Tiếng Việt (`vi`)**.
- i18n được khởi tạo tại `App.tsx` thông qua `src/i18n/index.ts`.
- Ngôn ngữ người dùng được lưu bằng `Expo SecureStore` với key `app_language`.
- Có thể đổi ngôn ngữ trực tiếp trong màn hình **Profile**.
- Tạm thời chỉ sử dụng Tiếng Anh
---

## Màn hình

| Màn hình | Mô tả |
|---|---|
| **Home** | Trang chủ với banner AI, danh mục, sản phẩm nổi bật, combo |
| **Catalog** | Danh sách cây cảnh với infinite scroll, tìm kiếm, lọc |
| **PlantDetail** | Chi tiết sản phẩm, thông tin chăm sóc, đánh giá, thêm giỏ hàng |
| **Cart** | Quản lý giỏ hàng, tăng/giảm số lượng, áp dụng mã giảm giá |
| **Checkout** | Xác nhận đơn hàng, chọn địa chỉ, chọn phương thức thanh toán |
| **AIDesign** | Chụp ảnh → chọn loại không gian & phong cách → AI sinh thiết kế |
| **AIChat** | Chat với AI assistant về chăm sóc cây và kiến thức cây cảnh |
| **ServiceHub** | Trung tâm dịch vụ: chăm sóc, thiết kế, hỗ trợ |
| **Profile** | Thông tin tài khoản, lịch sử đơn hàng, cài đặt ngôn ngữ |
| **Wishlist** | Danh sách sản phẩm yêu thích |
| **UserPlants** | Danh sách cây của tôi, chi tiết chăm sóc |
| **OrderHistory** | Lịch sử đơn hàng, chi tiết từng đơn |
| **SupportChat** | Chat với customer support, quản lý ticket hỗ trợ |
| **Login/Register** | Đăng nhập/Đăng ký, Google Sign-In, Forgot Password |

---

## Vai trò người dùng (User Roles)

Ứng dụng hỗ trợ nhiều vai trò khác nhau:

- **Customer** - Khách hàng mua hàng và sử dụng dịch vụ
- **Caretaker** - Người chăm sóc cây được đặt lịch qua dịch vụ
- **Shipper** - Người giao hàng, quản lý đơn vận chuyển

---

## Tác giả

- **KLTN** — Khóa luận tốt nghiệp — Semester 9, Spring 2026
---

## License

Dự án này phục vụ mục đích học tập và nghiên cứu.
