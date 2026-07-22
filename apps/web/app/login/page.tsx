'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

const QUOTES = [
  ['Beware of little expenses; a small leak will sink a great ship.', 'Benjamin Franklin'],
  ['Accounting is the language of business.', 'Warren Buffett'],
  ['An investment in knowledge pays the best interest.', 'Benjamin Franklin'],
  ['Numbers have an important story to tell. They rely on you to give them a voice.', 'Stephen Few'],
  ['Revenue is vanity, profit is sanity, but cash is king.', 'Business proverb'],
  ['Behind every good business is a great set of books.', 'GNS Associates'],
  ['Balance is not something you find, it is something you create.', 'Unknown'],
  ['The hardest thing in the world to understand is the income tax.', 'Albert Einstein'],
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type View = 'login' | 'forgot' | '2fa' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const resetToken = params.get('token');

  const [lit, setLit] = useState(!!resetToken);
  const [view, setView] = useState<View>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgotEmail, setForgotEmail] = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [userId2fa, setUserId2fa] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [quoteFade, setQuoteFade] = useState(true);
  const [quotes] = useState(() => shuffled(QUOTES));

  useEffect(() => {
    const iv = setInterval(() => {
      setQuoteFade(false);
      setTimeout(() => {
        setQuoteIdx((i) => (i + 1) % quotes.length);
        setQuoteFade(true);
      }, 280);
    }, 5200);
    return () => clearInterval(iv);
  }, [quotes]);

  const toggle = useCallback(() => setLit((l) => !l), []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });
      const j = await r.json();
      if (j.requires2FA) {
        setUserId2fa(j.userId);
        setView('2fa');
        setMsg({ text: 'A verification code has been sent to your email.', ok: true });
      } else if (r.ok) {
        router.push(j.redirect || '/dashboard');
      } else {
        setMsg({ text: j.message || 'Sign-in failed.', ok: false });
      }
    } catch { setMsg({ text: 'Network error. Please try again.', ok: false }); }
    setLoading(false);
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId2fa, code: code2fa, remember }),
      });
      const j = await r.json();
      if (r.ok) {
        router.push(j.redirect || '/dashboard');
      } else {
        setMsg({ text: j.message || 'Invalid code.', ok: false });
      }
    } catch { setMsg({ text: 'Network error. Please try again.', ok: false }); }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setMsg({ text: 'Enter your email first.', ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const j = await r.json();
      setMsg({ text: j.message || 'If that email exists, a reset link has been sent.', ok: true });
    } catch { setMsg({ text: 'Network error.', ok: false }); }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setMsg({ text: 'Passwords do not match.', ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPw }),
      });
      const j = await r.json();
      if (r.ok) {
        setMsg({ text: 'Password updated. Redirecting to sign in...', ok: true });
        setTimeout(() => { setView('login'); router.push('/login'); }, 1500);
      } else {
        setMsg({ text: j.message || 'Could not reset the password.', ok: false });
      }
    } catch { setMsg({ text: 'Network error.', ok: false }); }
    setLoading(false);
  };

  return (
    <div className={`login-root ${lit ? 'lit' : ''}`}>
      <div className="login-stage">
        {/* Left: Lamp column */}
        <div className="lamp-col">
          <div
            className="lamp"
            role="button"
            tabIndex={0}
            aria-label="Toggle the lamp"
            onClick={toggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
          >
            <span className="glow" />
            <span className="shade" />
            <span className="bulb" />
            <span className="stem" />
            <span className="lamp-base" />
            <span className="cord"><span className="bead" /></span>
          </div>
          <div className="hint">
            {lit ? 'Light on — pull again to switch off' : 'Pull the cord to sign in ↑'}
          </div>
          <div className="quote" style={{ opacity: quoteFade ? 1 : 0 }}>
            <p>&ldquo;{quotes[quoteIdx][0]}&rdquo;</p>
            <span>&mdash; {quotes[quoteIdx][1]}</span>
          </div>
        </div>

        {/* Right: Card */}
        <div className={`card ${lit ? 'visible' : ''}`}>
          <div className="card-inner">
            {/* Logo */}
            <div className="logo-wrap">
              <Image
                src="/logos/gns.png"
                alt="GNS Chartered Accountants"
                width={160}
                height={56}
                className="logo-img"
                priority
              />
            </div>

            {/* Title */}
            <h1 className="card-title">
              {view === 'reset' ? 'Set a new password' :
               view === '2fa' ? 'Verify your identity' :
               view === 'forgot' ? 'Reset your password' :
               'Welcome back'}
            </h1>
            <p className="card-sub">
              {view === 'reset' ? 'Choose a new password for your account.' :
               view === '2fa' ? 'Enter the 6-digit code sent to your email.' :
               view === 'forgot' ? 'We\'ll send a reset link to your email.' :
               'Sign in to GNS Compliance Manager'}
            </p>

            {/* Login form */}
            {view === 'login' && (
              <form onSubmit={handleLogin} autoComplete="on">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@gnsassociates.co.uk"
                />
                <label>Password</label>
                <div className="pw-wrap">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="row-check">
                  <input type="checkbox" id="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <label htmlFor="remember">Remember me for 20 days</label>
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <div className="links">
                  <button type="button" className="link-btn" onClick={() => { setView('forgot'); setMsg(null); }}>
                    Forgot password?
                  </button>
                </div>
              </form>
            )}

            {/* Forgot password */}
            {view === 'forgot' && (
              <div>
                <label>Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="you@gnsassociates.co.uk"
                />
                <button className="btn-primary" onClick={handleForgot} disabled={loading}>
                  {loading ? 'Sending...' : 'Email me a reset link'}
                </button>
                <div className="links">
                  <button type="button" className="link-btn" onClick={() => { setView('login'); setMsg(null); }}>
                    Back to sign in
                  </button>
                </div>
              </div>
            )}

            {/* 2FA verification */}
            {view === '2fa' && (
              <form onSubmit={handleVerify2FA} autoComplete="off">
                <label>Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code2fa}
                  onChange={(e) => setCode2fa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  placeholder="000000"
                  className="code-input"
                  autoFocus
                />
                <button className="btn-primary" type="submit" disabled={loading || code2fa.length < 6}>
                  {loading ? 'Verifying...' : 'Verify & sign in'}
                </button>
                <div className="links">
                  <button type="button" className="link-btn" onClick={() => { setView('login'); setMsg(null); }}>
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {/* Reset password */}
            {view === 'reset' && (
              <form onSubmit={handleReset} autoComplete="on">
                <label>New password</label>
                <div className="pw-wrap">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? 'Hide' : 'Show'}
                  </button>
                </div>
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            )}

            {/* Message */}
            {msg && (
              <div className={`msg ${msg.ok ? 'msg-ok' : 'msg-err'}`}>
                {msg.text}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-root {
          margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px;
          color: #efeafc;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          background: radial-gradient(1200px 700px at 22% 34%, #3a2e63 0%, #241a44 46%, #140f28 100%);
          transition: background 700ms ease;
        }
        .login-root.lit {
          background: radial-gradient(1100px 680px at 22% 34%, #5a4494 0%, #372c5f 44%, #191134 100%);
        }

        .login-stage {
          display: grid; grid-template-columns: 1fr min(440px, 100%); gap: 48px;
          align-items: center; width: 100%; max-width: 1080px;
        }
        @media (max-width: 900px) {
          .login-stage { grid-template-columns: 1fr; gap: 24px; }
          .lamp-col { order: 2; }
        }

        /* ── Lamp ──────────────────────────────────────────── */
        .lamp-col { display: flex; flex-direction: column; align-items: flex-start; padding-left: clamp(8px, 6vw, 96px); }
        .lamp { position: relative; width: 260px; height: 340px; cursor: pointer; user-select: none; }
        .glow {
          position: absolute; left: 50%; top: 120px; width: 520px; height: 520px;
          transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none;
          opacity: 0; transition: opacity 600ms ease;
          background: radial-gradient(circle, rgba(255,220,150,0.55) 0%, rgba(255,210,140,0.22) 30%, rgba(255,200,120,0) 62%);
        }
        .login-root.lit .glow { opacity: 1; }
        .shade {
          position: absolute; left: 50%; top: 36px; transform: translateX(-50%);
          width: 170px; height: 78px; border-radius: 14px 14px 46px 46px;
          background: linear-gradient(180deg, #3a2f5c, #2a2044);
          box-shadow: inset 0 -10px 20px rgba(0,0,0,0.4);
          transition: background 500ms ease, box-shadow 500ms ease;
        }
        .login-root.lit .shade {
          background: linear-gradient(180deg, #efe0ff, #cbb6f2);
          box-shadow: inset 0 -12px 26px rgba(255,225,160,0.55);
        }
        .bulb {
          position: absolute; left: 50%; top: 104px; transform: translateX(-50%);
          width: 70px; height: 26px; border-radius: 0 0 40px 40px;
          background: #251c40; transition: background 500ms ease, box-shadow 500ms ease;
        }
        .login-root.lit .bulb {
          background: #ffe6b0;
          box-shadow: 0 10px 40px 8px rgba(255,220,150,0.7);
        }
        .stem {
          position: absolute; left: 50%; top: 118px; transform: translateX(-50%);
          width: 9px; height: 168px; border-radius: 5px;
          background: linear-gradient(90deg, #2a2044, #4a3f6e, #2a2044);
        }
        .lamp-base {
          position: absolute; left: 50%; top: 282px; transform: translateX(-50%);
          width: 150px; height: 26px; border-radius: 50%;
          background: linear-gradient(180deg, #4a3f6e, #241b40);
          box-shadow: 0 14px 26px rgba(0,0,0,0.45);
        }
        .cord {
          position: absolute; left: calc(50% + 66px); top: 96px;
          width: 2px; height: 52px; background: rgba(220,210,255,0.6);
          transform-origin: top center;
        }
        .cord .bead {
          position: absolute; left: -5px; bottom: -10px; width: 12px; height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fff6d8, #d9b96a);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        }
        .lamp:active .cord { animation: tug 260ms ease; }
        @keyframes tug {
          0%, 100% { transform: rotate(0) scaleY(1); }
          40% { transform: rotate(2deg) scaleY(1.14); }
        }
        .hint {
          margin-top: 8px; font-size: 0.92rem; font-weight: 700; color: #e9def9;
          letter-spacing: 0.03em;
        }
        .login-root:not(.lit) .hint { animation: hintpulse 1.8s ease-in-out infinite; }
        .login-root.lit .hint { opacity: 0.5; font-weight: 600; font-size: 0.8rem; }
        @keyframes hintpulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

        /* ── Quote ─────────────────────────────────────────── */
        .quote {
          margin-top: 26px; max-width: 340px; text-align: center; min-height: 74px;
          transition: opacity 500ms ease;
        }
        .quote p { margin: 0; font-size: 1.02rem; line-height: 1.5; font-style: italic; color: #efeafd; }
        .quote span { display: block; margin-top: 8px; font-size: 0.82rem; font-weight: 700; color: #c3b6e6; font-style: normal; }

        /* ── Card ──────────────────────────────────────────── */
        .card {
          position: relative; width: 100%;
          opacity: 0; visibility: hidden; transform: translateY(18px) scale(0.98);
          pointer-events: none;
          transition: opacity 640ms ease, transform 640ms ease, visibility 0s linear 640ms;
        }
        .card.visible {
          opacity: 1; visibility: visible; transform: none; pointer-events: auto;
          transition: opacity 640ms ease, transform 640ms ease, visibility 0s;
        }
        .card-inner {
          background: rgba(255,255,255,0.97); color: #2a2342;
          border: 1px solid rgba(140,115,190,0.26); border-radius: 24px;
          padding: 36px 32px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.4);
          backdrop-filter: blur(20px);
        }
        .login-root.lit .card-inner {
          box-shadow: 0 30px 90px rgba(255,210,140,0.18), 0 20px 60px rgba(0,0,0,0.4);
        }

        .logo-wrap { text-align: center; margin-bottom: 20px; }
        .logo-img { height: 52px; width: auto; margin: 0 auto; }

        .card-title {
          margin: 0 0 4px; font-size: 1.5rem; text-align: center; font-weight: 800;
          background: linear-gradient(120deg, #6d5be0, #8b5cf6 55%, #c026a8);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .card-sub {
          margin: 0 0 22px; text-align: center; color: #7a7296; font-size: 0.92rem;
        }

        label {
          display: block; font-size: 0.82rem; font-weight: 700; margin: 14px 0 6px; color: #2a2342;
        }
        input[type=email], input[type=password], input[type=text] {
          width: 100%; min-height: 48px; padding: 0 14px;
          border: 1.5px solid rgba(140,115,190,0.26); border-radius: 12px;
          background: #faf8ff; font: inherit; color: #2a2342;
          font-size: 0.95rem; transition: border-color 200ms, box-shadow 200ms;
        }
        input:focus {
          outline: none; border-color: #a78bfa;
          box-shadow: 0 0 0 3px rgba(139,91,224,0.15);
        }
        input::placeholder { color: #b0a6c4; }

        .code-input {
          font-size: 1.8rem !important; letter-spacing: 10px; text-align: center;
          font-weight: 800; font-variant-numeric: tabular-nums;
        }

        .pw-wrap { position: relative; }
        .pw-wrap input { padding-right: 66px; }
        .pw-toggle {
          position: absolute; top: 0; right: 0; height: 48px; padding: 0 14px; border: 0;
          background: transparent; color: #8b5cf6; font-weight: 700; font-size: 0.82rem;
          cursor: pointer;
        }
        .pw-toggle:hover { text-decoration: underline; }

        .row-check {
          display: flex; align-items: center; gap: 8px; margin: 14px 0 4px;
          font-size: 0.88rem; color: #7a7296;
        }
        .row-check input { width: 16px; height: 16px; accent-color: #8b5cf6; }
        .row-check label { margin: 0; font-weight: 500; }

        .btn-primary {
          width: 100%; min-height: 50px; margin-top: 18px; border: 0; border-radius: 12px;
          color: #fff; font-weight: 800; font-size: 1rem; cursor: pointer;
          background: linear-gradient(135deg, #6d5be0, #8b5cf6, #c026a8);
          transition: opacity 200ms, transform 100ms;
          box-shadow: 0 4px 16px rgba(109,91,224,0.3);
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .links { display: flex; justify-content: center; margin-top: 16px; }
        .link-btn {
          color: #8b5cf6; background: none; border: none; font-size: 0.85rem;
          cursor: pointer; text-decoration: none; font-weight: 600;
        }
        .link-btn:hover { text-decoration: underline; }

        .msg {
          margin-top: 14px; padding: 12px 14px; border-radius: 12px; font-size: 0.88rem;
          text-align: center; font-weight: 500;
        }
        .msg-err { background: #ffe0ea; color: #9c1b46; }
        .msg-ok { background: #e7f6ec; color: #1c6b34; }
      `}</style>
    </div>
  );
}
