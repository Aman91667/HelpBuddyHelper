import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Clock, Shield, ArrowRight, Globe, MapPin, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import heroImage from '@/assets/hero-helper.png';
import earnMoneyImage from '@/assets/earn-money.png';
import flexibleScheduleImage from '@/assets/flexible-schedule.png';
import communityImage from '@/assets/community.png';
import logo from '@/assets/logo.png';

/**
 * Responsive landing page with a calm green premium theme.
 * - CTA buttons route to /auth or /auth/helper
 * - Runtime guard to prevent horizontal scrolling (no layout changes)
 */

export default function Index() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 768 : true);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener('resize', onResize);

    // Minimal, non-visual runtime guard to remove horizontal scrolling without changing UI:
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflowX = html.style.overflowX;
    const prevBodyOverflowX = body.style.overflowX;
    const prevHtmlWidth = html.style.width;
    const prevBodyWidth = body.style.width;

    html.style.overflowX = 'hidden';
    body.style.overflowX = 'hidden';
    html.style.width = '100%';
    body.style.width = '100%';

    return () => {
      window.removeEventListener('resize', onResize);
      html.style.overflowX = prevHtmlOverflowX;
      body.style.overflowX = prevBodyOverflowX;
      html.style.width = prevHtmlWidth;
      body.style.width = prevBodyWidth;
    };
  }, []);

  return isMobile ? <MobileLayout navigate={navigate} /> : <DesktopLayout navigate={navigate} />;
}

/* ----------------------------- Small UI pieces ---------------------------- */
function RatingBadge({ rating = 4.8 }: { rating?: number }) {
  return (
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-green-600 text-white rounded-lg px-2.5 py-1.5 shadow-sm">
        <div className="w-5 h-5 rounded-md overflow-hidden bg-white/10 flex items-center justify-center">
          <img src={logo} alt="HelpBudy" className="w-4 h-4 object-contain" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-xs font-semibold">{rating.toFixed(1)}</div>
          <div className="text-[10px] opacity-80">Avg rating</div>
        </div>
      </div>
    </div>
  );
}

function Logo({ size = 40 }: { size?: number }) {
  return <img src={logo} alt="HelpBudy" style={{ width: size, height: size }} className="rounded-md object-contain" />;
}

