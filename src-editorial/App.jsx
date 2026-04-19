import { useState, useEffect, useRef } from "react";
import { INIT_PLANS, INIT_DIMS } from "./constants/mock-data.js";
import { fetchPlans, fetchDimensions } from "./services/workService.js";
import { COLOR, GAP } from "./constants/theme.js";
import Sidebar from "./components/layout/Sidebar.jsx";
import Dashboard from "./pages/Dashboard/index.jsx";
import WorkBench from "./pages/WorkBench/index.jsx";
import SpellBook from "./pages/MCP/index.jsx";
import Login from "./pages/Login.jsx";
import UserPanel from "./pages/WorkBench/UserPanel.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import LoadingSplash from "./components/ui/LoadingSplash.jsx";
import PageCardStack from "./components/ui/PageCardStack.jsx";
import EditorialSettings from "./components/ui/EditorialSettings.jsx";

// 数据来源跟老面板一致：读 VITE_USE_API（默认走真实接口，显式设为 'false' 才 mock）
const USE_API = import.meta.env.VITE_USE_API !== 'false';
const AUTH_KEY = 'deskhub_auth';

// ─── Editorial 全局注入：字体 + 大气层泛光 ─────────────
// 所有规则用 body[data-mode="editorial"] 前缀作用域，避免污染原版
if (typeof document !== 'undefined' && !document.getElementById('editorial-globals')) {
  const fontLink = document.createElement('link');
  fontLink.id = 'editorial-fonts';
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  const style = document.createElement('style');
  style.id = 'editorial-globals';
  style.textContent = `
    body[data-mode="editorial"] {
      /* 背景视频通过 <video> 元素渲染（在 React 树里），body 只设基础色 + vignette */
      background-color: #1a1d18 !important;
      background-image:
        radial-gradient(ellipse at center,
          transparent 35%,
          rgba(250,248,245,0.10) 65%,
          rgba(250,248,245,0.25) 90%,
          rgba(250,248,245,0.45) 100%) !important;
      background-attachment: fixed !important;
      color: #fdfbfa;
      font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
      position: relative;
    }
    /* 三页统一色调 —— 同步到 Dashboard 那套（用户觉得最好）*/
    body[data-mode="editorial"][data-page="dashboard"],
    body[data-mode="editorial"][data-page="mcp"],
    body[data-mode="editorial"][data-page="workbench"] {
      color: #1a1d18;
    }
    /* 工单页和 MCP 视频比较亮，加一层暖白 wash 保证文字读得清 */
    body[data-mode="editorial"][data-page="workbench"],
    body[data-mode="editorial"][data-page="mcp"] {
      background-image:
        radial-gradient(ellipse at center,
          transparent 30%,
          rgba(250,248,245,0.18) 60%,
          rgba(250,248,245,0.40) 85%,
          rgba(250,248,245,0.60) 100%) !important;
    }
    /* 右上暖色泛光，叠在草甸 wash 之上 */
    body[data-mode="editorial"]::before {
      content: '';
      position: fixed;
      top: -300px; right: -250px;
      width: 900px; height: 900px;
      border-radius: 50%;
      background: radial-gradient(circle,
        rgba(255, 230, 180, 0.45) 0%,
        rgba(255, 230, 180, 0.18) 28%,
        transparent 62%);
      filter: blur(40px);
      pointer-events: none;
      z-index: 0;
    }
    /* 左下苔绿泛光 */
    body[data-mode="editorial"]::after {
      content: '';
      position: fixed;
      bottom: -400px; left: -300px;
      width: 1000px; height: 700px;
      border-radius: 50%;
      background: radial-gradient(ellipse,
        rgba(180, 200, 160, 0.28) 0%,
        rgba(180, 200, 160, 0.08) 30%,
        transparent 65%);
      filter: blur(60px);
      pointer-events: none;
      z-index: 0;
    }
    body[data-mode="editorial"] #root { position: relative; z-index: 1; }
    body[data-mode="editorial"] [data-editorial-serif],
    body[data-mode="editorial"] h1.editorial-serif {
      font-family: 'Cormorant Garamond', 'Source Han Serif SC', 'Songti SC', serif;
    }
  `;
  document.head.appendChild(style);
}

