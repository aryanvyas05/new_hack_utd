'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register, validatePassword } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);

  const passwordValidation = validatePassword(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setLoading(true);

    try {
      const result = await register(email, password, fullName);
      
      // Show MFA setup
      setMfaSecret(result.mfaSecret || '');
      setMfaQrCode(result.mfaQrCode || '');
      setShowMfaSetup(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (showMfaSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">✅</div>
            <h1 className="text-2xl font-bold text-gray-900">Account Created!</h1>
            <p className="text-gray-600 mt-2">Set up two-factor authentication</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Install Google Authenticator or Authy on your phone</li>
                <li>Scan the QR code below</li>
                <li>Or manually enter the secret key</li>
                <li>Save your backup codes securely</li>
              </ol>
            </div>

            {mfaQrCode && (
              <div className="text-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaQrCode)}`}
                  alt="MFA QR Code"
                  className="mx-auto border-4 border-gray-200 rounded-lg"
                />
              </div>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secret Key (Manual Entry)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 text-sm font-mono break-all">
                  {mfaSecret}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(mfaSecret)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Important:</strong> Save your secret key in a secure location. 
                You'll need it to recover your account if you lose access to your authenticator app.
              </p>
            </div>

            <button
              onClick={() => router.push('/login')}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 font-semibold"
            >
              Continue to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join Veritas Onboard</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
            {password && (
              <div className="mt-2 space-y-1">
                {passwordValidation.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-600">• {err}</div>
                ))}
                {passwordValidation.valid && (
                  <div className="text-xs text-green-600">✓ Password meets all requirements</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg text-xs text-gray-600">
            <strong>Password Requirements:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>At least 12 characters long</li>
              <li>Contains uppercase and lowercase letters</li>
              <li>Contains at least one number</li>
              <li>Contains at least one special character</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !passwordValidation.valid}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <div className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign In
            </a>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            🔒 Your account will be protected with:<br />
            Two-Factor Authentication • Encrypted Storage • Audit Logging
          </div>
        </div>
      </div>
    </div>
  );
}
