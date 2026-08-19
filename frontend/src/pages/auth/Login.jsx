import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Church, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { superAdminAuth, teamLeadAuth } from '../../services/api';
import useThemeStore, { getThemeColors } from '../../stores/themeStore';

const Login = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();
  const colors = getThemeColors(isDark);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { success, error: authError, user, team, accessCode, token } = await superAdminAuth.login({
        email: formData.email,
        password: formData.password,
      });

      console.log('Login response:', { success, user, team, accessCode, token });

      if (!success) {
        const teamLeadResult = await teamLeadAuth.login({
          email: formData.email,
          password: formData.password,
        });
        
        if (teamLeadResult.success) {
          console.log('Team Lead login result:', teamLeadResult);
          localStorage.setItem('rechoir_user', JSON.stringify(teamLeadResult.user));
          localStorage.setItem('rechoir_token', teamLeadResult.token);
          if (teamLeadResult.team) {
            console.log('Saving team lead team:', teamLeadResult.team);
            localStorage.setItem('rechoir_team', JSON.stringify(teamLeadResult.team));
          }
          if (teamLeadResult.accessCode) {
            localStorage.setItem('rechoir_access_code', teamLeadResult.accessCode);
          }
          navigate('/dashboard');
          return;
        }
        setError(authError || 'Login failed');
        return;
      }

      localStorage.setItem('rechoir_user', JSON.stringify(user));
      localStorage.setItem('rechoir_token', token || user.token);
      console.log('Super Admin login - team:', team);
      console.log('Super Admin login - accessCode:', accessCode);
      if (team) {
        console.log('Saving team:', team);
        localStorage.setItem('rechoir_team', JSON.stringify(team));
      }
      if (accessCode) {
        localStorage.setItem('rechoir_access_code', accessCode);
      }
      navigate('/dashboard');
    } catch (_err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setResetLoading(true);

    try {
      const { success, error: resetError } = await teamLeadAuth.setPassword({
        email: forgotEmail,
        newPassword: newPassword,
      });

      if (!success) {
        setError(resetError || 'Password reset failed');
        setResetLogging(false);
        return;
      }

      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setResetLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-team-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ action: 'verify-email', email: forgotEmail })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Email not found');
        setResetLoading(false);
        return;
      }

      if (data.exists) {
        setEmailVerified(true);
        setResetLoading(false);
      } else {
        setError('Email not found in our system');
        setResetLoading(false);
      }
    } catch (err) {
      setError('Failed to verify email');
      setResetLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDark 
            ? 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)'
            : 'radial-gradient(circle at center, #f1f5f9 0%, #f8fafc 100%)',
          padding: '20px',
        }}
      >
        <Card style={{ width: '100%', maxWidth: '420px', background: colors.surface, border: `1px solid ${colors.border}` }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ background: 'linear-gradient(135deg, #1e40af, #7c3aed)', borderRadius: '10px', padding: '8px' }}>
                <Church size={32} color="#fff" />
              </div>
              <span style={{ fontSize: '28px', fontWeight: '700', color: colors.text }}>RECHOIR</span>
            </div>
            <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
              {resetSent ? 'Password Reset' : 'Reset Your Password'}
            </p>
          </div>

          {resetSent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                backgroundColor: isDark ? 'rgba(5, 150, 105, 0.15)' : 'rgba(5, 150, 105, 0.1)', 
                border: `1px solid ${colors.success}`,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                color: colors.success,
                fontSize: '14px',
              }}>
                Password has been reset. You can now sign in with your new password.
              </div>
              <Button onClick={() => { setShowForgotPassword(false); setResetSent(false); setForgotEmail(''); setEmailVerified(false); }} style={{ width: '100%', background: colors.primary }}>
                Back to Sign In
              </Button>
            </div>
          ) : emailVerified ? (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {error && (
                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.1)',
                    border: `1px solid ${colors.error}`,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    color: colors.error,
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}
              <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '10px' }}>
                Enter your new password for: <strong style={{ color: colors.text }}>{forgotEmail}</strong>
              </p>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '42px', color: colors.textSecondary }} />
                <Input
                  label="New Password"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{ paddingLeft: '44px', background: colors.bg, borderColor: colors.border }}
                  required
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '42px', color: colors.textSecondary }} />
                <Input
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{ paddingLeft: '44px', background: colors.bg, borderColor: colors.border }}
                  required
                />
              </div>
              <Button type="submit" isLoading={resetLoading} style={{ width: '100%', background: colors.primary }}>
                Reset Password
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setNewPassword(''); setConfirmPassword(''); setEmailVerified(false); }} style={{ color: colors.textSecondary }}>
                Back
              </Button>
            </form>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.1)',
                    border: `1px solid ${colors.error}`,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    color: colors.error,
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}

              <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '20px' }}>
                Enter your email to reset your password.
              </p>

              <form onSubmit={handleVerifyEmail} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '14px', top: '42px', color: colors.textSecondary }} />
                  <Input
                    label="Email Address"
                    name="forgotEmail"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={{ paddingLeft: '44px', background: colors.bg, borderColor: colors.border }}
                    required
                  />
                </div>

                <Button type="submit" isLoading={resetLoading} style={{ width: '100%', background: colors.primary }}>
                  Verify Email
                </Button>
              </form>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <Button variant="ghost" onClick={() => setShowForgotPassword(false)} style={{ color: colors.textSecondary }}>
                  Back to Sign In
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark 
          ? 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)'
          : 'radial-gradient(circle at center, #f1f5f9 0%, #f8fafc 100%)',
        padding: '20px',
      }}
    >
      <Card style={{ width: '100%', maxWidth: '420px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e40af, #7c3aed)', borderRadius: '10px', padding: '8px' }}>
              <Church size={32} color="#fff" />
            </div>
            <span style={{ fontSize: '28px', fontWeight: '700', color: colors.text }}>RECHOIR</span>
          </div>
          <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.1)',
              border: `1px solid ${colors.error}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              color: colors.error,
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '42px', color: colors.textSecondary }} />
            <Input
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              style={{ paddingLeft: '44px', background: colors.bg, borderColor: colors.border }}
              required
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Lock size={18} style={{ position: 'absolute', left: '14px', top: '42px', color: colors.textSecondary }} />
            <Input
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{ paddingLeft: '44px', paddingRight: '44px', background: colors.bg, borderColor: colors.border }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '14px',
                top: '42px',
                background: 'none',
                border: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: '4px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.color = colors.primary}
              onMouseLeave={(e) => e.target.style.color = colors.textSecondary}
            >
              Forgot Password?
            </button>
          </div>

          <Button type="submit" isLoading={isLoading} style={{ width: '100%', marginTop: '8px', background: 'linear-gradient(135deg, #1e40af, #7c3aed)' }}>
            Sign In
          </Button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
            Team member?{' '}
            <Link to="/member-code-login" style={{ color: colors.primary, textDecoration: 'none', fontWeight: '500' }}>
              Use access code
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: colors.textSecondary, fontSize: '14px' }}>
          New RECHOIR admin?{' '}
          <Link to="/register" style={{ color: colors.primary, textDecoration: 'none', fontWeight: '500' }}>
            Create account
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default Login;