export default function App() {
  // editorial 主题作用域：mount 时给 body 加标记，unmount 时移除
  useEffect(() => {
    document.body.setAttribute('data-mode', 'editorial');
    return () => {
      document.body.removeAttribute('data-mode');
      document.body.removeAttribute('data-page');
    };
  }, []);

  // 每次进入都播一波开屏视频（hero-bg + windweave ribbon + DeskHub 启动）
  const [splashing, setSplashing] = useState(true);

  const [tab, setTab] = useState("dashboard");

  // tab 切换时更新 body[data-page]，触发页面专属背景切换
  useEffect(() => {
    document.body.setAttribute('data-page', tab);
  }, [tab]);

  // PageCardStack 自己处理 tab 切换动画，App 直接 setTab 即可
  // 设置面板（主题切换 + 音频音量）
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [plans, setPlans] = useState(USE_API ? [] : INIT_PLANS);
  const [dims, setDims] = useState(USE_API ? [] : INIT_DIMS);
  const [showDimMgr, setShowDimMgr] = useState(false);
  const [showUserMgr, setShowUserMgr] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  // 登录态: { token, user: { userId, username, role, displayName } }
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const role = auth?.user?.role || 'member';
  const user = auth?.user?.username || '';
  const token = auth?.token || '';

  // 初始化：从 localStorage 恢复登录态
  useEffect(() => {
    if (!USE_API) {
      setAuthLoading(false);
      setAuth({ token: '', user: { userId: 'mock', username: 'admin', role: 'admin', displayName: '管理员' } });
      return;
    }
    const saved = localStorage.getItem(AUTH_KEY);
    if (!saved) { setAuthLoading(false); return; }
    try {
      const { token: savedToken } = JSON.parse(saved);
      if (!savedToken) { setAuthLoading(false); return; }
      // 验证 token
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(json => {
          setAuth({ token: savedToken, user: json.data });
        })
        .catch(() => {
          localStorage.removeItem(AUTH_KEY);
        })
        .finally(() => setAuthLoading(false));
    } catch {
      localStorage.removeItem(AUTH_KEY);
      setAuthLoading(false);
    }
  }, []);

  // 登录成功后加载 plans + dims
  useEffect(() => {
    if (!USE_API || !auth?.token) return;
    let cancelled = false;
    Promise.allSettled([fetchPlans(auth.token), fetchDimensions(auth.token)])
      .then(([plansRes, dimsRes]) => {
        if (cancelled) return;
        if (plansRes.status === "fulfilled" && Array.isArray(plansRes.value)) {
          setPlans(plansRes.value);
        }
        if (dimsRes.status === "fulfilled" && Array.isArray(dimsRes.value)) {
          setDims(dimsRes.value);
        }
      });
    return () => { cancelled = true; };
  }, [auth?.token]);

  const handleLogin = (loginToken, loginUser) => {
    const authData = { token: loginToken, user: loginUser };
    setAuth(authData);
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  };

  const handleLogout = () => {
    if (!window.confirm("确定退出登录吗？")) return;
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuth(null);
    localStorage.removeItem(AUTH_KEY);
    setPlans([]);
    setDims([]);
    setTab("dashboard");
  };

  // 加载中
  if (authLoading) return null;

  // 未登录 → 登录页
  if (USE_API && !auth) return <Login onLogin={handleLogin} />;

  return (
    <>
    {splashing && <LoadingSplash onDone={() => setSplashing(false)} />}

    {/* BG 已由 PageCardStack 内部每个 layer 自带，跟卡片同步运动 */}

    {/* 无 padding、无 gap —— 页面跟 sidebar 直接咬合，让页面铺满 */}
    <div style={{ display: "flex", height: "100vh", background: "transparent", overflow: "hidden" }}>
      <Sidebar
        tab={tab} setTab={setTab}
        role={role}
        user={auth?.user}
        onLogout={handleLogout}
        collapsed={collapsed} setCollapsed={setCollapsed}
        onResetBrowse={() => {}}
        onOpenSettings={() => setShowSettings(true)}
        onOpenDimMgr={role === "admin" ? () => {
          if (tab !== "workbench") setTab("workbench");
          setShowDimMgr(true);
        } : null}
        onOpenUserMgr={role === "admin" ? () => setShowUserMgr(true) : null}
        onOpenChangePwd={() => setShowChangePwd(true)}
      />

      <PageCardStack
        tab={tab}
        pages={{
          dashboard: <PageWrap><Dashboard /></PageWrap>,
          workbench: <PageWrap><WorkBench plans={plans} setPlans={setPlans} role={role} user={user} token={token} dims={dims} setDims={setDims} showDimMgr={showDimMgr} setShowDimMgr={setShowDimMgr} /></PageWrap>,
          mcp: <PageWrap><SpellBook /></PageWrap>,
        }}
      />

      <UserPanel show={showUserMgr} onClose={() => setShowUserMgr(false)} token={token} currentUserId={auth?.user?.userId} />
      <ChangePassword show={showChangePwd} onClose={() => setShowChangePwd(false)} token={token} />
    </div>

    <EditorialSettings show={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}

// 页面内容外壳：保留原有的居中 + padding 布局
function PageWrap({ children }) {
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: `0 ${GAP.xxl}px` }}>
      <div style={{ padding: `${GAP.xxl}px 0 ${GAP.page}px` }}>
        {children}
      </div>
    </div>
  );
}
