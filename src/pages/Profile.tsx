import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth-context";
import { useContributions } from "@/lib/contributions-context";
import { Link, Navigate } from "react-router-dom";

const Profile = () => {
  const { user } = useAuth();
  const { contributions } = useContributions();

  if (!user) return <Navigate to="/login" />;

  const userContribs = contributions.filter(c => c.authorMatNumber === user.mat_number);
  const approved = userContribs.filter(c => c.status === 'admin_approved');
  const pending = userContribs.filter(c => c.status === 'under_review' || c.status === 'ai_accepted');
  const rejected = userContribs.filter(c => c.status === 'ai_rejected' || c.status === 'admin_rejected');

  const reviewed = userContribs.filter(c => c.reviewOutcome);
  const acceptedAsIs = reviewed.filter(c => c.reviewOutcome === 'accepted_as_is').length;
  const acceptedWithEdits = reviewed.filter(c => c.reviewOutcome === 'accepted_with_edits').length;
  const eligible = reviewed.length >= 3;
  const score = reviewed.length > 0 ? ((acceptedAsIs * 1.0 + acceptedWithEdits * 0.5) / reviewed.length) * 100 : 0;

  const tierBadge: Record<string, string> = {
    admin: '👑 Admin',
    trusted_contributor: '⭐ Trusted Contributor',
    verified_student: '✓ Verified Student',
    guest: 'Guest',
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground mb-6">Profile</h1>

        <div className="card-cyber p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-2xl font-bold">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user.display_name}</h2>
              <p className="text-sm text-muted-foreground">{user.mat_number}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge-code">{tierBadge[user.tier]}</span>
                <span className={`badge-semester ${user.status === 'verified' ? 'text-primary' : user.status === 'rejected' ? 'text-destructive' : ''}`}>
                  {user.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center border-t border-border pt-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{userContribs.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{approved.length}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{eligible ? `${score.toFixed(0)}%` : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-bold text-foreground mb-3">Your Contributions</h2>
        {userContribs.length === 0 ? (
          <div className="card-cyber p-8 text-center text-muted-foreground text-sm">
            No contributions yet. <Link to="/contribute" className="text-primary hover:underline">Start contributing</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {userContribs.map(c => (
              <Link key={c.id} to={`/course/${c.courseId}`} className="card-cyber p-4 block">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{c.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.status === 'admin_approved' ? 'bg-primary/15 text-primary' :
                    c.status.includes('rejected') ? 'bg-destructive/15 text-destructive' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{new Date(c.submittedAt).toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Profile;
