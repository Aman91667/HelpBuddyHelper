import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { apiClient } from '@/core/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/features/auth/components/ImageUpload';
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

// Dedicated onboarding multi-step flow for NEW helper registration
// Steps: details -> aadhaar -> images -> otp -> complete
// OTP verification happens at the END after all details are collected

export type OnboardStep = 'details' | 'aadhaar' | 'images' | 'otp' | 'complete';

export default function HelperOnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, updateHelper, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<OnboardStep>('details');
  const [isLoading, setIsLoading] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; aadhaar?: string; docs?: string }>({});
  const [aadhaar, setAadhaar] = useState('');
  const prettyAadhaar = useMemo(() => {
    const d = aadhaar.replace(/\D/g, '').slice(0, 12);
    if (!d) return '';
    if (d.length <= 4) return d;
    if (d.length <= 8) return `${d.slice(0, 4)} ${d.slice(4)}`;
    return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
  }, [aadhaar]);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [aadhaarImage, setAadhaarImage] = useState<File | null>(null);

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendIn, setResendIn] = useState<number>(0);
  const canResend = resendIn === 0;

  const prettyPhone = useMemo(() => {
    const p = phone.replace(/\D/g, '').slice(0, 10);
    if (!p) return '';
    if (p.length <= 5) return `+91 ${p}`;
    return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  }, [phone]);

  // Clear any PATIENT tokens on mount to prevent conflicts
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.userType === 'PATIENT') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('logoutBlock');
          localStorage.removeItem('hasRefreshCookie');
        }
      } catch (e) {
        // Invalid token, clear it anyway
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    }
    
    // Also clear any refresh token cookies by calling logout
    // This will clear the httpOnly cookie on the server
    apiClient.logout().catch(() => {
      // Ignore errors, cookie may not exist
    });
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Prefill from navigation state or query params; optionally autostart OTP
  useEffect(() => {
    const pre = (location?.state as any)?.prefill;
    const qs = new URLSearchParams(location.search);
    const qName = qs.get('name');
    const qPhone = qs.get('phone');
    const qStep = qs.get('step') as OnboardStep | null;
    const qAutostart = qs.get('autostart');

    // prefer navigation state prefill, then query params
    if (pre) {
      if (pre.name) setName(pre.name);
      if (pre.phone) setPhone(pre.phone);
      // support legacy autostart through state
      if (pre.autostart) {
        // attempt autostart after small delay to allow state to settle
        setTimeout(() => maybeAutostartOtp(true), 200);
      }
    }

    if (qName && !pre?.name) setName(decodeURIComponent(qName));
    if (qPhone && !pre?.phone) setPhone(qPhone.replace(/\D/g, '').slice(0, 10));

    // deep link into a specific step if valid
    if (qStep && ['details', 'otp', 'aadhaar', 'images', 'complete'].includes(qStep)) {
      // only allow stepping forward sensibly (basic guard)
      if (qStep === 'otp' && phone.replace(/\D/g, '').length === 10) setStep('otp');
      else if (qStep === 'aadhaar' && phone.replace(/\D/g, '').length === 10) setStep('aadhaar');
      else if (qStep === 'images') setStep('images');
      else if (qStep === 'complete') setStep('complete');
      else setStep('details');
    }

    // autostart OTP if query param present and details appear valid
    if (qAutostart === '1' || qAutostart === 'true') {
      // delay slightly to let prefill settle
      setTimeout(() => maybeAutostartOtp(false), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.state]);

  // Try to autostart OTP if details validate and we're still on details step.
  const maybeAutostartOtp = async (forcedFromState: boolean) => {
    // only autostart if on details step
    if (step !== 'details') return;
    const digits = phone.replace(/\D/g, '');
    if (!name.trim() || digits.length !== 10) {
      // if forced (from state), show a subtle toast to highlight missing info
      if (forcedFromState) {
        toast({ variant: 'destructive', title: 'Prefill incomplete', description: 'Name or phone is missing or invalid for autostart.' });
      }
      return;
    }
    // fire OTP request programmatically
    await handleRequestOtp();
  };

  const validateDetails = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Please enter your full name.';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) errs.phone = 'Enter a valid 10-digit mobile number.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleDetailsNext = () => {
    if (!validateDetails()) return;
    setStep('aadhaar');
  };

  const handleAadhaarNext = () => {
    const only = aadhaar.replace(/\D/g, '');
    if (only.length !== 12) {
      setErrors(e => ({ ...e, aadhaar: 'Enter a valid 12-digit Aadhaar number.' }));
      return;
    }
    setErrors(e => ({ ...e, aadhaar: undefined }));
    setStep('images');
  };

  const handleImagesNext = async () => {
    if (!profileImage || !aadhaarImage) {
      setErrors(e => ({ ...e, docs: 'Please upload both profile and Aadhaar photos.' }));
      return;
    }
    setErrors(e => ({ ...e, docs: undefined }));
    
    // Check for duplicates BEFORE sending OTP
    if (isLoading) return;
    setIsLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, '');
      const aadhaarDigits = aadhaar.replace(/\D/g, '');
      const existCheck = await apiClient.checkHelperExists(phoneDigits, aadhaarDigits);
      
      if (existCheck?.success) {
        const exists = (existCheck as any)?.data?.exists;
        const field = (existCheck as any)?.data?.field;
        
        if (exists) {
          setIsLoading(false);
          if (field === 'phone') {
            toast({ 
              variant: 'destructive', 
              title: 'Phone already registered', 
              description: 'This phone number is already registered. Please use a different number or login instead.' 
            });
            // Go back to details step to change phone
            setStep('details');
          } else if (field === 'aadhaar') {
            toast({ 
              variant: 'destructive', 
              title: 'Aadhaar already registered', 
              description: 'This Aadhaar number is already registered. Please use a different Aadhaar number.' 
            });
            // Go back to aadhaar step to change aadhaar
            setStep('aadhaar');
          } else {
            toast({ 
              variant: 'destructive', 
              title: 'Already registered', 
              description: 'A helper with these details already exists. Please login instead.' 
            });
            setStep('details');
          }
          return;
        }
      } else {
        setIsLoading(false);
        toast({ 
          variant: 'destructive', 
          title: 'Unable to verify', 
          description: existCheck?.error || 'Could not verify registration details. Please try again.' 
        });
        return;
      }
      
      // If no duplicates found, proceed to send OTP
      await handleRequestOtp();
      // Reset loading state after OTP is sent
      setIsLoading(false);
    } catch (e) {
      setIsLoading(false);
      toast({ 
        variant: 'destructive', 
        title: 'Verification failed', 
        description: 'Could not verify registration details. Please try again.' 
      });
    }
  };

  // NOTE: event optional so this function can be called programmatically (from handleImagesNext)
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e && typeof (e as any).preventDefault === 'function') (e as React.FormEvent).preventDefault();
    if (!validateDetails()) return;
    
    // Only set loading if called directly (with event), otherwise handleImagesNext manages it
    const shouldManageLoading = !!e;
    if (shouldManageLoading && isLoading) return;
    if (shouldManageLoading) setIsLoading(true);
    
    try {
      const digits = phone.replace(/\D/g, '');
      const data = await apiClient.requestOtp('phone', digits, name.trim());
      if (data?.success) {
        setStep('otp');
        setResendIn(30);
        // clear previous OTP boxes
        setOtpDigits(['', '', '', '', '', '']);
        toast({ title: 'OTP sent', description: 'Please check your phone for the code.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data?.error || 'Failed to send OTP' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Network error', description: 'Please try again.' });
    } finally {
      if (shouldManageLoading) setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || isLoading) return;
    setIsLoading(true);
    try {
      const digits = phone.replace(/\D/g, '');
      if (digits.length !== 10) {
        toast({ variant: 'destructive', title: 'Invalid phone', description: 'Phone number must be 10 digits.' });
        setIsLoading(false);
        return;
      }
      const data = await apiClient.requestOtp('phone', digits, name.trim());
      if (data?.success) {
        setResendIn(30);
        // Clear OTP inputs when resending
        setOtpDigits(['', '', '', '', '', '']);
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

  const handleVerifyOtp = async () => {
    // Prevent multiple calls
    if (isLoading) {
      return;
    }
    
    const code = otpDigits.join('');
    
    if (code.length !== 6) {
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Enter the 6-digit OTP.' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Ensure phone is exactly 10 digits
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
        toast({ variant: 'destructive', title: 'Invalid phone', description: 'Phone number must be 10 digits.' });
        setIsLoading(false);
        return;
      }
      
      // Clear any existing tokens before verification to prevent conflicts
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('logoutBlock');
      
      // First verify OTP and get tokens
      const data = await apiClient.verifyOtp('phone', phoneDigits, code, name.trim(), 'HELPER');
      
      if (data?.success && data?.data) {
        const tokens = data.data as { accessToken: string; refreshToken: string };
        
        // Verify the token is for HELPER before proceeding
        try {
          const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
          if (payload.userType !== 'HELPER') {
            toast({ 
              variant: 'destructive', 
              title: 'Account type mismatch', 
              description: 'This account is registered as a patient. Please use the patient app instead.' 
            });
            setIsLoading(false);
            return;
          }
        } catch (e) {
          // Token decode error, ignore
        }
        
        await login(tokens.accessToken, tokens.refreshToken);
        
        // Now complete registration with all the collected details
        await handleCompleteRegistration();
      } else {
        toast({ variant: 'destructive', title: 'Invalid OTP', description: data?.error || 'Check code & try again.' });
        setIsLoading(false);
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Please try again.';
      toast({ variant: 'destructive', title: 'Verification failed', description: errorMsg });
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    // All validations already done, just submit the registration
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('phone', phone.replace(/\D/g, ''));
      form.append('aadhaar', aadhaar.replace(/\D/g, ''));
      form.append('profileImage', profileImage!);
      form.append('aadhaarImage', aadhaarImage!);

      const res = await apiClient.registerHelperWithDocuments(form);
      
      if (res?.success && res?.data) {
        try { updateHelper(res.data as any); } catch {}
        toast({ title: 'Registration complete', description: 'You are now a verified helper.' });
        setStep('complete');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        const status = (res as any)?.status as number | undefined;
        const err = res?.error || '';
        if (status === 404 || status === 405 || status === 501 || status === 503 || /Failed to fetch|NetworkError|ERR_NETWORK/i.test(err)) {
          toast({
            variant: 'destructive',
            title: 'Registration service unavailable',
            description: 'Endpoint missing or offline. Ensure POST /helpers/register exists and server is running.',
          });
        } else {
          toast({ variant: 'destructive', title: 'Registration failed', description: err || 'Please try again.' });
        }
        setIsLoading(false);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Registration service unavailable', description: 'Cannot reach server. Check backend.' });
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-gradient-to-br from-background via-primary/5 to-background relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-primary/15 to-success/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-gradient-to-bl from-secondary/15 to-primary/10 blur-3xl" />

      <div className="relative hidden lg:flex items-center justify-center p-10">
        <div className="max-w-md w-full">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
            <motion.div initial={{ rotate: -2, scale: 0.98 }} animate={{ rotate: [-2, 2, -2], scale: [0.98, 1.02, 0.98] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="inline-block relative">
              <div className="rounded-3xl p-1 bg-gradient-to-tr from-primary to-success shadow-premium">
                <div className="rounded-2xl bg-card/95 border border-border/40 p-5 w-28 h-28 flex items-center justify-center">
                  <img src={logo} alt="HelpBudy" className="w-20 h-20 object-contain" />
                </div>
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary" />
            </motion.div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Become a verified helper</h1>
            <p className="mt-3 text-base text-muted-foreground">Fast onboarding • Secure identity checks • Instant earning</p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-left">
              <FeatureItem icon={<ShieldCheck className="w-4 h-4" />} title="Verified" desc="Aadhaar & identity checks" />
              <FeatureItem icon={<LockKeyhole className="w-4 h-4" />} title="Secure" desc="Encrypted data flow" />
              <FeatureItem icon={<CheckCircle2 className="w-4 h-4" />} title="Instant" desc="Rapid OTP login" />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 lg:p-10">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="w-full max-w-md">
          <Card className="rounded-2xl bg-card/90 backdrop-blur-xl border border-border/40 shadow-glow overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/5 to-success/5">
              <div className="w-4" />
              <Stepper step={step} />
            </div>
            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {step === 'details' && (
                  <motion.form key="step-details" onSubmit={(e) => { e.preventDefault(); handleDetailsNext(); }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Start your journey</h2>
                      <p className="text-sm text-muted-foreground mt-1">Enter basic details to begin</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        name="name"
                        type="text"
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="e.g., Aman Jain" 
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        data-lpignore="true"
                        data-form-type="other"
                        className={`h-14 rounded-xl text-base ${errors.name ? 'ring-2 ring-destructive/30' : ''}`} 
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input 
                          id="phone" 
                          name="phone"
                          type="tel"
                          inputMode="numeric" 
                          value={phone} 
                          onChange={e => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setPhone(digits);
                          }} 
                          placeholder="9876543210" 
                          maxLength={10}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          data-form-type="other"
                          className={`pl-12 h-14 rounded-xl text-base ${errors.phone ? 'ring-2 ring-destructive/30' : ''}`} 
                        />
                      </div>
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      {phone && <p className="text-xs text-muted-foreground mt-1">Your number: +91 {phone.slice(0, 5)} {phone.slice(5)}</p>}
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-14 rounded-xl font-semibold text-base">
                      Continue
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">By continuing, you agree to our Terms & Privacy Policy</p>
                  </motion.form>
                )}
                {step === 'otp' && (
                  <motion.div key="step-otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Verify OTP</h2>
                      <p className="text-sm text-muted-foreground mt-1">Enter the 6-digit code sent to <span className="font-medium">{prettyPhone}</span></p>
                    </div>
                    <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-full flex justify-center">
                          <div className="max-w-[420px] w-full px-4">
                            <div className="flex items-center justify-center">
                              <OTPInputs value={otpDigits} onChange={setOtpDigits} disabled={isLoading} />
                            </div>
                          </div>
                        </div>
                        <div className="w-full px-2">
                          <div className="flex flex-col md:flex-row gap-3">
                            <Button type="button" variant="outline" onClick={() => {
                              setStep('images');
                            }} className="flex-1 h-12 rounded-xl">Back</Button>
                            <Button 
                              type="button" 
                              onClick={handleVerifyOtp} 
                              disabled={isLoading} 
                              className="flex-1 h-12 rounded-xl font-semibold"
                            >
                              {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Completing…</>) : 'Complete Registration'}
                            </Button>
                          </div>
                        </div>
                        <div className="text-center">
                          {canResend ? (
                            <button type="button" onClick={handleResend} className="text-sm font-medium text-primary hover:opacity-90">Resend OTP</button>
                          ) : (
                            <span className="text-sm text-muted-foreground">Resend in {resendIn}s</span>
                          )}
                        </div>
                      </div>
                    </form>
                  </motion.div>
                )}
                {step === 'aadhaar' && (
                  <motion.div key="step-aadhaar" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Aadhaar Verification</h2>
                      <p className="text-sm text-muted-foreground mt-1">Enter your 12-digit Aadhaar number</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aadhaar">Aadhaar Number</Label>
                      <Input 
                        id="aadhaar" 
                        name="aadhaar"
                        type="text"
                        inputMode="numeric" 
                        value={prettyAadhaar} 
                        onChange={e => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))} 
                        placeholder="#### #### ####" 
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-form-type="other"
                        className={`h-14 rounded-xl text-base ${errors.aadhaar ? 'ring-2 ring-destructive/30' : ''}`} 
                      />
                      {errors.aadhaar && <p className="text-xs text-destructive">{errors.aadhaar}</p>}
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep('details')} className="flex-1 h-12 rounded-xl">Back</Button>
                      <Button onClick={handleAadhaarNext} className="flex-1 h-12 rounded-xl" disabled={isLoading}>Continue</Button>
                    </div>
                  </motion.div>
                )}
                {step === 'images' && (
                  <motion.div key="step-images" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">Upload Photos</h2>
                      <p className="text-sm text-muted-foreground mt-1">Add a clear profile photo and your Aadhaar card photo</p>
                    </div>
                    <div className="space-y-4">
                      <ImageUpload label="Profile Photo *" onImageSelect={setProfileImage} />
                      <ImageUpload label="Aadhaar Card Photo *" onImageSelect={setAadhaarImage} />
                      {errors.docs && <p className="text-xs text-destructive">{errors.docs}</p>}
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setStep('aadhaar')} className="flex-1 h-12 rounded-xl">Back</Button>
                      <Button onClick={handleImagesNext} className="flex-1 h-12 rounded-xl" disabled={isLoading}>
                        {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying…</>) : 'Continue to Verification'}
                      </Button>
                    </div>
                  </motion.div>
                )}
                {step === 'complete' && (
                  <motion.div key="step-complete" className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold">All set!</h2>
                      <p className="text-sm text-muted-foreground mt-1">Redirecting to your dashboard…</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
          <div className="text-center mt-4">
            <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => navigate('/')}> <ArrowLeft className="w-4 h-4" /> Back to Home</button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

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

function Stepper({ step }: { step: OnboardStep }) {
  const steps: OnboardStep[] = ['details', 'aadhaar', 'images', 'otp'];
  const idx = Math.max(0, steps.indexOf(step));
  return (
    <div className="flex items-center gap-2" aria-label="Progress">
      {steps.map((_, i) => (
        <div key={i} className={`h-1.5 w-10 rounded-full transition-all ${i <= idx ? 'bg-primary' : 'bg-muted'}`} aria-hidden />
      ))}
    </div>
  );
}

/**
 * OTPInputs
 * - Does NOT auto-verify or auto-submit.
 * - Pastes digits into inputs, focuses the next slot, but does not call any verify handler.
 * - Keeps keyboard navigation, backspace, delete behavior and select-on-focus.
 */
function OTPInputs({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; }) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    // paste digits only, up to remaining slots
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - index);
    if (!text) return;
    e.preventDefault();

    const next = [...value];
    for (let i = 0; i < text.length; i++) {
      const pos = index + i;
      if (pos > 5) break;
      next[pos] = text[i];
    }
    onChange(next);

    // Focus the slot after the last pasted digit if it exists.
    // IMPORTANT: we do NOT auto-submit or auto-call any verify function here.
    const finalIndex = Math.min(index + text.length, 5);
    setTimeout(() => {
      inputsRef.current[finalIndex]?.focus();
      inputsRef.current[finalIndex]?.select();
    }, 10);
  };
  
  const handleChange = (i: number, v: string) => {
    if (disabled) return;
    
    // Extract only digits
    const digits = v.replace(/\D/g, '');
    
    // If completely empty, clear the box
    if (digits.length === 0) {
      const next = [...value];
      next[i] = '';
      onChange(next);
      return;
    }
    
    const newDigit = digits[0];
    if (value[i] === newDigit) return;
    
    const next = [...value];
    next[i] = newDigit;
    onChange(next);
    
    // Auto-focus next input if not the last box (but do NOT auto-verify)
    if (i < 5) {
      setTimeout(() => {
        inputsRef.current[i + 1]?.focus();
      }, 10);
    } else {
      // Last digit filled — user must manually click "Complete Registration"
    }
  };
  
  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...value];
      
      if (value[i]) {
        // Clear current box if it has a value
        next[i] = '';
        onChange(next);
      } else if (i > 0) {
        // Move to previous box and clear it if current is already empty
        next[i - 1] = '';
        onChange(next);
        inputsRef.current[i - 1]?.focus();
      }
    }
    
    // Handle delete key
    if (e.key === 'Delete') {
      e.preventDefault();
      const next = [...value];
      next[i] = '';
      onChange(next);
    }
    
    // Arrow key navigation
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      inputsRef.current[i + 1]?.focus();
    }
  };
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all content when focusing to allow easy replacement
    setTimeout(() => {
      e.target.select();
    }, 0);
  };
  
  return (
    <div className="w-full max-w-[420px] px-2 mx-auto">
      <div className="flex items-center justify-center gap-2.5 sm:gap-3.5" role="group" aria-label="OTP inputs">
        {value.map((d, i) => (
          <Input 
            key={i} 
            ref={el => (inputsRef.current[i] = el as HTMLInputElement | null)} 
            type="text"
            inputMode="numeric" 
            pattern="\d*" 
            maxLength={1}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            data-1p-ignore="true"
            value={d} 
            onChange={e => handleChange(i, e.target.value)} 
            onPaste={e => handlePaste(e, i)} 
            onKeyDown={e => handleKeyDown(i, e)} 
            onFocus={handleFocus}
            disabled={disabled} 
            style={{ width: 'clamp(44px, 6vw, 60px)' }} 
            className="flex-shrink-0 h-14 sm:h-16 flex items-center justify-center text-center text-xl sm:text-2xl font-semibold tracking-widest rounded-xl box-border px-0 py-0 leading-none align-middle bg-emerald-50/70 border border-emerald-200 text-emerald-800 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 focus:bg-emerald-100/60 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed" 
            aria-label={`OTP digit ${i + 1}`} 
          />
        ))}
      </div>
    </div>
  );
}
