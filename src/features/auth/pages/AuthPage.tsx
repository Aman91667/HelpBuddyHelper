import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Phone,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import logo from '@/assets/logo.png';

type Step = 'phone' | 'otp';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, updateHelper, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('phone');
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState(''); // store unformatted digits (10 digits max)
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [helperNeedsOnboarding, setHelperNeedsOnboarding] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendIn, setResendIn] = useState<number>(0);
  const canResend = resendIn === 0;
  const [invalidOtp, setInvalidOtp] = useState(false);

  // Format +91 UI while storing digits
  const prettyPhone = useMemo(() => {
    const p = phone.replace(/\D/g, '').slice(0, 10);
    if (!p) return '';
    if (p.length <= 5) return `+91 ${p}`;
    return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  }, [phone]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Validation
  const validateDetails = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Please enter your full name.';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) errs.phone = 'Enter a valid 10-digit mobile number.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // API: send OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setIsLoading(true);
    try {
      // First check whether this phone belongs to an existing helper.
      const phoneDigits = phone.replace(/\D/g, '');
      const existsResp = await apiClient.checkHelperExists(phoneDigits);

      // Store whether helper needs onboarding for later (after OTP)
      let needsOnboarding = false;
      if (existsResp?.success) {
        const exists = (existsResp as any)?.data?.exists;
        if (!exists) {
          needsOnboarding = true;
          toast({ title: 'New helper registration', description: 'Please verify your phone number, then complete your profile.' });
        }
      } else {
        // If check failed, be conservative and block OTP (user requested behavior: only OTP for existing helpers)
        toast({ variant: 'destructive', title: 'Unable to verify helper status', description: existsResp?.error || 'Please try again later.' });
        return;
      }
      
      // Store for use after OTP verification
      setHelperNeedsOnboarding(needsOnboarding);

      // Phone belongs to an existing helper, now request OTP
      const data = await apiClient.requestOtp('phone', phoneDigits, name.trim());
      if (data?.success) {
        setStep('otp');
        setResendIn(30);
        toast({ title: 'OTP sent', description: 'Please check your phone for the code.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'Failed to send OTP' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // API: resend OTP
  const handleResend = async () => {
    if (!canResend) return;
    setIsLoading(true);
    try {
      const data = await apiClient.requestOtp('phone', phone.replace(/\D/g, ''), name.trim());
      if (data?.success) {
        setResendIn(30);
        toast({ title: 'OTP resent', description: 'A new code has been sent to your phone.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'Could not resend OTP' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // API: verify OTP
  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== 6) {
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Enter the 6-digit OTP.' });
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiClient.verifyOtp('phone', phone.replace(/\D/g, ''), code, name.trim(), 'HELPER');
      if (data?.success && data?.data) {
        // clear any invalid otp marker
        if (invalidOtp) setInvalidOtp(false);
        const tokens = data.data as { accessToken: string; refreshToken: string };
        await login(tokens.accessToken, tokens.refreshToken);
        const me = await apiClient.getHelperProfile();
        if (me?.success && me?.data) {
          try { updateHelper(me.data as any); } catch {}
          toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
        } else {
          toast({ title: 'Logged in', description: 'Proceeding to complete your profile.' });
        }
        
        // If this is a new helper who needs onboarding, send them to the onboarding page
        if (helperNeedsOnboarding) {
          navigate('/auth/helper', { state: { prefill: { name: name.trim(), phone: phone } } });
        } else {
          // Existing helpers go to dashboard
          navigate('/dashboard');
        }
      } else {
        // mark invalid code so UI can show inline error when a full 6-digit code was attempted
        setInvalidOtp(true);
        toast({ variant: 'destructive', title: 'Invalid OTP', description: data?.error || 'Check the code and try again.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-background via-primary/5 to-background relative overflow-hidden">
      {/* Floating ambient glows */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-primary/15 to-success/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-gradient-to-bl from-secondary/15 to-primary/10 blur-3xl" />

      {/* MOBILE HERO (only show on small screens) */}
      <div className="lg:hidden px-6 pt-8 pb-4 text-center">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="inline-block"
        >
          <div className="rounded-2xl p-1 bg-gradient-primary inline-block shadow-premium">
            <div className="bg-card/95 rounded-xl p-4 w-24 h-24 flex items-center justify-center">
              <img src={logo} alt="HelpBudy" className="w-16 h-16 object-contain" />
            </div>
          </div>
        </motion.div>

        <h1 className="mt-4 text-2xl font-extrabold">Welcome to HelpBudy</h1>
        <p className="mt-2 text-sm text-muted-foreground px-6">Fast login with OTP — secure, verified, easy.</p>

        {/* quick mobile highlights (stacked) */}
        <div className="mt-4 flex gap-3 justify-center px-4">
          <div className="rounded-xl bg-card/80 px-3 py-2 text-xs text-muted-foreground">Verified</div>
          <div className="rounded-xl bg-card/80 px-3 py-2 text-xs text-muted-foreground">Secure</div>
          <div className="rounded-xl bg-card/80 px-3 py-2 text-xs text-muted-foreground">Instant</div>
        </div>
      </div>

      {/* LEFT: Brand hero (desktop) */}
      <div className="relative hidden lg:flex items-center justify-center p-10">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <motion.div
              initial={{ rotate: -2, scale: 0.98 }}
              animate={{ rotate: [-2, 2, -2], scale: [0.98, 1.02, 0.98] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block relative"
            >
              <div className="rounded-3xl p-1 bg-gradient-to-tr from-primary to-success shadow-premium">
                <div className="rounded-2xl bg-card/95 border border-border/40 p-5 w-28 h-28 flex items-center justify-center">
                  <img src={logo} alt="HelpBudy" className="w-20 h-20 object-contain" />
                </div>
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary" />
            </motion.div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight">
              Care that moves at your pace
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Sign in securely. Work flexibly. Get paid instantly.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3 text-left">
              <FeatureItem icon={<ShieldCheck className="w-4 h-4" />} title="Verified" desc="Aadhaar & identity checks" />
              <FeatureItem icon={<LockKeyhole className="w-4 h-4" />} title="Secure" desc="Bank-grade encryption" />
              <FeatureItem icon={<CheckCircle2 className="w-4 h-4" />} title="Instant" desc="Near-real-time OTP" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT: Auth card */}
      <div className="flex items-center justify-center p-4 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <Card className="rounded-2xl bg-card/90 backdrop-blur-xl border border-border/40 shadow-glow overflow-hidden">
            {/* Top bar with stepper (unchanged for desktop) */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-success/5">
              {/* intentionally empty left slot to preserve desktop layout */}
              <div className="w-4" />
              <Stepper step={step} />
            </div>

            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {step === 'phone' ? (
                  <motion.form
                    key="step-phone"
                    onSubmit={handleRequestOtp}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Welcome to HelpBudy</h2>
                      <p className="text-sm text-muted-foreground mt-1">Enter your details to get started</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Aman Jain"
                        className={`h-14 rounded-xl text-base ${errors.name ? 'ring-2 ring-destructive/30' : ''}`} // larger on mobile
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                      />
                      {errors.name && <p id="name-error" className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    {/* ---------- Updated Phone Input Block (fixed +91 prefix, editable digits) ---------- */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        {/* phone icon */}
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />

                        {/* fixed +91 prefix */}
                        <span
                          aria-hidden
                          className="absolute left-11 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground/80"
                        >
                          +91
                        </span>

                        {/* input holds only the digits (no +91) so user can edit freely */}
                        <Input
                          id="phone"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => {
                            // keep only digits and cap at 10
                            const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(onlyDigits);
                          }}
                          placeholder="98765 43210"
                          maxLength={10}
                          className={`pl-28 h-14 rounded-xl text-base ${errors.phone ? 'ring-2 ring-destructive/30' : ''}`}
                          aria-invalid={!!errors.phone}
                          aria-describedby={errors.phone ? 'phone-error' : undefined}
                        />
                      </div>
                      {errors.phone && <p id="phone-error" className="text-xs text-destructive">{errors.phone}</p>}
                    </div>
                    {/* ---------- end phone block ---------- */}

                    <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-xl font-semibold text-base">
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending OTP…</> : <><ShieldCheck className="w-4 h-4 mr-2" /> Continue Securely</>}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                  </motion.form>
                ) : step === 'otp' ? (
                  // ====== Verify OTP block ======
                  <motion.div
                    key="step-otp"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Verify OTP</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter the 6-digit code sent to{' '}
                        <span className="font-medium">{prettyPhone ? prettyPhone : phone ? `+91 ${phone}` : '+91'}</span>
                      </p>
                    </div>

                    {/* Center the OTP inputs and make them responsive */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-full flex justify-center">
                        <div className="max-w-[420px] w-full px-4">
                          <div className="flex items-center justify-center">
                            <OTPInputs
                              value={otpDigits}
                              onChange={(v) => {
                                setOtpDigits(v);
                                // clear invalid marker as user types after a failed attempt
                                if (invalidOtp) setInvalidOtp(false);
                              }}
                              disabled={isLoading}
                            />
                          </div>

                          {/* Inline invalid code message: only show when user has entered 6 digits and last attempt failed */}
                          {otpDigits.join('').length === 6 && invalidOtp && (
                            <p className="text-xs text-destructive mt-2 text-center">The code you entered is invalid. Please try again.</p>
                          )}
                        </div>
                      </div>

                      {/* Buttons: stacked on mobile, side-by-side on md+ */}
                      <div className="w-full px-2">
                        <div className="flex flex-col md:flex-row gap-3">
                          <Button
                            variant="outline"
                            onClick={() => setStep('phone')}
                            className="flex-1 h-12 rounded-xl"
                          >
                            Change Number
                          </Button>

                          <Button
                            onClick={handleVerifyOtp}
                            disabled={isLoading}
                            className="flex-1 h-12 rounded-xl font-semibold"
                          >
                            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying…</> : 'Verify & Continue'}
                          </Button>
                        </div>
                      </div>

                      {/* Resend area centered */}
                      <div className="text-center">
                        {canResend ? (
                          <button onClick={handleResend} className="text-sm font-medium text-primary hover:opacity-90">Resend OTP</button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Resend in {resendIn}s</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </Card>

          {/* Bottom meta (mobile-friendly) */}
          <div className="text-center mt-4">
            <button
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ========================== Tiny building blocks ========================== */

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl p-3 bg-card/70 border border-border/40 backdrop-blur flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ['phone', 'otp'];
  const idx = Math.max(0, steps.indexOf(step));
  return (
    <div className="flex items-center gap-2" aria-label="Progress">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-10 rounded-full transition-all ${i <= idx ? 'bg-primary' : 'bg-muted'}`}
          aria-hidden
        />
      ))}
    </div>
  );
}

function OTPInputs({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; }) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  // Paste handler: fill all inputs if pasted
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = [...value];
    for (let i = 0; i < text.length; i++) {
      const pos = index + i;
      if (pos > 5) break;
      next[pos] = text[i];
    }
    onChange(next);
    const finalIndex = Math.min(index + text.length - 1, 5);
    inputsRef.current[Math.min(finalIndex + 1, 5)]?.focus();
  };

  const handleChange = (i: number, v: string) => {
    if (disabled) return;
    const digit = v.replace(/\D/g, '').slice(0, 1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) inputsRef.current[i + 1]?.focus();
    if (i === 5) {
      // Do not call onComplete here to prevent automatic verification
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputsRef.current[i + 1]?.focus();
  };

  return (
    <div className="w-full max-w-[420px] px-2 mx-auto">
      {/* Slightly reduced gap */}
      <div className="flex items-center justify-center gap-2.5 sm:gap-3.5" role="group" aria-label="OTP inputs">
        {value.map((d, i) => (
          <Input
            key={i}
            ref={(el) => (inputsRef.current[i] = el as HTMLInputElement | null)}
            inputMode="numeric"
            pattern="\d*"
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onPaste={(e) => handlePaste(e, i)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={disabled}
            style={{ width: 'clamp(44px, 6vw, 60px)' }} // slightly narrower for balance
            className={`
              flex-shrink-0 h-14 sm:h-16
              flex items-center justify-center text-center
              text-xl sm:text-2xl font-semibold tracking-widest
              rounded-xl box-border px-0 py-0 leading-none align-middle
              bg-emerald-50/70 border border-emerald-200 text-emerald-800
              focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400
              focus:bg-emerald-100/60 transition-all duration-150
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
