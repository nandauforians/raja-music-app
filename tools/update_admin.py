import re

with open('frontend/src/Admin.jsx', 'r') as f:
    content = f.read()

# 1. Add states
state_insertion = """  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
"""
content = re.sub(r'(const \[gamificationData, setGamificationData\] = useState\(null\);)', r'\1\n' + state_insertion, content)

# 2. Add fetch logic for suggestions (piggy back on activeTab effect)
effect_code = """  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === 'schedule') {
      fetchSchedule();
    } else if (activeTab === 'incentives') {
      fetchIncentives();
    } else if (activeTab === 'gamification') {
      fetchGamification();
    } else if (activeTab === 'suggestions') {
      fetchSuggestions();
    }
  }, [isAdmin, activeTab]);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions`, {
        headers: { 'x-user-id': user?.sub }
      });
      const data = await res.json();
      if (data.success) setSuggestions(data.suggestions);
    } catch(err) {
      toast.error('Failed to load suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const approveSuggestion = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions/${id}/approve`, {
        method: 'POST',
        headers: { 'x-user-id': user?.sub }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Suggestion approved & added to catalog!');
        fetchSuggestions();
      } else {
        toast.error(data.error || 'Failed to approve');
      }
    } catch(err) {
      toast.error('Error approving suggestion');
    }
  };

  const rejectSuggestion = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions/${id}/reject`, {
        method: 'POST',
        headers: { 'x-user-id': user?.sub }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Suggestion rejected');
        fetchSuggestions();
      } else {
        toast.error('Failed to reject');
      }
    } catch(err) {
      toast.error('Error rejecting suggestion');
    }
  };
"""
content = re.sub(r'  useEffect\(\(\) => \{\n    if \(\!isAdmin\) return;\n    if \(activeTab === \'schedule\'\) \{\n      fetchSchedule\(\);\n    \} else if \(activeTab === \'incentives\'\) \{\n      fetchIncentives\(\);\n    \} else if \(activeTab === \'gamification\'\) \{\n      fetchGamification\(\);\n    \}\n  \}, \[isAdmin, activeTab\]\);', effect_code, content)

# 3. Add render function for suggestions
render_suggestions = """
  const renderSuggestionsTab = () => {
    if (suggestionsLoading) return <div className="text-white text-center py-10">Loading suggestions...</div>;
    if (suggestions.length === 0) return <div className="text-neutral-500 text-center py-10">No pending suggestions.</div>;

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white mb-6">Pending Song Suggestions</h2>
        <div className="grid gap-4">
          {suggestions.map(s => (
            <div key={s._id} className="bg-neutral-800 p-4 rounded-xl border border-neutral-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={s.albumCoverUrl} className="w-16 h-16 rounded bg-neutral-900" />
                <div>
                  <h3 className="font-bold text-white text-lg">{s.title}</h3>
                  <p className="text-sm text-neutral-400">{s.movie} ({s.year})</p>
                  <p className="text-xs text-neutral-500 mt-1">Suggested by: {s.userName}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-col md:flex-row">
                <button onClick={() => approveSuggestion(s._id)} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold text-white transition">Approve & Add</button>
                <button onClick={() => rejectSuggestion(s._id)} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold text-white transition">Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
"""
content = re.sub(r'(  const renderDatabaseTab = \(\) => \{)', render_suggestions + r'\n\1', content)

# 4. Add tab button
tab_btn = """              <button 
                onClick={() => setActiveTab('suggestions')} 
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'suggestions' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-white'}`}
              >
                Suggestions
              </button>"""
content = re.sub(r'(<button \n                onClick=\{\(\) => setActiveTab\(\'gamification\'\)\})', tab_btn + '\n              ' + r'\1', content)

# 5. Add to render switch
render_switch = "{activeTab === 'database' ? renderDatabaseTab() : activeTab === 'schedule' ? renderScheduleTab() : activeTab === 'incentives' ? renderIncentivesTab() : activeTab === 'suggestions' ? renderSuggestionsTab() : renderGamificationTab()}"
content = re.sub(r'\{activeTab === \'database\' \? renderDatabaseTab\(\) : activeTab === \'schedule\' \? renderScheduleTab\(\) : activeTab === \'incentives\' \? renderIncentivesTab\(\) : renderGamificationTab\(\)\}', render_switch, content)

with open('frontend/src/Admin.jsx', 'w') as f:
    f.write(content)

