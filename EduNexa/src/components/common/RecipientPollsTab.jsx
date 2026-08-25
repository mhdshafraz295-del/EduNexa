import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchRecipientPolls,
  submitRecipientVote,
} from '../../services/api';
import {
  Vote,
  CheckCircle2,
  Clock,
  Archive,
  AlertCircle,
  BarChart3,
  RefreshCw,
  X,
  Lock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function RecipientPollsTab({ portalName = 'Student' }) {
  const [polls, setPolls] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('ACTIVE'); // 'ACTIVE', 'UPCOMING', 'COMPLETED'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected option per poll: { [pollId]: optionId }
  const [selectedOptions, setSelectedOptions] = useState({});
  const [votingState, setVotingState] = useState({}); // { [pollId]: boolean }
  const [changingVotePollId, setChangingVotePollId] = useState(null);

  const pollingTimerRef = useRef(null);

  const loadPolls = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      setError('');
      const res = await fetchRecipientPolls({ status: activeSubTab });
      if (res.success && res.data) {
        setPolls(res.data.polls || []);

        // Pre-populate existing user voted option
        const initialSelections = {};
        res.data.polls?.forEach((p) => {
          if (p.hasVoted && p.userVotedOptionId) {
            initialSelections[p.id] = p.userVotedOptionId;
          }
        });
        setSelectedOptions((prev) => ({ ...initialSelections, ...prev }));
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load polls.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [activeSubTab]);

  useEffect(() => {
    loadPolls(false);
  }, [loadPolls]);

  // Real-time polling for LIVE results every 20 seconds
  useEffect(() => {
    pollingTimerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPolls(true);
      }
    }, 20000);

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [loadPolls]);

  // Handle Option Select
  const handleSelectOption = (pollId, optionId) => {
    setSelectedOptions((prev) => ({ ...prev, [pollId]: optionId }));
  };

  // Submit Vote
  const handleSubmitVote = async (poll) => {
    const chosenOptionId = selectedOptions[poll.id];
    if (!chosenOptionId) {
      setError('Please select an option to submit your vote.');
      return;
    }

    try {
      setVotingState((prev) => ({ ...prev, [poll.id]: true }));
      setError('');

      const res = await submitRecipientVote(poll.id, chosenOptionId);
      setSuccessMsg(res.message || 'Your vote was submitted successfully!');
      setChangingVotePollId(null);
      await loadPolls(false);
    } catch (err) {
      setError(err.message || 'Failed to submit vote.');
    } finally {
      setVotingState((prev) => ({ ...prev, [poll.id]: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-amber-400 to-[#FFD978] rounded-xl text-slate-900 shadow-xs">
              <Vote className="w-5 h-5" />
            </div>
            Interactive Polls & Voting
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Participate in campus decisions, student elections, and opinion surveys.
          </p>
        </div>

        <button
          onClick={() => loadPolls(false)}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Polls
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          onClick={() => setActiveSubTab('ACTIVE')}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'ACTIVE'
              ? 'bg-slate-900 text-[#FFD978] shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Active Polls
        </button>
        <button
          onClick={() => setActiveSubTab('UPCOMING')}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'UPCOMING'
              ? 'bg-slate-900 text-[#FFD978] shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveSubTab('COMPLETED')}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'COMPLETED'
              ? 'bg-slate-900 text-[#FFD978] shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Completed / Results
        </button>
      </div>

      {/* Polls Feed */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-slate-900 border-t-[#FFD978] rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-2">Loading available polls...</p>
        </div>
      ) : error && polls.length === 0 ? (
        <div className="bg-white rounded-3xl border border-rose-100 p-12 text-center shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Unable to load polls</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">{error}</p>
          <button
            onClick={() => loadPolls(false)}
            className="mt-4 px-4 py-2 bg-slate-900 text-[#FFD978] text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : polls.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
          <Vote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No polls are available right now</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {activeSubTab === 'ACTIVE'
              ? 'There are currently no active polls open for your profile.'
              : activeSubTab === 'UPCOMING'
              ? 'No scheduled upcoming polls at this time.'
              : 'No completed poll results available.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {polls.map((poll) => {
            const hasVoted = poll.hasVoted;
            const isChanging = changingVotePollId === poll.id;
            const canChange = poll.allowVoteChange;
            const isSubmitting = votingState[poll.id];
            const isUpcoming = poll.status === 'SCHEDULED';
            const isClosed = poll.status === 'CLOSED';

            return (
              <div
                key={poll.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isUpcoming
                          ? 'bg-blue-100 text-blue-800'
                          : isClosed
                          ? 'bg-slate-100 text-slate-700'
                          : hasVoted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900 font-black'
                      }`}
                    >
                      {isUpcoming
                        ? 'Upcoming'
                        : isClosed
                        ? 'Poll Closed'
                        : hasVoted
                        ? '✓ You Voted'
                        : 'Active Vote'}
                    </span>

                    {poll.anonymous && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md">
                        Anonymous Poll
                      </span>
                    )}
                  </div>

                  <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug">
                    {poll.title}
                  </h3>

                  {poll.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {poll.description}
                    </p>
                  )}
                </div>

                {/* Options List */}
                <div className="space-y-2">
                  {poll.options.map((option) => {
                    const isSelected = selectedOptions[poll.id] === option.id;
                    const isUserVotedOption = poll.userVotedOptionId === option.id;
                    const showProgress = poll.canViewResults && option.percentage !== undefined;

                    return (
                      <div
                        key={option.id}
                        onClick={() => {
                          if (!isClosed && !isUpcoming && (!hasVoted || isChanging)) {
                            handleSelectOption(poll.id, option.id);
                          }
                        }}
                        className={`relative p-3.5 rounded-2xl border transition-all ${
                          !isClosed && !isUpcoming && (!hasVoted || isChanging)
                            ? 'cursor-pointer hover:border-amber-400/80 hover:bg-amber-50/20'
                            : 'cursor-default'
                        } ${
                          isSelected
                            ? 'border-slate-900 bg-amber-50/30 ring-1 ring-slate-900'
                            : 'border-slate-200/80 bg-slate-50/50'
                        }`}
                      >
                        {/* Progress Bar underlay if results permissible */}
                        {showProgress && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-amber-200/40 rounded-2xl transition-all duration-700 pointer-events-none"
                            style={{ width: `${option.percentage || 0}%` }}
                          />
                        )}

                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            {!isClosed && !isUpcoming && (!hasVoted || isChanging) ? (
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#FFD978]" />}
                              </div>
                            ) : isUserVotedOption ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : null}

                            <span
                              className={`text-xs md:text-sm font-semibold ${
                                isSelected ? 'text-slate-900 font-bold' : 'text-slate-700'
                              }`}
                            >
                              {option.text}
                            </span>
                          </div>

                          {showProgress && (
                            <span className="text-xs font-bold text-slate-800 shrink-0">
                              {option.percentage}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Timing & Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 flex items-center gap-1.5">
                    {isUpcoming ? (
                      <span>Starts: {new Date(poll.startsAt).toLocaleString()}</span>
                    ) : poll.endsAt ? (
                      <span>Ends: {new Date(poll.endsAt).toLocaleString()}</span>
                    ) : (
                      <span>Open indefinitely</span>
                    )}
                  </div>

                  <div>
                    {!isClosed && !isUpcoming && !hasVoted && (
                      <button
                        onClick={() => handleSubmitVote(poll)}
                        disabled={isSubmitting || !selectedOptions[poll.id]}
                        className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-[#FFD978] font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit Vote'}
                      </button>
                    )}

                    {!isClosed && hasVoted && canChange && !isChanging && (
                      <button
                        onClick={() => setChangingVotePollId(poll.id)}
                        className="w-full sm:w-auto px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer"
                      >
                        Change Vote
                      </button>
                    )}

                    {!isClosed && isChanging && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setChangingVotePollId(null)}
                          className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSubmitVote(poll)}
                          disabled={isSubmitting}
                          className="px-4 py-1.5 bg-slate-900 text-[#FFD978] font-bold rounded-xl shadow-xs"
                        >
                          {isSubmitting ? 'Saving...' : 'Confirm Change'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
