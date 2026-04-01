'use client'

export default function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Soft gradient orbs — subtle, single color, stationary feel */}
      <div
        className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full blur-[140px]"
        style={{ background: 'var(--color-primary)', opacity: 0.07 }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full blur-[120px]"
        style={{ background: 'var(--color-primary)', opacity: 0.05 }}
      />

      {/* Random diagonal lines — more visible, varied directions */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <line x1="0%" y1="15%" x2="40%" y2="0%" stroke="var(--color-primary)" strokeWidth="1" opacity="0.08" />
        <line x1="55%" y1="0%" x2="100%" y2="35%" stroke="var(--color-primary)" strokeWidth="1" opacity="0.07" />
        <line x1="5%" y1="100%" x2="45%" y2="55%" stroke="var(--color-primary)" strokeWidth="1" opacity="0.06" />
        <line x1="70%" y1="100%" x2="100%" y2="65%" stroke="var(--color-primary)" strokeWidth="1" opacity="0.07" />
        <line x1="20%" y1="0%" x2="0%" y2="50%" stroke="var(--color-primary)" strokeWidth="1" opacity="0.06" />
        <line x1="85%" y1="0%" x2="50%" y2="100%" stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.05" />
        <line x1="100%" y1="10%" x2="60%" y2="80%" stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.05" />
        <line x1="35%" y1="0%" x2="75%" y2="50%" stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.04" />
        <line x1="0%" y1="80%" x2="25%" y2="100%" stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.06" />
        <line x1="90%" y1="100%" x2="100%" y2="85%" stroke="var(--color-primary)" strokeWidth="0.75" opacity="0.05" />
      </svg>

      {/* Floating geometric shapes — single color */}
      <svg className="absolute top-16 right-[12%] w-20 h-20 opacity-[0.10] animate-float" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute bottom-24 left-[8%] w-14 h-14 opacity-[0.08] animate-float-delayed" viewBox="0 0 48 48">
        <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute top-[35%] right-[6%] w-12 h-12 opacity-[0.07] animate-float" viewBox="0 0 40 40" style={{ animationDelay: '3s' }}>
        <polygon points="20,2 38,38 2,38" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute bottom-[25%] right-[22%] w-10 h-10 opacity-[0.08] animate-float-delayed" viewBox="0 0 32 32" style={{ animationDelay: '4s' }}>
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>
      <svg className="absolute top-[20%] left-[18%] w-8 h-8 opacity-[0.06] animate-float" viewBox="0 0 24 24" style={{ animationDelay: '2s' }}>
        <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-[var(--color-primary)]" />
      </svg>

      {/* Dots */}
      <div className="absolute top-[60%] left-[30%] w-3 h-3 rounded-full animate-float" style={{ background: 'var(--color-primary)', opacity: 0.10, animationDelay: '1.5s' }} />
      <div className="absolute top-[15%] left-[45%] w-2 h-2 rounded-full animate-float-delayed" style={{ background: 'var(--color-primary)', opacity: 0.10, animationDelay: '3.5s' }} />
      <div className="absolute bottom-[15%] right-[35%] w-4 h-4 rounded-full animate-float" style={{ background: 'var(--color-primary)', opacity: 0.08, animationDelay: '5s' }} />

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
