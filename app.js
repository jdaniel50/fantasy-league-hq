diff --git a/app.js b/app.js
new file mode 100644
index 0000000000000000000000000000000000000000..0d6446d643850045411927916daf6cb1e36ef5b9
--- /dev/null
+++ b/app.js
@@ -0,0 +1,334 @@
+const { useState, useEffect, useMemo } = React;
+
+const LEAGUES = [
+  { id: "1186844188245356544", name: "League of Record" },
+  { id: "1257084943821967360", name: "FFL" },
+  { id: "1186825886808555520", name: "Dynasty Champs" }
+];
+
+const POWER_RANKINGS = {
+  week: "Set Weekly",
+  notes: "Update this array each week with your latest rankings.",
+  rankings: {
+    "League of Record": [
+      { teamName: "Team Name 1", change: 1, blurb: "Add your note here." },
+      { teamName: "Team Name 2", change: -1, blurb: "Add your note here." }
+    ],
+    "FFL": [
+      { teamName: "Team Name A", change: 0, blurb: "Add your note here." }
+    ],
+    "Dynasty Champs": [
+      { teamName: "Dynasty Team", change: 2, blurb: "Add your note here." }
+    ]
+  }
+};
+
+const sleeperAvatarUrl = (avatarId) =>
+  avatarId
+    ? `https://sleepercdn.com/avatars/thumbs/${avatarId}`
+    : "https://placehold.co/64x64?text=No+Logo";
+
+const formatRecord = (settings = {}) => {
+  const wins = settings.wins ?? 0;
+  const losses = settings.losses ?? 0;
+  const ties = settings.ties ?? 0;
+  return `${wins}-${losses}${ties ? `-${ties}` : ""}`;
+};
+
+const sortStandings = (teams = []) => {
+  return [...teams].sort((a, b) => {
+    const winsDiff = (b.settings?.wins ?? 0) - (a.settings?.wins ?? 0);
+    if (winsDiff !== 0) return winsDiff;
+    const pointsForDiff = (b.settings?.fpts ?? 0) + (b.settings?.fpts_decimal ?? 0) -
+      ((a.settings?.fpts ?? 0) + (a.settings?.fpts_decimal ?? 0));
+    return pointsForDiff;
+  });
+};
+
+const fetchLeagueBundle = async (leagueId) => {
+  const [league, users, rosters, state] = await Promise.all([
+    fetch(`https://api.sleeper.app/v1/league/${leagueId}`).then((res) => res.json()),
+    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then((res) => res.json()),
+    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then((res) => res.json()),
+    fetch("https://api.sleeper.app/v1/state/nfl").then((res) => res.json())
+  ]);
+
+  const userMap = new Map();
+  users.forEach((user) => {
+    const displayName = user.metadata?.team_name || user.display_name || "Unknown";
+    userMap.set(user.user_id, {
+      displayName,
+      avatar: user.avatar,
+      rosterPositions: user.metadata?.league_name,
+      info: user
+    });
+  });
+
+  const teams = rosters.map((roster) => {
+    const ownerInfo = userMap.get(roster.owner_id);
+    return {
+      rosterId: roster.roster_id,
+      ownerId: roster.owner_id,
+      coOwners: roster.co_owners?.map((id) => userMap.get(id)) ?? [],
+      settings: roster.settings,
+      name: ownerInfo?.displayName ?? `Roster ${roster.roster_id}`,
+      avatar: ownerInfo?.avatar,
+      ownerInfo
+    };
+  });
+
+  const standings = sortStandings(teams);
+
+  const currentWeek = league.metadata?.latest_league_scoring_week || state.week;
+  const matchups = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${currentWeek}`).then((res) => res.json());
+
+  const matchupsByRoster = matchups.reduce((acc, matchup) => {
+    if (!acc[matchup.matchup_id]) {
+      acc[matchup.matchup_id] = [];
+    }
+    acc[matchup.matchup_id].push(matchup);
+    return acc;
+  }, {});
+
+  const pairedMatchups = Object.values(matchupsByRoster).map((pair) => {
+    const home = teams.find((team) => team.rosterId === pair[0]?.roster_id);
+    const away = teams.find((team) => team.rosterId === pair[1]?.roster_id);
+    const points = pair.reduce((acc, entry) => {
+      acc[entry.roster_id] = (entry.points || 0);
+      return acc;
+    }, {});
+    return { home, away, points };
+  });
+
+  return {
+    league,
+    teams,
+    standings,
+    currentWeek,
+    matchups: pairedMatchups
+  };
+};
+
+const SectionHeader = ({ title, subtitle }) => (
+  <div className="mb-6">
+    <h2 className="text-2xl font-bold text-white">{title}</h2>
+    {subtitle && <p className="text-slate-300">{subtitle}</p>}
+  </div>
+);
+
+const TeamBadge = ({ team, extra }) => (
+  <div className="flex items-center gap-3">
+    <img
+      src={sleeperAvatarUrl(team?.avatar)}
+      alt={`${team?.name || "Team"} logo`}
+      className="w-12 h-12 rounded-full border border-slate-700"
+    />
+    <div>
+      <p className="text-white font-semibold">{team?.name || "Unknown Team"}</p>
+      {extra && <p className="text-slate-400 text-sm">{extra}</p>}
+    </div>
+  </div>
+);
+
+const StandingsTable = ({ standings }) => (
+  <div className="overflow-x-auto">
+    <table className="min-w-full bg-slate-900/60 backdrop-blur rounded-xl">
+      <thead>
+        <tr className="text-left text-slate-400">
+          <th className="py-3 px-4">Rank</th>
+          <th className="py-3 px-4">Team</th>
+          <th className="py-3 px-4">Record</th>
+          <th className="py-3 px-4">Points For</th>
+          <th className="py-3 px-4">Points Against</th>
+        </tr>
+      </thead>
+      <tbody>
+        {standings.map((team, index) => {
+          const pointsFor = ((team.settings?.fpts ?? 0) + (team.settings?.fpts_decimal ?? 0)).toFixed(2);
+          const pointsAgainst = ((team.settings?.fpts_against ?? 0) + (team.settings?.fpts_against_decimal ?? 0)).toFixed(2);
+          return (
+            <tr key={team.rosterId} className="border-t border-slate-800 text-slate-200">
+              <td className="py-3 px-4 font-semibold text-white">{index + 1}</td>
+              <td className="py-3 px-4">
+                <TeamBadge team={team} />
+              </td>
+              <td className="py-3 px-4">{formatRecord(team.settings)}</td>
+              <td className="py-3 px-4">{pointsFor}</td>
+              <td className="py-3 px-4">{pointsAgainst}</td>
+            </tr>
+          );
+        })}
+      </tbody>
+    </table>
+  </div>
+);
+
+const PowerRankingCard = ({ team, rank, change, blurb }) => (
+  <div className="p-4 bg-slate-900/60 backdrop-blur rounded-xl border border-slate-800 flex gap-4">
+    <div className="flex flex-col items-center justify-center w-16 text-white">
+      <span className="text-3xl font-bold">{rank}</span>
+      <span className={`text-sm ${change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-slate-400"}`}>
+        {change > 0 ? `+${change}` : change}
+      </span>
+    </div>
+    <div className="flex-1">
+      <TeamBadge team={team} extra={blurb} />
+    </div>
+  </div>
+);
+
+const MatchupCard = ({ matchup }) => {
+  const { home, away, points } = matchup;
+  if (!home || !away) return null;
+  return (
+    <div className="p-4 bg-slate-900/60 backdrop-blur rounded-xl border border-slate-800 space-y-4">
+      <div className="flex items-center justify-between">
+        <TeamBadge team={home} extra={`Score: ${points[home.rosterId]?.toFixed(2) ?? "0.00"}`} />
+        <span className="text-slate-500">vs</span>
+        <TeamBadge team={away} extra={`Score: ${points[away.rosterId]?.toFixed(2) ?? "0.00"}`} />
+      </div>
+    </div>
+  );
+};
+
+const LeagueSection = ({ league, data }) => {
+  const standings = data?.standings ?? [];
+  const matchups = data?.matchups ?? [];
+
+  return (
+    <section className="mb-16">
+      <div className="flex items-center justify-between mb-6">
+        <h2 className="text-3xl font-bold text-white">{league.name}</h2>
+        <span className="text-slate-400 text-sm">Current Week: {data?.currentWeek ?? "-"}</span>
+      </div>
+      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
+        <div>
+          <SectionHeader title="Standings" subtitle="Auto-updated from Sleeper" />
+          <StandingsTable standings={standings} />
+        </div>
+        <div>
+          <SectionHeader title="Current Matchups" subtitle="Refreshes with live Sleeper data" />
+          <div className="space-y-4">
+            {matchups.length === 0 ? (
+              <p className="text-slate-400">No matchups found for this week.</p>
+            ) : (
+              matchups.map((matchup, idx) => <MatchupCard key={idx} matchup={matchup} />)
+            )}
+          </div>
+        </div>
+      </div>
+    </section>
+  );
+};
+
+const App = () => {
+  const [leagueData, setLeagueData] = useState({});
+  const [loading, setLoading] = useState(true);
+  const [error, setError] = useState(null);
+
+  useEffect(() => {
+    const loadData = async () => {
+      try {
+        const entries = await Promise.all(
+          LEAGUES.map(async (league) => {
+            const data = await fetchLeagueBundle(league.id);
+            return [league.id, data];
+          })
+        );
+        const dataMap = Object.fromEntries(entries);
+        setLeagueData(dataMap);
+      } catch (err) {
+        console.error(err);
+        setError("There was a problem fetching data from Sleeper.");
+      } finally {
+        setLoading(false);
+      }
+    };
+
+    loadData();
+  }, []);
+
+  const rankings = useMemo(() => {
+    const processed = {};
+    for (const league of LEAGUES) {
+      const leagueRankings = POWER_RANKINGS.rankings[league.name] ?? [];
+      const teams = leagueData[league.id]?.teams ?? [];
+      const nameMap = new Map(teams.map((team) => [team.name.toLowerCase(), team]));
+      processed[league.name] = leagueRankings.map((entry, index) => {
+        const normalizedName = entry.teamName.toLowerCase();
+        const matchedTeam = nameMap.get(normalizedName);
+        return {
+          team: matchedTeam ?? { name: entry.teamName },
+          rank: index + 1,
+          change: entry.change ?? 0,
+          blurb: entry.blurb
+        };
+      });
+    }
+    return processed;
+  }, [leagueData]);
+
+  return (
+    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
+      <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur">
+        <div className="max-w-7xl mx-auto px-6 py-10">
+          <p className="uppercase tracking-widest text-sm text-emerald-400">Fantasy League HQ</p>
+          <h1 className="text-4xl md:text-5xl font-bold mt-3 mb-4">Sleeper Multi-League Command Center</h1>
+          <p className="text-slate-300 max-w-3xl">
+            Track standings, current matchups, and your custom power rankings across all three Sleeper leagues in one sleek dashboard. Data updates automatically, and power rankings can be edited manually in the configuration section of the code.
+          </p>
+        </div>
+      </header>
+
+      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
+        {loading && <p className="text-slate-400">Loading Sleeper data...</p>}
+        {error && <p className="text-rose-400">{error}</p>}
+
+        {!loading && !error && LEAGUES.map((league) => (
+          <LeagueSection key={league.id} league={league} data={leagueData[league.id]} />
+        ))}
+
+        <section className="mb-16">
+          <div className="flex items-center justify-between mb-6">
+            <h2 className="text-3xl font-bold text-white">Power Rankings</h2>
+            <span className="text-slate-400 text-sm">Week: {POWER_RANKINGS.week}</span>
+          </div>
+          <p className="text-slate-400 mb-8">
+            Update the <code>POWER_RANKINGS</code> object in <code>app.js</code> with your latest rankings, notes, and week number. Team logos and names sync automatically when they match the Sleeper roster names.
+          </p>
+          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
+            {LEAGUES.map((league) => (
+              <div key={league.id} className="space-y-4">
+                <SectionHeader
+                  title={league.name}
+                  subtitle="Manual rankings with auto-synced logos"
+                />
+                {(rankings[league.name] ?? []).length === 0 ? (
+                  <p className="text-slate-500">Add your rankings to see them here.</p>
+                ) : (
+                  rankings[league.name].map(({ team, rank, change, blurb }) => (
+                    <PowerRankingCard
+                      key={`${league.name}-${rank}`}
+                      team={team}
+                      rank={rank}
+                      change={change}
+                      blurb={blurb}
+                    />
+                  ))
+                )}
+              </div>
+            ))}
+          </div>
+        </section>
+      </main>
+
+      <footer className="border-t border-slate-800 bg-slate-950/60 backdrop-blur">
+        <div className="max-w-7xl mx-auto px-6 py-6 text-slate-500 text-sm">
+          Built with Sleeper API data. Update rankings directly in <code>app.js</code> to keep your league buzzing.
+        </div>
+      </footer>
+    </div>
+  );
+};
+
+ReactDOM.createRoot(document.getElementById("root")).render(<App />);
