import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const Signup = () => {
  const [name, setName] = useState("");
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !matric || !password || !year) { toast.error('Please fill in all fields'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signup(matric, name, Number(year), password);
      toast.success('Account created! Welcome to CyberWiki.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card-cyber p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="h-10 w-10 rounded-full border-2 border-primary flex items-center justify-center mx-auto mb-3 glow-green">
              <div className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Create Account</h2>
            <p className="text-sm text-muted-foreground mt-1">Join the CyberWiki × CyberMentor community</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Chidi Okonkwo"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
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
              <label className="text-sm font-medium text-foreground block mb-1.5">Year Level</label>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">Select year</option>
                <option value="1">Year 1 — Foundations</option>
                <option value="2">Year 2 — Core Security</option>
                <option value="3">Year 3 — Specialization</option>
                <option value="4">Year 4 — Mastery</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px] border-glow"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Signup;
