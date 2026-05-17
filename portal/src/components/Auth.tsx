import { useState, type FormEvent } from 'react';
import { signIn, signUp, confirmSignUp } from 'aws-amplify/auth';

interface AuthProps {
  onAuthSuccess: () => Promise<void>;
}

export function Auth({ onAuthSuccess }: AuthProps) {
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp' | 'confirmSignUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signIn') {
        await signIn({ username: email, password });
        await onAuthSuccess();
      } else if (authMode === 'signUp') {
        await signUp({ username: email, password, options: { userAttributes: { email } } });
        setAuthMode('confirmSignUp');
      } else if (authMode === 'confirmSignUp') {
        await confirmSignUp({ username: email, confirmationCode: code });
        await signIn({ username: email, password });
        await onAuthSuccess();
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred');
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>{authMode === 'signIn' ? 'Welcome Back' : authMode === 'signUp' ? 'Create Account' : 'Verify Email'}</h2>
        <p className="subtitle">Maintenance Portal Access</p>

        {authError && <div className="error-message">{authError}</div>}

        <form onSubmit={handleAuth}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" required className="form-input" value={email} onChange={e => setEmail(e.target.value)} disabled={authMode === 'confirmSignUp' || authLoading} />
          </div>

          {authMode !== 'confirmSignUp' && (
            <div className="form-group">
              <label>Password</label>
              <input type="password" required className="form-input" value={password} onChange={e => setPassword(e.target.value)} minLength={8} disabled={authLoading} />
            </div>
          )}

          {authMode === 'confirmSignUp' && (
            <div className="form-group">
              <label>Verification Code</label>
              <input type="text" required className="form-input" value={code} onChange={e => setCode(e.target.value)} disabled={authLoading} />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={authLoading}>
            {authLoading ? 'Please wait...' : authMode === 'signIn' ? 'Sign In' : authMode === 'signUp' ? 'Sign Up' : 'Verify & Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          {authMode === 'signIn' ? (
            <>Need an account? <button onClick={() => setAuthMode('signUp')} disabled={authLoading}>Sign up</button></>
          ) : authMode === 'signUp' ? (
            <>Already have an account? <button onClick={() => setAuthMode('signIn')} disabled={authLoading}>Sign in</button></>
          ) : (
            <><button onClick={() => setAuthMode('signIn')} disabled={authLoading}>Back to sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
