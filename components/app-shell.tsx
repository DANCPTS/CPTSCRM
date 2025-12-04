'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppNav } from './app-nav';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { GlobalSearch } from './global-search';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onShowSetup={() => setShowSetup(!showSetup)} showSetup={showSetup} />;
  }

  if (!userProfile) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Setup Required</CardTitle>
            <CardDescription>
              Your account needs to be set up. Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <AppNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b bg-card px-6 py-3 shadow-sm">
          <GlobalSearch />
        </div>
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}

function AuthPage({ onShowSetup, showSetup }: { onShowSetup: () => void; showSetup: boolean }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Signed in successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password, fullName, 'admin');
      toast.success('Account created! Please sign in.');
      onShowSetup();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">CPTS Training CRM</CardTitle>
          <CardDescription>
            {showForgotPassword ? 'Reset your password' : showSetup ? 'Create your admin account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to sign in
              </Button>
            </form>
          ) : !showSetup ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={onShowSetup}
                >
                  First time? Create admin account
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Admin Account'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={onShowSetup}
              >
                Back to sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
