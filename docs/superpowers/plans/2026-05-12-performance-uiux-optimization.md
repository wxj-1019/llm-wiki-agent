# Wiki Viewer 性能优化与 UI/UX 打磨实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Wiki Viewer 前端性能提升至 Lighthouse Performance > 80，主 bundle < 300KB(gzip)，同时打磨交互体验（加载反馈、滚动、搜索、按钮交互）。

**Architecture:** 通过代码分割、构建优化、React 渲染优化三管齐下解决性能瓶颈；通过骨架屏、涟漪效果、平滑滚动、键盘快捷键提升 UI/UX。

**Tech Stack:** React 18 + Vite 5 + Tailwind CSS v4 + Framer Motion + React Router v6

---

## 文件结构变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `wiki-viewer/src/router.tsx` | 修改 | ChatPage 改为懒加载 |
| `wiki-viewer/vite.config.ts` | 修改 | 优化 manualChunks、启用压缩 |
| `wiki-viewer/src/components/layout/LazyPage.tsx` | 修改 | 添加进度条式加载状态 |
| `wiki-viewer/src/components/ui/Skeleton.tsx` | 修改 | 添加 ChatSkeleton |
| `wiki-viewer/src/index.css` | 修改 | 添加平滑滚动、涟漪动画 |
| `wiki-viewer/src/components/ui/ScrollToTop.tsx` | 新建 | 返回顶部按钮 |
| `wiki-viewer/src/hooks/useKeyboardShortcuts.ts` | 新建 | 键盘快捷键 hook |
| `wiki-viewer/src/components/ui/RippleButton.tsx` | 新建 | 涟漪效果按钮组件 |

---

## Phase 1: 性能优化

### Task 1: ChatPage 懒加载

**Files:**
- Modify: `wiki-viewer/src/router.tsx:12`

**当前问题:** ChatPage (1829 行) 直接同步导入，打包到主 bundle 导致 764KB index.js。

- [ ] **Step 1: 将 ChatPage 改为懒加载**

```typescript
// 修改前
import { ChatPage } from '@/components/pages/ChatPage';

// 修改后
const ChatPage = lazy(() => import('@/components/pages/ChatPage').then((m) => ({ default: m.ChatPage })));
```

- [ ] **Step 2: 路由配置添加 LazyPage 包裹**

```typescript
// 修改前
{ path: '/chat/:sessionId', element: <ChatPage />, errorElement: <ErrorBoundary /> },

// 修改后
{ path: '/chat/:sessionId', element: <LazyPage><ChatPage /></LazyPage>, errorElement: <ErrorBoundary /> },
```

- [ ] **Step 3: 构建验证**

Run: `cd wiki-viewer && npm run build`
Expected: 无错误，index.js chunk 显著减小

---

### Task 2: 修复 vendor-vis 空 chunk

**Files:**
- Modify: `wiki-viewer/vite.config.ts:65-72`

**当前问题:** `vis-network` 被配置为 manualChunk 但 GraphPage 中导入的是 `vis-network/standalone`，路径不匹配导致空 chunk。

- [ ] **Step 1: 修正 vis-network 的 chunk 配置**

```typescript
// 修改前
'vendor-vis': ['vis-network'],

// 修改后
'vendor-vis': ['vis-network/standalone'],
```

- [ ] **Step 2: 构建验证**

Run: `cd wiki-viewer && npm run build`
Expected: 无 "Generated an empty chunk" 警告

---

### Task 3: Vite 构建优化

**Files:**
- Modify: `wiki-viewer/vite.config.ts:62-76`

**目标:** 启用 gzip/brotli 预压缩、优化资源内联阈值。

- [ ] **Step 1: 安装压缩插件**

Run: `cd wiki-viewer && npm install -D vite-plugin-compression`

- [ ] **Step 2: 修改 vite.config.ts**

```typescript
import { compression } from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({...}),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-shiki': ['shiki'],
          'vendor-vis': ['vis-network/standalone'],
          'vendor-motion': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-slug', 'rehype-autolink-headings'],
          'vendor-fuse': ['fuse.js'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    assetsInlineLimit: 4096, // 4KB 以下资源内联
    cssCodeSplit: true,
    sourcemap: false, // 生产环境关闭 sourcemap
  },
})
```

- [ ] **Step 3: 构建验证**

Run: `cd wiki-viewer && npm run build`
Expected: 生成 .gz 和 .br 文件，无 > 500KB chunk 警告

---

### Task 4: 图片懒加载与优化

**Files:**
- Modify: `wiki-viewer/src/components/pages/HomePage.tsx`（或其他使用图片的页面）
- Modify: `wiki-viewer/src/index.css`

- [ ] **Step 1: 创建 LazyImage 组件**

Create: `wiki-viewer/src/components/ui/LazyImage.tsx`

```typescript
import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function LazyImage({ src, alt, className = '' }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-[var(--bg-tertiary)] animate-soft-pulse rounded-xl" />
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 添加图片淡入动画到 CSS**

Modify: `wiki-viewer/src/index.css`

```css
.img-fade-in {
  animation: imgFadeIn 0.4s ease-out;
}

@keyframes imgFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
```

---

## Phase 2: UI/UX 打磨

### Task 5: 改进 LazyPage 加载状态

**Files:**
- Modify: `wiki-viewer/src/components/layout/LazyPage.tsx`

**当前问题:** 只有简单的旋转 loading，用户体验差。

- [ ] **Step 1: 重写 LazyPage 组件**

```typescript
import { Suspense, type ReactNode } from 'react';
import { motion } from 'framer-motion';

