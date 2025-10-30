"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Simulate login API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set auth token
      localStorage.setItem('authToken', 'dummy-token');
      
      toast.success('Login successful!');
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-md p-4">
        {/* Logo Section */}
        <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-4 mb-4">
            <img
              src="https://22527425.fs1.hubspotusercontent-na2.net/hubfs/22527425/PurpleSynapz/Screenshot%202025-10-22%20at%202.12.36%20PM.png"
              alt="PurpleSynapz Logo"
                className="h-12 w-auto object-contain"
            />
              <img
                src="https://22527425.fs1.hubspotusercontent-na2.net/hubfs/22527425/PurpleSynapz/png-clipart-x-log-x-plane-logo-aircraft-roblox-x-mark-transport-bird-thumbnail-removebg-preview.png"
                alt="X"
                className="h-8 w-auto object-contain opacity-80"
              />
            <img
              src="https://cdn-nexlink.s3.us-east-2.amazonaws.com/Nexuses-full-logo-dark_8d412ea3-bf11-4fc6-af9c-bee7e51ef494.png"
              alt="Nexuses Logo"
                className="h-6 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your account to continue</p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl p-8 border border-gray-100 shadow-xl bg-[linear-gradient(135deg,#00153D_0%,#2B3E6B_100%)] text-white">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent transition-colors bg-white/10 border-white/20 placeholder:text-white/60 text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg focus:ring-2 focus:ring-white/50 focus:border-transparent transition-colors bg-white/10 border-white/20 placeholder:text-white/60 text-white"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-white focus:ring-white border-white/30 bg-white/10 rounded"
                />
                <span className="ml-2 text-sm text-white/80">Remember me</span>
              </label>
              <Link href="#" className="text-sm text-white hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-[#00153D] py-3 px-4 rounded-lg font-medium hover:bg-white/90 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-white/80">
              Don't have an account?{' '}
              <Link href="/signup" className="text-white hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
