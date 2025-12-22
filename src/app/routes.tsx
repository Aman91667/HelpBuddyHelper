import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/features/auth';
import { Loader } from '@/shared/components';
import { BottomNav } from '@/components/layout/BottomNav';

// Lazy-loaded pages for code-splitting
const Index = lazy(() => import('@/pages/Index'));
const AuthPage = lazy(() => import('@/features/auth/pages/AuthPage'));
const OnboardingPage = lazy(() => import('@/features/auth/pages/OnboardingPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const EarningsPage = lazy(() => import('@/features/earnings/pages/EarningsPage'));
const HistoryPage = lazy(() => import('@/features/history/pages/HistoryPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));
const JobsPage = lazy(() => import('@/features/jobs/pages/JobsPage'));
const PaymentReceivingPage = lazy(() => import('@/features/payment/pages/PaymentReceivingPage'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, helper } = useAuth();

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // If the user is authenticated but hasn't completed helper onboarding,
  // redirect them to the onboarding flow instead of allowing access.
  if (!helper) {
    return <Navigate to="/auth/helper" replace />;
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
};

export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : (
        <Suspense fallback={<Loader fullScreen />}> <Index /> </Suspense>
      )} />
  <Route path="/auth" element={<Suspense fallback={<Loader fullScreen />}> <AuthPage /> </Suspense>} />
  <Route path="/auth/helper" element={<Suspense fallback={<Loader fullScreen />}> <OnboardingPage /> </Suspense>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <DashboardPage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/earnings"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <EarningsPage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <HistoryPage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <ProfilePage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:serviceId"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <JobsPage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/:serviceId"
        element={
          <ProtectedRoute>
            <Suspense fallback={<Loader fullScreen />}> <PaymentReceivingPage /> </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