function PageLoader({ label }: { label: string }) {
  return (
    <div className="h-[calc(100vh-7rem)] -mx-6 -my-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {/* 进度条式加载 */}
        <div className="relative w-48 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-4 mx-auto">
          <motion.div
            className="absolute inset-y-0 left-0 bg-apple-blue rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '70%', '90%'] }}
            transition={{
              duration: 2,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Loading {label}...</p>
      </motion.div>
    </div>
  );
}

export function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoader label="page" />}>
      {children}
    </Suspense>
  );
}
```

---

### Task 6: 添加 ChatSkeleton

**Files:**
- Modify: `wiki-viewer/src/components/ui/Skeleton.tsx`

- [ ] **Step 1: 添加 ChatSkeleton 组件**

在 `wiki-viewer/src/components/ui/Skeleton.tsx` 末尾添加：

```typescript
export function ChatSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading chat" className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="w-32 h-5 rounded-xl" />
        </div>
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      {/* Messages area */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-hidden">
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="w-2/3 h-16 rounded-2xl rounded-tr-sm" />
        </div>
        {/* Assistant message */}
        <div className="flex justify-start">
          <Skeleton className="w-3/4 h-20 rounded-2xl rounded-tl-sm" />
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <Skeleton className="w-1/2 h-12 rounded-2xl rounded-tr-sm" />
        </div>
      </div>
      {/* Input area */}
      <div className="px-4 py-3 border-t border-[var(--border-default)]">
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    </div>
  );
}
```

---

### Task 7: 平滑滚动与返回顶部

**Files:**
- Create: `wiki-viewer/src/components/ui/ScrollToTop.tsx`
- Modify: `wiki-viewer/src/components/layout/RootLayout.tsx`

- [ ] **Step 1: 创建 ScrollToTop 组件**

```typescript
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;

    const handleScroll = () => {
      setIsVisible(main.scrollTop > 400);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-lg hover:shadow-xl hover:border-[var(--border-strong)] transition-shadow"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} className="text-[var(--text-secondary)]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: 添加到 RootLayout**

Modify: `wiki-viewer/src/components/layout/RootLayout.tsx`

在 `</div>` (第 160 行) 之前添加：

```typescript
import { ScrollToTop } from '@/components/ui/ScrollToTop';

// ... 在 return 的最后添加：
<ScrollToTop />
```

- [ ] **Step 3: 添加平滑滚动到 CSS**

Modify: `wiki-viewer/src/index.css`

在 `html, body, #root` 规则中添加：

```css
html, body, #root {
  height: 100%;
  overflow: hidden;
  scroll-behavior: smooth;
}

/* main 内容区平滑滚动 */
#main-content {
  scroll-behavior: smooth;
}
```

---

### Task 8: 键盘快捷键

**Files:**
- Create: `wiki-viewer/src/hooks/useKeyboardShortcuts.ts`
- Modify: `wiki-viewer/src/components/layout/RootLayout.tsx`

- [ ] **Step 1: 创建 useKeyboardShortcuts hook**

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 忽略输入框中的快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          // 聚焦搜索框（如果存在）
          const searchInput = document.querySelector('[data-search-input]') as HTMLElement;
          if (searchInput) searchInput.focus();
          break;
        case 'g':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/graph');
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/chat');
          }
          break;
        case 'h':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigate('/');
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
}
```

- [ ] **Step 2: 在 RootLayout 中使用**

```typescript
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function RootLayout() {
  useKeyboardShortcuts();
  // ... rest of component
}
```

---

### Task 9: 涟漪效果按钮

**Files:**
- Create: `wiki-viewer/src/components/ui/RippleButton.tsx`
- Modify: `wiki-viewer/src/index.css`

- [ ] **Step 1: 创建 RippleButton 组件**

```typescript
import { useState, useCallback, type ReactNode, type ButtonHTMLAttributes } from 'react';

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function RippleButton({ children, onClick, className = '', ...props }: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.(e);
  }, [onClick]);

  return (
    <button
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple-effect"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}
    </button>
  );
}
```

- [ ] **Step 2: 添加涟漪动画到 CSS**

```css
.ripple-effect {
  position: absolute;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  margin-top: -10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  animation: ripple 0.6s ease-out;
  pointer-events: none;
}

@keyframes ripple {
  from {
    transform: scale(0);
    opacity: 1;
  }
  to {
    transform: scale(20);
    opacity: 0;
  }
}
```

---

## Phase 3: 验证与测试

### Task 10: 构建验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `cd wiki-viewer && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 生产构建**

Run: `cd wiki-viewer && npm run build`
Expected:
- 无 "empty chunk" 警告
- 无 "> 500KB" chunk 警告
- 生成 .gz 和 .br 文件
- 主 bundle 显著减小

- [ ] **Step 3: 功能验证**

Run: 前后端服务，访问以下页面验证：
- `/` - 首页正常加载
- `/chat/:id` - 聊天页面懒加载正常，有骨架屏
- `/graph` - 图谱页面正常
- 滚动到底部，验证返回顶部按钮出现
- 按 `/` 键验证搜索聚焦

---

## 成功标准检查清单

- [ ] Lighthouse Performance 评分 > 80
- [ ] 首屏加载时间 < 2s（Fast 3G 模拟）
- [ ] 主 bundle < 300KB（gzip）
- [ ] 无 > 500KB 的 chunk
- [ ] ChatPage 独立 chunk 且懒加载正常
- [ ] 所有页面有骨架屏/加载状态
- [ ] 返回顶部按钮工作正常
- [ ] 键盘快捷键工作正常
- [ ] 涟漪效果按钮可用
