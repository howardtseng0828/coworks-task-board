import { useState } from "react";
import type { FormEvent } from "react";
import appLogo from "../../assets/app-logo.png";

interface LoginScreenProps {
  lineLoginUrl: string;
  error?: string | null;
  onHhtLogin: (userNo: string, password: string) => Promise<void>;
}

export const LoginScreen = ({ lineLoginUrl, error, onHhtLogin }: LoginScreenProps) => {
  const [userNo, setUserNo] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleHhtSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userNo.trim() || !password) {
      return;
    }

    setSubmitting(true);
    try {
      await onHhtLogin(userNo.trim(), password);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-surface via-emerald-50 to-white px-4">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand-accent/40 blur-3xl" />

      <div className="glass-card relative z-10 w-full max-w-lg p-8">
        <img src={appLogo} alt="App Logo" className="mx-auto mb-4 h-16 w-16 rounded-2xl shadow-md" />

        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-deep">Coworks</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-slate-800">登入任務管理平台</h1>
        <p className="mt-2 text-center text-sm text-slate-600">可使用 LINE 或內部帳號登入</p>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <a href={lineLoginUrl} className="btn-primary mt-6 inline-flex h-11 w-full items-center justify-center px-6">
          使用 LINE 登入
        </a>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>或</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleHhtSubmit} className="space-y-3">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600">內部帳號</span>
            <input
              value={userNo}
              onChange={(event) => setUserNo(event.target.value)}
              className="input-base"
              autoComplete="username"
              placeholder="請輸入 內部帳號"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600">密碼</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-base"
              autoComplete="current-password"
              placeholder="請輸入密碼"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !userNo.trim() || !password}
            className="btn-secondary inline-flex h-11 w-full items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "登入中..." : "使用 內部帳號登入"}
          </button>
        </form>
      </div>
    </div>
  );
};
