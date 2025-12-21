import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, MessageCircle, Mail, Smartphone, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/core/api/client';
import { toast } from 'sonner';

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  serviceUpdates: boolean;
  chatMessages: boolean;
  promotionalMessages: boolean;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    serviceUpdates: true,
    chatMessages: true,
    promotionalMessages: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiClient.getNotificationPreferences();
      if (response.success && response.data) {
        const data = response.data as any;
        setPreferences({
          emailEnabled: data.emailEnabled ?? true,
          smsEnabled: data.smsEnabled ?? true,
          pushEnabled: data.pushEnabled ?? true,
          serviceUpdates: data.serviceUpdates ?? true,
          chatMessages: data.chatMessages ?? true,
          promotionalMessages: data.promotionalMessages ?? false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await apiClient.updateNotificationPreferences(preferences);
      if (response.success) {
        toast.success('Notification preferences saved');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const preferenceItems = [
    {
      id: 'delivery-methods',
      title: 'Delivery Methods',
      items: [
        {
          key: 'emailEnabled' as const,
          icon: Mail,
          label: 'Email Notifications',
          description: 'Receive notifications via email',
          color: 'text-blue-500',
        },
        {
          key: 'smsEnabled' as const,
          icon: Smartphone,
          label: 'SMS Notifications',
          description: 'Receive text messages for important updates',
          color: 'text-green-500',
        },
        {
          key: 'pushEnabled' as const,
          icon: Bell,
          label: 'Push Notifications',
          description: 'Get instant notifications in the app',
          color: 'text-purple-500',
        },
      ],
    },
    {
      id: 'notification-types',
      title: 'Notification Types',
      items: [
        {
          key: 'serviceUpdates' as const,
          icon: AlertTriangle,
          label: 'Service Updates',
          description: 'Updates about your active services',
          color: 'text-orange-500',
        },
        {
          key: 'chatMessages' as const,
          icon: MessageCircle,
          label: 'Chat Messages',
          description: 'New messages from patients',
          color: 'text-emerald-500',
        },
        {
          key: 'promotionalMessages' as const,
          icon: TrendingUp,
          label: 'Promotional Messages',
          description: 'Special offers and announcements',
          color: 'text-pink-500',
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Notification Preferences</h1>
                <p className="text-emerald-100 text-sm mt-1">
                  Customize how you receive notifications
                </p>
              </div>
            </div>
          </div>

          {/* Preferences List */}
          <div className="p-6 space-y-8">
            {preferenceItems.map((section, sectionIndex) => (
              <div key={section.id}>
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.items.map((item, itemIndex) => {
                    const Icon = item.icon;
                    const isEnabled = preferences[item.key];

                    return (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (sectionIndex * 0.1) + (itemIndex * 0.05) }}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          isEnabled
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg bg-white shadow-sm ${item.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-slate-900">
                              {item.label}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) =>
                            updatePreference(item.key, checked)
                          }
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="p-6 border-t bg-slate-50">
            <Button
              onClick={savePreferences}
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-6 rounded-xl shadow-lg"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </Button>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl"
        >
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> You can always change these settings later. We recommend
            keeping service updates enabled to stay informed about your active jobs.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