/* ----------------------------- Mobile layout ----------------------------- */
function MobileLayout({ navigate }: { navigate: (path: string) => void }) {
  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const benefits = [
    { icon: Wallet, title: 'Earn Well', desc: 'Instant payouts after each job.' },
    { icon: Clock, title: 'Flexible Hours', desc: 'Toggle availability anytime.' },
    { icon: Shield, title: 'Verified', desc: 'Aadhaar verification for safety.' },
  ];

  const stats = [
    { value: '10K+', label: 'Helpers' },
    { value: '₹2.5K', label: 'Avg/day' },
    { value: '4.8', label: 'Avg rating' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#e8f6ef] via-[#f3faf6] to-[#e1f3e9] text-gray-800">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-emerald-100 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shadow-sm bg-white">
              <Logo size={36} />
            </div>
            <span className="font-semibold">HelpBudy</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 px-3 py-1"
              onClick={() => navigate('/auth')}
              title="For existing helpers — login with OTP"
            >
              Login
            </Button>
            <Button
              size="sm"
              className="px-3 py-1 rounded-md bg-gradient-to-r from-emerald-400 to-green-600 text-white shadow-sm"
              onClick={() => navigate('/auth/helper?source=landing')}
              title="Register as a new helper — Aadhaar & documents required"
            >
              Become a Helper
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4">
        {/* Hero compact */}
        <section className="flex gap-4 items-center">
          <img src={heroImage} alt="helper" className="w-28 max-w-full h-28 rounded-xl object-cover flex-shrink-0" />
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">Join India's trusted healthcare helpers</h1>
            <p className="text-xs text-gray-600 mt-1">Flexible hours • Instant pay • Verified platform</p>
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1 px-3 py-2 rounded-md bg-gradient-to-r from-emerald-400 to-green-600 text-white font-semibold flex items-center justify-center gap-2"
                onClick={() => navigate('/auth/helper?source=landing')}
                aria-label="Start earning"
              >
                Become a Helper <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-4 flex justify-between gap-2 text-center">
          {stats.map((s, i) => (
            <div key={i} className="flex-1 bg-white/60 rounded-lg p-3 border border-emerald-100">
              {s.label === 'Avg rating' ? (
                <div className="flex items-center justify-center">
                  <RatingBadge rating={parseFloat(s.value)} />
                </div>
              ) : (
                <>
                  <div className="font-bold text-base text-emerald-600">{s.value}</div>
                  <div className="text-xs text-gray-600">{s.label}</div>
                </>
              )}
            </div>
          ))}
        </section>

        {/* Benefits (no horizontal slide) */}
        <section className="mt-5">
          <h2 className="font-semibold mb-2">Why join?</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((b, idx) => {
              const Icon = b.icon as any;
              return (
                <Card key={idx} className="p-3 rounded-2xl border-0 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50">
                      <Icon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-semibold">{b.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{b.desc}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How it works — mobile-first improved layout */}
        <section id="how-it-works" className="mt-6">
          <h3 className="font-semibold mb-3">How it works</h3>

          <div className="space-y-3">
            <motion.div whileTap={{ scale: 0.99 }} className="p-4 rounded-2xl bg-white/90 border border-emerald-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-semibold">1</div>
                <div className="flex-1">
                  <div className="font-semibold">Sign up & Verify</div>
                  <div className="text-sm text-gray-600 mt-1">Create your profile, upload a clear photo and complete secure Aadhaar verification.</div>
                  <ul className="mt-2 text-sm text-gray-600 list-inside list-disc space-y-1">
                    <li>Phone + basic details</li>
                    <li>Upload ID & selfie</li>
                    <li>Quick secure checks</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div whileTap={{ scale: 0.99 }} className="p-4 rounded-2xl bg-white/90 border border-emerald-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-semibold">2</div>
                <div className="flex-1">
                  <div className="font-semibold">Go Online</div>
                  <div className="text-sm text-gray-600 mt-1">Toggle availability to receive nearby requests. Set preferred service types and working radius.</div>
                  <ul className="mt-2 text-sm text-gray-600 list-inside list-disc space-y-1">
                    <li>Set your radius & shift</li>
                    <li>Choose service types</li>
                    <li>Receive instant requests</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            <motion.div whileTap={{ scale: 0.99 }} className="p-4 rounded-2xl bg-white/90 border border-emerald-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-semibold">3</div>
                <div className="flex-1">
                  <div className="font-semibold">Accept & Earn</div>
                  <div className="text-sm text-gray-600 mt-1">Accept a request, navigate safely, help the patient and complete the job to get paid instantly.</div>
                  <ul className="mt-2 text-sm text-gray-600 list-inside list-disc space-y-1">
                    <li>Safe navigation guidance</li>
                    <li>Clear job details</li>
                    <li>Instant transparent payouts</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Typical completion time</div>
                <div className="text-xs text-gray-600">From acceptance to payment</div>
              </div>
              <div className="text-xl font-bold text-emerald-600">25–35 min</div>
            </div>

            <div className="mt-3 h-3 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full w-2/5" />
            </div>

            <div className="mt-3 flex gap-3">
              <Button
                onClick={() => navigate('/auth/helper?source=landing')}
                className="flex-1 px-4 py-3 rounded-md bg-gradient-to-r from-emerald-400 to-green-600 text-white font-semibold"
              >
                Become a Helper
              </Button>
              <Button variant="outline" onClick={scrollToHowItWorks} className="px-4 py-3 rounded-md border-emerald-200">
                Learn more
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Card className="p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <div>
                  <div className="font-semibold">Safety first</div>
                  <div className="text-sm text-gray-600">All helpers are verified; emergency support is available 24/7.</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center">
                  <Logo size={20} />
                </div>
                <div>
                  <div className="font-semibold">Grow your reputation</div>
                  <div className="text-sm text-gray-600">Keep high ratings and get prioritized for premium requests.</div>
                </div>
              </div>
            </Card>

            <Card className="p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 flex items-center justify-center">
                  <Logo size={18} />
                </div>
                <div>
                  <div className="font-semibold">Fast payouts</div>
                  <div className="text-sm text-gray-600">Instant settlement to your bank or UPI after completion.</div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="p-4 text-center text-xs text-gray-600">© 2025 HelpBudy</footer>
    </div>
  );
}

/* ---------------------------- Desktop layout ---------------------------- */
function DesktopLayout({ navigate }: { navigate: (path: string) => void }) {
  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works-desktop');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const benefits = [
    { icon: Wallet, title: 'Instant Payouts', desc: 'Receive payments immediately after every job.', image: earnMoneyImage },
    { icon: Clock, title: 'Total Flexibility', desc: 'Work on your schedule — full-time or side-gig.', image: flexibleScheduleImage },
    { icon: Shield, title: 'Verified & Secure', desc: 'Identity checks to keep helpers and patients safe.', image: communityImage },
    { icon: Globe, title: 'Nationwide Reach', desc: 'Opportunities across India with localized support.' },
  ];

  const stats = [
    { value: '10K+', label: 'Helpers' },
    { value: '₹2.5K', label: 'Avg Daily' },
    { value: '4.8', label: 'Avg rating' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-[#e8f6ef] via-[#f3faf6] to-[#e1f3e9] text-gray-900">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="hidden lg:block absolute -left-40 -top-40 w-96 h-96 rounded-full bg-gradient-to-tr from-[#34d399] to-[#6ee7b7] blur-3xl opacity-30" />
        <div className="hidden lg:block absolute -right-40 bottom-[-120px] w-96 h-96 rounded-full bg-gradient-to-bl from-[#a7f3d0] to-[#10b981] blur-3xl opacity-20" />
      </div>

      <header className="sticky top-0 z-30">
        <div className="container max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md">
              <Logo size={44} />
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight">HelpBudy</div>
              <div className="text-xs text-gray-600 -mt-0.5">Care • Transport • Trust</div>
            </div>
          </div>

          <nav className="flex items-center gap-4">
            <Button variant="ghost" className="text-gray-700 hidden md:inline" onClick={() => navigate('/about')}>About</Button>
            <Button variant="ghost" className="text-gray-700 hidden md:inline" onClick={scrollToHowItWorks}>How it works</Button>
            <Button variant="outline" className="hidden md:inline border-emerald-300 text-emerald-700" onClick={() => navigate('/auth')}>Login</Button>
            <Button className="ml-2 bg-gradient-to-r from-emerald-400 to-green-600 text-white shadow-lg" onClick={() => navigate('/auth/helper')}>Become a Helper</Button>
          </nav>
        </div>
      </header>

      <main className="relative z-20">
        <section className="container max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-medium text-emerald-700">Verified • Instant • Flexible</span>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-gray-900">Empowering Healthcare, <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-green-600">Together</span></h1>

            <p className="mt-6 text-lg text-gray-600 max-w-2xl">Join a trusted community of helpers delivering safe, reliable support to patients. Earn instantly, work flexibly, and grow your reputation.</p>

            <div className="mt-8 flex gap-4">
              <Button className="px-6 py-3 text-base font-semibold rounded-xl bg-gradient-to-r from-emerald-400 to-green-600 text-white shadow-2xl" onClick={() => navigate('/auth/helper')}>Start Earning <ArrowRight className="ml-2 inline-block w-4 h-4" /></Button>
              <Button variant="outline" className="px-6 py-3 rounded-xl border-emerald-300 text-emerald-700" onClick={scrollToHowItWorks}>How it works</Button>
            </div>

            <div className="mt-10 flex gap-4">
              {stats.map((s, idx) => (
                <div key={idx} className="p-4 bg-white/60 backdrop-blur rounded-2xl border border-emerald-100 min-w-[120px]">
                  {s.label === 'Avg rating' ? (
                    <div className="flex items-center justify-center"><RatingBadge rating={parseFloat(s.value)} /></div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-emerald-600">{s.value}</div>
                      <div className="text-xs text-gray-600 mt-1">{s.label}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl border border-emerald-100">
              <img src={heroImage} alt="Happy healthcare helper" className="w-full max-w-full h-[420px] object-cover" />
            </div>

            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} className="absolute -bottom-8 left-6 max-w-[90%] w-72 sm:w-80 md:w-96 rounded-2xl bg-white/80 backdrop-blur border border-emerald-100 p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md">
                  <Logo size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Trusted by 10K+ helpers</div>
                  <div className="text-xs text-gray-600 mt-1">Active across India</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section className="container max-w-7xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900">Why Choose HelpBudy?</h3>
            <p className="text-gray-600 mt-2">Built for helpers — safe, simple, and rewarding.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, idx) => {
              const Icon = b.icon as any;
              return (
                <motion.div key={idx} whileHover={{ y: -6 }} className="rounded-2xl overflow-hidden bg-white/80 border border-emerald-100 shadow-md">
                  <div className="relative h-44">
                    {b.image ? <img src={b.image} alt={b.title} className="w-full max-w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-emerald-100"><Icon className="w-10 h-10 text-emerald-600" /></div>}
                  </div>
                  <div className="p-5">
                    <div className="text-lg font-semibold text-gray-900">{b.title}</div>
                    <div className="text-sm text-gray-600 mt-2">{b.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section id="how-it-works-desktop" className="container max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-gray-900">How It Works — A practical walkthrough</h3>
            <p className="text-gray-600 mt-2">We designed the flow to be fast for you and reliable for patients.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="flex flex-col gap-6">
              <TimelineCard
                step={1}
                title="Sign up & Verify"
                bullets={[
                  'Create profile with phone & Aadhaar',
                  'Upload a clear profile picture',
                  'Complete our secure verification flow',
                ]}
                icon={<MapPin className="w-6 h-6 text-emerald-600" />}
              />

              <TimelineCard
                step={2}
                title="Go online"
                bullets={[
                  'Toggle availability in app',
                  'Set preferred service types & radius',
                  'Receive nearby requests in real-time',
                ]}
                icon={<Clock className="w-6 h-6 text-emerald-600" />}
              />

              <TimelineCard
                step={3}
                title="Accept & Earn"
                bullets={[
                  'Navigate to the pickup safely',
                  'Complete the request professionally',
                  'Get paid instantly — transparent fees',
                ]}
                icon={<Wallet className="w-6 h-6 text-emerald-600" />}
              />
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-full">
                <img src={heroImage} alt="Helper walkthrough" className="rounded-2xl shadow-lg w-full max-w-full h-80 object-cover" />
              </div>

              <div className="mt-6 w-full p-4 bg-white/80 rounded-2xl border border-emerald-100 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Average completion time</div>
                    <div className="text-xs text-gray-600">From acceptance to payment</div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">25–35 min</div>
                </div>

                <div className="mt-4 h-3 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full w-2/5" />
                </div>

                <div className="mt-4 flex gap-3">
                  <Button className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-400 to-green-600 text-white rounded-md" onClick={() => navigate('/auth/helper?source=landing')}>
                    Become a Helper
                  </Button>
                  <Button variant="outline" className="px-4 py-2 rounded-md border-emerald-200" onClick={() => navigate('/how-it-works')}>
                    Learn more
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <Card className="p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                  <div>
                    <div className="font-semibold">Safety first</div>
                    <div className="text-sm text-gray-600 mt-1">All helpers are verified; emergency support is available 24/7.</div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center">
                    <Logo size={20} />
                  </div>
                  <div>
                    <div className="font-semibold">Grow your reputation</div>
                    <div className="text-sm text-gray-600 mt-1">Keep high ratings and get prioritized for premium requests.</div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 rounded-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center">
                    <Logo size={18} />
                  </div>
                  <div>
                    <div className="font-semibold">Fast payouts</div>
                    <div className="text-sm text-gray-600 mt-1">Instant settlement to your bank or UPI after completion.</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <footer className="py-10 border-t border-emerald-100 bg-gradient-to-b from-green-50 to-emerald-50">
          <div className="container max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-600">
            <div>© {new Date().getFullYear()} HelpBudy. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-gray-600 hover:text-emerald-600" onClick={() => navigate('/terms')}>
                Terms
              </Button>
              <Button variant="ghost" className="text-gray-600 hover:text-emerald-600" onClick={() => navigate('/privacy')}>
                Privacy
              </Button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ------------------------- Small UI helper components ------------------------ */
// Removed unused TimelineItem component

function TimelineCard({ step, title, bullets, icon }: { step: number; title: string; bullets: string[]; icon: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white/90 border border-emerald-100 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-sm font-semibold">Step {step} — {title}</div>
          <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
