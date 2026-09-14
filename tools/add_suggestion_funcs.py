import re

with open('frontend/src/Admin.jsx', 'r') as f:
    content = f.read()

funcs = """
  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuggestions(data.suggestions || []);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleApproveSuggestion = async (suggestionId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions/${suggestionId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuggestions(suggestions.filter(s => s._id !== suggestionId));
        fetchSongs();
      } else {
        alert("Failed to approve");
      }
    } catch(err) { console.error(err); }
  };

  const handleRejectSuggestion = async (suggestionId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suggestions/${suggestionId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuggestions(suggestions.filter(s => s._id !== suggestionId));
      } else {
        alert("Failed to reject");
      }
    } catch(err) { console.error(err); }
  };

  useEffect(() => {
    if (token) {
      fetchSongs();
      fetchSuggestions();
    }
  }, [token]);
"""

# Replace the existing useEffect for token
content = re.sub(
    r"useEffect\(\(\) => \{\n\s*if \(token\) fetchSongs\(\);\n\s*\}, \[token\]\);",
    funcs.strip(),
    content
)

with open('frontend/src/Admin.jsx', 'w') as f:
    f.write(content)
