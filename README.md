# 🌿 PlantDecor

**Ứng dụng mua bán cây cảnh & thiết kế không gian xanh thông minh tích hợp AI**

PlantDecor là ứng dụng di động giúp người dùng khám phá, mua sắm cây cảnh và sử dụng AI để thiết kế không gian xanh cho ngôi nhà, văn phòng hoặc bất kỳ không gian sống nào.

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|---|---|
| 🛒 **Mua sắm cây cảnh** | Duyệt, tìm kiếm, lọc theo danh mục, mức độ chăm sóc, kích thước, giá cả |
| 🤖 **Thiết kế AI** | Chụp ảnh không gian → AI gợi ý bố trí cây cảnh phù hợp phong cách |
| 🛍️ **Giỏ hàng & Thanh toán** | Quản lý giỏ hàng, đặt hàng, theo dõi đơn hàng |
| 👤 **Tài khoản** | Đăng ký, đăng nhập, quản lý hồ sơ, lịch sử đơn hàng |
| ⭐ **Đánh giá sản phẩm** | Xem đánh giá và review từ người dùng khác |

---

## 🛠️ Tech Stack

| Công nghệ | Mô tả |
|---|---|
| **React Native** (Expo SDK 54) | Framework mobile cross-platform |
| **TypeScript** | Type-safe JavaScript |
| **Zustand** | Lightweight state management |
| **React Navigation** | Bottom Tabs + Native Stack |
| **Axios** | HTTP client với interceptors & token refresh |
| **Expo SecureStore** | Lưu trữ token bảo mật |
| **Expo ImagePicker** | Chọn ảnh / chụp ảnh cho AI Design |

---

## 📁 Cấu trúc dự án

```
src/
├── constants/           # Colors, fonts, spacing, API endpoints
│   └── index.ts
├── hooks/               # Custom React hooks
│   ├── index.ts
│   └── useDebounce.ts
├── navigation/          # React Navigation setup
│   ├── BottomTabNavigator.tsx
│   ├── RootNavigator.tsx
│   └── index.ts
├── screens/             # Các màn hình chính
│   ├── Home/            # Trang chủ
│   ├── Products/        # Danh sách sản phẩm
│   ├── ProductDetail/   # Chi tiết sản phẩm
│   ├── Cart/            # Giỏ hàng
│   ├── Profile/         # Tài khoản
│   ├── AIDesign/        # Thiết kế AI
│   └── index.ts
├── services/            # API service layer
│   ├── api.ts           # Axios instance + interceptors
│   ├── authService.ts   # Auth API calls
│   ├── productService.ts
│   └── index.ts
├── stores/              # Zustand state management
│   ├── useAuthStore.ts
│   ├── useCartStore.ts
│   ├── useProductStore.ts
│   ├── useAIDesignStore.ts
│   └── index.ts
├── types/               # TypeScript type definitions
│   └── index.ts
└── utils/               # Helper functions
    └── index.ts
```

---

## 🚀 Bắt đầu

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

## 🗂️ Zustand Stores

### `useAuthStore`
Quản lý xác thực người dùng: đăng nhập, đăng ký, đăng xuất, cập nhật hồ sơ, kiểm tra token.

### `useCartStore`
Quản lý giỏ hàng: thêm/xóa sản phẩm, tăng/giảm số lượng, tính tổng tiền.

### `useProductStore`
Quản lý sản phẩm: fetch danh sách, tìm kiếm, phân trang, lọc theo danh mục.

### `useAIDesignStore`
Quản lý thiết kế AI: upload ảnh, gọi API sinh thiết kế, lưu lịch sử.

---

## ⚙️ Cấu hình

### API Base URL

Chỉnh sửa trong [src/constants/index.ts](src/constants/index.ts):

```typescript
export const API = {
  BASE_URL: __DEV__
    ? 'http://10.0.2.2:3000/api'       // Android Emulator
    : 'https://api.plantdecor.vn/api',  // Production
};
```

> **Lưu ý:** Với thiết bị thật qua Expo Go, thay `10.0.2.2` bằng IP máy tính trong mạng LAN (ví dụ `192.168.1.x`).

---

## 📱 Màn hình

| Màn hình | Mô tả |
|---|---|
| **Home** | Trang chủ với banner AI, danh mục, sản phẩm nổi bật |
| **Products** | Danh sách cây cảnh với infinite scroll |
| **ProductDetail** | Chi tiết sản phẩm, thông tin chăm sóc, thêm giỏ hàng |
| **Cart** | Quản lý giỏ hàng, tăng/giảm số lượng, thanh toán |
| **AIDesign** | Chọn ảnh → chọn loại không gian & phong cách → AI sinh thiết kế |
| **Profile** | Thông tin tài khoản, lịch sử đơn hàng, cài đặt |

---

## 👥 Tác giả

- **KLTN** — Khóa luận tốt nghiệp — Semester 9, Spring 2026

---

## 📄 License

Dự án này phục vụ mục đích học tập và nghiên cứu.
