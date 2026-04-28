import { useState } from "react";
import { Trophy } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth-context";
import { useContributions } from "@/lib/contributions-context";

const Leaderboard = () => {
  const [yearFilter, setYearFilter] = useState("all");
  const { allUsers } = useAuth();
  const { contributions } = useContributions();

  // Calculate accuracy scores
  const usersWithScores = allUsers.map(u => {
    const userContribs = contributions.filter(c => c.authorMatNumber === u.mat_number);
    const reviewed = userContribs.filter(c => c.reviewOutcome);
    const acceptedAsIs = reviewed.filter(c => c.reviewOutcome === 'accepted_as_is').length;
    const acceptedWithEdits = reviewed.filter(c => c.reviewOutcome === 'accepted_with_edits').length;
    const eligible = reviewed.length >= 3;
    const score = reviewed.length > 0 ? ((acceptedAsIs * 1.0 + acceptedWithEdits * 0.5) / reviewed.length) * 100 : 0;
    return { ...u, score, eligible, reviewedCount: reviewed.length, totalContribs: userContribs.length };
  });

  const filtered = usersWithScores
    .filter(u => u.eligible)
    .filter(u => yearFilter === 'all' || u.year_level === Number(yearFilter))
    .sort((a, b) => b.score - a.score);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex-1 max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-primary">📈</span>
            <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          </div>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="all">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
          </select>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Top contributors by accuracy score (min. 3 reviewed contributions)</p>

        {filtered.length === 0 ? (
          <div className="card-cyber p-10 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">No contributors qualify yet. A minimum of 3 reviewed contributions is required to appear.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((u, i) => (
              <div key={u.id} className="card-cyber p-4 flex items-center gap-4">
                <span className="text-2xl w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">{u.mat_number} · Year {u.year_level}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{u.score.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{u.reviewedCount} reviewed</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
