export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f8fc_0%,#f1f4fb_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,87,200,0.14),transparent_24rem),radial-gradient(circle_at_82%_18%,rgba(77,118,229,0.12),transparent_18rem),radial-gradient(circle_at_bottom_right,rgba(91,181,232,0.12),transparent_24rem)]" />
      <div className="absolute left-[-6rem] top-20 h-64 w-64 rounded-full bg-[#6a5de0]/12 blur-3xl" />
      <div className="absolute bottom-[-4rem] right-[-3rem] h-72 w-72 rounded-full bg-[#5bb3e8]/14 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,#5e58ca_0%,#4e68da_48%,#4d78eb_100%)] p-2 shadow-[0_42px_90px_-30px_rgba(66,49,160,0.38)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative isolate min-h-[300px] overflow-hidden rounded-[1.6rem] px-8 py-10 text-white sm:px-10 sm:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_20rem)]" />
            <div className="absolute inset-y-0 left-[-10%] w-[72%] rounded-[50%] bg-[radial-gradient(circle_at_35%_35%,rgba(91,179,232,0.95),rgba(70,111,223,0.92)_55%,rgba(84,64,194,0.76)_100%)] opacity-95 blur-[2px]" />
            <div className="absolute left-[28%] top-[4%] h-36 w-52 rounded-[48%] bg-[linear-gradient(135deg,rgba(91,179,232,0.6),rgba(110,81,220,0.22))]" />
            <div className="absolute bottom-[14%] left-[10%] h-40 w-60 rounded-[48%] bg-[linear-gradient(135deg,rgba(88,147,235,0.82),rgba(90,66,201,0.34))]" />
            <div className="absolute bottom-[6%] right-[18%] h-28 w-40 rounded-[48%] bg-[linear-gradient(135deg,rgba(91,179,232,0.46),rgba(110,81,220,0.18))]" />

            <div className="relative z-10 flex h-full flex-col justify-center">
              <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80 backdrop-blur">
                Work Tracking Suite
              </div>
              <h1 className="mt-8 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white sm:text-[2.35rem]">
                Seamless team management with sharper operational visibility.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/82 sm:text-base">
                Sign in to manage projects, monitor execution, and keep every update aligned from one professional workspace.
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center rounded-[1.6rem] bg-white/12 p-4 sm:p-5 lg:p-6">
            <div className="w-full max-w-md rounded-[1.6rem] bg-white px-6 py-7 text-slate-900 shadow-[0_28px_60px_-32px_rgba(15,23,42,0.22)] sm:px-8 sm:py-8">
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
