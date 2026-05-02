import { Dialog, Transition } from "@headlessui/react";
import {
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  LightBulbIcon,
  Squares2X2Icon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Fragment } from "react";
import appLogo from "../../assets/app-logo.png";
import type { NavigationMenu } from "../../store/uiStore";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  activeMenu: NavigationMenu;
  onSelectMenu: (menu: NavigationMenu) => void;
  onCloseMobile: () => void;
}

const feedbackUrl = import.meta.env.VITE_FEEDBACK_URL ?? "https://line.me/ti/p/4chU6Pb1iJ";
const officialSiteUrl = import.meta.env.VITE_OFFICIAL_SITE_URL ?? "https://line.me/ti/p/4chU6Pb1iJ";
const supportUrl = import.meta.env.VITE_SUPPORT_URL ?? "https://line.me/ti/p/4chU6Pb1iJ";

const menuItems: Array<{
  id: NavigationMenu;
  label: string;
  icon: typeof Squares2X2Icon;
  comingSoon?: boolean;
}> = [
  { id: "groups", label: "群組清單", icon: Squares2X2Icon },
  { id: "members", label: "人員管理", icon: UserGroupIcon },
  { id: "tasks", label: "任務清單", icon: ClipboardDocumentListIcon }
];

const footerItems = [
  {
    id: "suggest",
    label: "需求建議",
    icon: LightBulbIcon,
    href: feedbackUrl,
    hint: "連到建議表單或信箱"
  },
  {
    id: "website",
    label: "瀏覽官網",
    icon: BookOpenIcon,
    href: officialSiteUrl,
    hint: "連到官網或文件中心"
  },
  {
    id: "support",
    label: "聯絡客服",
    icon: ChatBubbleLeftRightIcon,
    href: supportUrl,
    hint: "連到 LINE OA 或客服信箱"
  }
];

interface SidebarContentProps {
  collapsed: boolean;
  activeMenu: NavigationMenu;
  onSelectMenu: (menu: NavigationMenu) => void;
  mobile?: boolean;
  onCloseMobile?: () => void;
}

const SidebarContent = ({
  collapsed,
  activeMenu,
  onSelectMenu,
  mobile = false,
  onCloseMobile
}: SidebarContentProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/60 px-4 py-5">
        <img src={appLogo} alt="App Logo" className="h-10 w-10 rounded-xl shadow-md" />
        {!collapsed ? (
          <div>
            <p className="text-sm font-semibold text-slate-500">HHT</p>
            <p className="text-lg font-bold text-brand-deep">Coworks</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.comingSoon) {
                return;
              }

              onSelectMenu(item.id);
              if (mobile) {
                onCloseMobile?.();
              }
            }}
            className={clsx(
              "flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
              item.id === activeMenu
                ? "bg-emerald-100 text-brand-deep shadow-sm"
                : item.comingSoon
                  ? "bg-slate-50/70 text-slate-400"
                  : "text-slate-600 hover:bg-white/80 hover:text-brand-deep",
              collapsed && !mobile ? "justify-center" : "gap-3"
            )}
            disabled={item.comingSoon}
            aria-disabled={item.comingSoon ? true : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed || mobile ? (
              <span className="flex items-center gap-1.5">
                {item.label}
                {item.comingSoon ? (
                  <span className="text-[11px] font-semibold text-slate-400">(待開發)</span>
                ) : null}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/60 px-3 py-4">
        {footerItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            title={item.hint}
            onClick={mobile ? onCloseMobile : undefined}
            className={clsx(
              "flex w-full items-center rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors duration-200 hover:bg-white/70 hover:text-slate-700 cursor-pointer",
              collapsed && !mobile ? "justify-center" : "gap-3"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed || mobile ? <span>{item.label}</span> : null}
          </a>
        ))}
      </div>
    </div>
  );
};

export const Sidebar = ({
  collapsed,
  mobileOpen,
  activeMenu,
  onSelectMenu,
  onCloseMobile
}: SidebarProps) => {
  return (
    <>
      <aside
        className={clsx(
          "hidden border-r border-white/60 bg-white/70 backdrop-blur-lg transition-all duration-300 lg:flex lg:flex-col",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} activeMenu={activeMenu} onSelectMenu={onSelectMenu} />
      </aside>

      <Transition show={mobileOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40 lg:hidden" onClose={onCloseMobile}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition-transform duration-300 ease-out"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition-transform duration-200 ease-in"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="w-72 border-r border-white/60 bg-white/85 shadow-xl backdrop-blur-lg">
                <SidebarContent
                  collapsed={false}
                  activeMenu={activeMenu}
                  onSelectMenu={onSelectMenu}
                  mobile
                  onCloseMobile={onCloseMobile}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};
