'use client'

export default function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs — soft colored blobs */}
      <div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[var(--color-accent)]/12 blur-[100px] animate-pulse"
      />
      <div
        className="absolute -bottom-32 -left-32 w-[450px] h-[450px] rounded-full bg-[var(--color-primary)]/10 blur-[100px] animate-pulse"
        style={{ animationDelay: '2s', animationDuration: '4s' }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-[var(--color-accent)]/6 blur-[80px] animate-pulse"
        style={{ animationDelay: '1s', animationDuration: '5s' }}
      />

      {/* Floating geometric shapes — more visible on white */}
      <svg className="absolute top-16 right-[12%] w-20 h-20 opacity-[0.08] animate-float" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-accent)]" />
      </svg>
      <svg className="absolute bottom-24 left-[8%] w-14 h-14 opacity-[0.06] animate-float-delayed" viewBox="0 0 48 48">
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute top-[35%] right-[6%] w-12 h-12 opacity-[0.05] animate-float" viewBox="0 0 40 40" style={{ animationDelay: '3s' }}>
        <polygon points="20,2 38,38 2,38" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-accent)]" />
      </svg>
      <svg className="absolute bottom-[25%] right-[22%] w-10 h-10 opacity-[0.06] animate-float-delayed" viewBox="0 0 32 32" style={{ animationDelay: '4s' }}>
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute top-[20%] left-[18%] w-8 h-8 opacity-[0.05] animate-float" viewBox="0 0 24 24" style={{ animationDelay: '2s' }}>
        <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-accent)]" />
      </svg>
      {/* Extra dots */}
      <div className="absolute top-[60%] left-[30%] w-3 h-3 rounded-full bg-[var(--color-accent)]/10 animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-[15%] left-[45%] w-2 h-2 rounded-full bg-[var(--color-primary)]/10 animate-float-delayed" style={{ animationDelay: '3.5s' }} />
      <div className="absolute bottom-[15%] right-[35%] w-4 h-4 rounded-full bg-[var(--color-accent)]/8 animate-float" style={{ animationDelay: '5s' }} />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 8s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
