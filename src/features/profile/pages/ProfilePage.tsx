import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Star, LogOut, Settings, FileText, Shield, Edit2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

/**
 * Enhanced ProfilePage:
 * - editable avatar + Edit Profile modal
 * - verification badge
 * - animated earned stat pulse on increase
 * - compact accessible menu
 *
 * Notes:
 * - If you have a real file upload / profile update API, replace the mock update calls
 *   in `handleSave` and `handleUpload` with your real endpoints (apiClient.updateProfile / updateHelper).
 */

function EditProfileModal({
  open,
  initialName,
  initialPhone,
  initialAvatar,
  onClose,
  onSave,
}: {
  open: boolean;
  initialName?: string;
  initialPhone?: string;
  initialAvatar?: string | null;
  onClose: () => void;
  onSave: (payload: { name?: string; phone?: string; avatarDataUrl?: string | null }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatar || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setPhone(initialPhone || '');
      setAvatarPreview(initialAvatar || null);
    }
  }, [open, initialName, initialPhone, initialAvatar]);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || undefined, phone: phone.trim() || undefined, avatarDataUrl: avatarPreview });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 max-w-lg w-full bg-card/95 border border-border/40 rounded-2xl shadow-glow p-5"
      >
        <h3 className="text-lg font-semibold flex items-center gap-3">
          Edit profile
          <span className="ml-auto text-xs text-muted-foreground">Changes save locally</span>
        </h3>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-20 h-20">
                {avatarPreview ? <AvatarImage src={avatarPreview} alt="avatar preview" /> : <AvatarFallback>{(name || 'H').charAt(0)}</AvatarFallback>}
              </Avatar>
              <button
                aria-label="Upload new avatar"
                className="absolute -bottom-2 -right-2 bg-white/90 border border-border p-1 rounded-full shadow-sm"
                onClick={() => fileRef.current?.click()}
                title="Change avatar"
              >
                <Edit2 className="w-4 h-4 text-primary" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
            <div className="text-xs text-muted-foreground text-center">Avatar preview — optional</div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-card/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="block">
              <div className="text-xs text-muted-foreground mb-1">Phone</div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 rounded-xl border border-border bg-card/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="tel"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 justify-end">
          <button className="px-4 py-2 rounded-lg border border-border/30 bg-card/30" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg bg-gradient-primary text-white flex items-center gap-2"
            disabled={saving}
            aria-disabled={saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
            {saving ? null : <Check className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, helper, logout, updateHelper } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // animate earned stat when it grows
  const [earnedPulse, setEarnedPulse] = useState(false);
  const prevEarningsRef = useRef<number>(helper?.totalEarnings ?? 0);
  useEffect(() => {
    const prev = prevEarningsRef.current;
    const curr = helper?.totalEarnings ?? 0;
    if (curr > prev) {
      setEarnedPulse(true);
      const t = setTimeout(() => setEarnedPulse(false), 900);
      return () => clearTimeout(t);
    }
    prevEarningsRef.current = curr;
  }, [helper?.totalEarnings]);

  // sync local avatar preview with helper data
  useEffect(() => {
    setLocalAvatar((helper as any)?.avatarUrl ?? null);
  }, [helper]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { icon: Settings, label: 'Settings', onClick: () => navigate('/settings') },
    { icon: FileText, label: 'Documents', onClick: () => navigate('/documents') },
    { icon: Shield, label: 'Verification', onClick: () => navigate('/verification') },
  ];

  const formatCurrency = (v?: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

  // Save handler invoked by modal. Replace updateHelper call with your API if needed.
  const handleSave = async (payload: { name?: string; phone?: string; avatarDataUrl?: string | null }) => {
    try {
      // If you have an API to upload avatar, do that here and get real URL.
      // For now we optimistically update local state via updateHelper (if available).
      const updated = {
        ...helper,
        userId: payload.name ?? user?.name ?? helper?.userId,
        phone: payload.phone ?? user?.phone,
        // If avatarDataUrl is a dataUrl, you should upload and set avatarUrl to returned URL.
        avatarUrl: payload.avatarDataUrl ?? (helper as any)?.avatarUrl ?? null,
      };
      if (updateHelper) updateHelper(updated as any);
      setLocalAvatar(updated.avatarUrl);
      toast({ title: 'Profile updated' });
    } catch (e) {
      toast({ title: 'Update failed', variant: 'destructive', description: 'Could not save profile' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background pb-24 pb-safe">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account and verification.</p>
        </motion.header>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.04 }}>
          <Card className="border-none shadow-glow overflow-hidden">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-start gap-4 w-full md:w-auto">
                  <div className="relative">
                    <button
                      aria-label="Edit profile"
                      className="group relative rounded-full focus:outline-none"
                      onClick={() => setModalOpen(true)}
                      title="Edit profile"
                    >
                      <Avatar className="w-20 h-20 ring-2 ring-primary/20">
                        {localAvatar ? <AvatarImage src={localAvatar} alt="avatar" /> : <AvatarFallback>{(user?.name || helper?.userId || 'H').charAt(0)}</AvatarFallback>}
                      </Avatar>

                      {/* verification badge */}
                      {helper?.isVerified && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium border border-success/20">
                          <Check className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}

                      <span className="sr-only">Open edit profile modal</span>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-semibold truncate">{user?.name ?? helper?.userId ?? 'Helper'}</h2>
                      <div className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        <User className="w-3.5 h-3.5" />
                        Profile
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground truncate mt-1">{user?.phone ?? 'Phone not set'}</p>

                    <div className="flex items-center gap-3 mt-3">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
                        <Star className="w-4 h-4" />
                        <span>{((helper as any)?.avgRating ?? helper?.rating ?? 0).toFixed(1)}</span>
                        {(helper as any)?.totalRatings && (
                          <span className="text-xs ml-1">({(helper as any).totalRatings})</span>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">{helper?.completedServices ?? 0}</span>
                        <span className="ml-1">completed</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto mt-4 md:mt-0">
                  <div className="grid grid-cols-3 gap-3 text-center bg-muted/40 p-3 rounded-xl">
                    <div>
                      <p className="text-lg font-semibold">{helper?.completedServices ?? 0}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
                    </div>

                    <div className="border-x border-border px-2">
                      <motion.p
                        key={helper?.totalEarnings ?? 0}
                        initial={{ scale: 1 }}
                        animate={earnedPulse ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                        transition={{ duration: 0.8 }}
                        className="text-lg font-semibold"
                      >
                        {formatCurrency(helper?.totalEarnings)}
                      </motion.p>
                      <p className="text-xs text-muted-foreground mt-0.5">Earned</p>
                    </div>

                    <div>
                      <p className="text-lg font-semibold">{((helper as any)?.avgRating ?? helper?.rating ?? 0).toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Rating{(helper as any)?.totalRatings ? ` (${(helper as any).totalRatings})` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-2">
          {menuItems.map((m) => {
            const Icon = m.icon;
            return (
              <Card
                key={m.label}
                className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={m.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') m.onClick(); }}
                aria-label={m.label}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1">
                    <div className="font-medium">{m.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage {m.label.toLowerCase()}</p>
                  </div>

                  <div className="text-sm text-muted-foreground">›</div>
                </CardContent>
              </Card>
            );
          })}
        </motion.section>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-12 text-destructive border-destructive/40 hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </motion.div>
      </div>

      <EditProfileModal
        open={modalOpen}
        initialName={user?.name ?? helper?.userId}
        initialPhone={user?.phone}
        initialAvatar={localAvatar}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
