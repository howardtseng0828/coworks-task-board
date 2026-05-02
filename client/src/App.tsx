import { useMemo } from "react";
import { LoginScreen } from "./components/auth/LoginScreen";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { useAuth } from "./hooks/useAuth";
import { useNotifications } from "./hooks/useNotifications";
import { GroupListPage } from "./pages/GroupListPage";
import { MembersPage } from "./pages/MembersPage";
import { TaskListPage } from "./pages/TaskListPage";
import { authService } from "./services/authService";
import { useUiStore } from "./store/uiStore";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const authErrorMessages: Record<string, string> = {
  invalid_oauth_state: "LINE 登入狀態驗證失敗，請重新登入後再試一次。",
  line_already_linked: "這個 LINE 帳號已經綁定其他使用者。",
  link_user_not_found: "找不到要綁定的使用者資料。",
  invalid_link_session: "LINE 綁定流程已失效，請重新操作。",
  line_link_failed: "LINE 綁定失敗，請稍後再試。"
};

function App() {
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    activeMenu,
    toggleSidebar,
    openMobileSidebar,
    closeMobileSidebar,
    selectTask,
    setActiveMenu
  } = useUiStore();

  const { user, loading, error, loginWithHht, linkInternal, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    reload: reloadNotifications
  } = useNotifications(Boolean(user));

  const authError = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("authError");
    if (!raw) {
      return null;
    }
    return authErrorMessages[raw] ?? `LINE 登入失敗：${raw}`;
  }, []);

  const lineLoginUrl = useMemo(() => authService.getLineLoginUrl(window.location.href), []);
  const lineLinkUrl = useMemo(
    () => (user?.internalUserNo ? authService.getLineLinkUrl(window.location.href) : null),
    [user?.internalUserNo]
  );

  const handleMenuClick = () => {
    if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      toggleSidebar();
    } else {
      openMobileSidebar();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-surface text-slate-600">
        載入中...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        lineLoginUrl={lineLoginUrl}
        error={authError ?? error}
        onHhtLogin={async (userNo, password) => {
          await loginWithHht(userNo, password);
        }}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-brand-surface via-emerald-50 to-white">
      <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand-accent/40 blur-3xl" />

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        activeMenu={activeMenu}
        onSelectMenu={setActiveMenu}
        onCloseMobile={closeMobileSidebar}
      />

      <div className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col">
        <Header
          user={user}
          notifications={notifications}
          unreadCount={unreadCount}
          notificationsLoading={notificationsLoading}
          lineLinkUrl={lineLinkUrl}
          onMenuClick={handleMenuClick}
          onLogout={() => void logout()}
          onOpenTaskFromNotification={(taskId) => {
            setActiveMenu("tasks");
            selectTask(taskId);
          }}
          onMarkNotificationRead={(notificationId) => void markAsRead(notificationId)}
          onMarkAllNotificationsRead={() => void markAllAsRead()}
          onReloadNotifications={() => void reloadNotifications()}
          onLinkInternal={async (userNo, password) => {
            await linkInternal(userNo, password);
          }}
        />

        <main className="min-w-0 flex-1 px-3 pb-6 pt-4 sm:px-6 lg:px-8">
          {activeMenu === "members" ? <MembersPage currentUser={user} /> : null}
          {activeMenu === "groups" ? <GroupListPage currentUser={user} /> : null}
          {activeMenu === "tasks" ? <TaskListPage currentUser={user} /> : null}
        </main>
      </div>
    </div>
  );
}

export default App;
