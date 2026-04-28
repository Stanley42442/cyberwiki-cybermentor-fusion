import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const Login = () => {
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingUser, setAwaitingUser] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Navigate once user is set in context after login
  useEffect(() => {
    if (awaitingUser && user) {
      setAwaitingUser(false);
      navigate('/');
    }
  }, [awaitingUser, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matric || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      await login(matric, password);
      toast.success('Welcome back!');
      // Signal that we're waiting for the user profile to be populated
      // by onAuthStateChange → loadProfile. Navigate happens in the useEffect above.
      setAwaitingUser(true);
      // Safety net: if profile takes > 5 s, navigate anyway
      setTimeout(() => {
        setAwaitingUser(false);
        navigate('/');
      }, 5000);
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <Layout>
      {/* py-12 matches Signup and stops card touching the nav */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card-cyber p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="h-10 w-10 rounded-full border-2 border-primary flex items-center justify-center mx-auto mb-3 glow-green">
              <div className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in with your matriculation number</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Matriculation Number</label>
              <input
                type="text"
                placeholder="e.g. U2023/5571085"
                value={matric}
                onChange={e => setMatric(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || awaitingUser}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px] border-glow"
            >
              {awaitingUser ? 'Loading profile…' : loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
