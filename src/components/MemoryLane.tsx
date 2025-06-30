import React, { useState, useEffect } from 'react';
import { useSearchStore } from '../stores/searchStore';
import { useAuth } from '../hooks/useAuth';
import { fetchConversations, fetchConversationById } from '../services/api';
import { Loader2, ArrowLeft, Search } from 'lucide-react';
import ModalPanel from './ui/ModalPanel';
import { SemanticSearchResult } from '../types';

// Local types for conversation browsing
interface Message {
  id: string;
  created_at: string;
  role: 'user' | 'model';
  text: string;
}

interface Conversation {
  id: string;
  created_at: string;
  summary?: string;
  messages: Message[];
}

interface MemoryLaneProps {
  onClose: () => void;
}

const MemoryLane: React.FC<MemoryLaneProps> = ({ onClose }) => {
  const { user } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    semanticSearchResults,
    isSearching,
    isAnalyzing,
    analysisResult,
    analysisError,
    executeSemanticSearch,
    setMetaReflectionRequest,
    clearAnalysis,
    clearSearchResults,
  } = useSearchStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [keywordSearchTerm, setKeywordSearchTerm] = useState('');

  // Effect to clear results when search query is emptied
  useEffect(() => {
    if (!searchQuery.trim()) {
      clearSearchResults();
    }
  }, [searchQuery, clearSearchResults]);

  // Historical conversation browsing/searching
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoadingConversations(true);
        const data = await fetchConversations(keywordSearchTerm);
        setConversations(data);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoadingConversations(false);
      }
    };
    const debounceTimer = setTimeout(() => loadConversations(), 300);
    return () => clearTimeout(debounceTimer);
  }, [keywordSearchTerm]);

  const handleSearchClick = () => {
    if (searchQuery.trim() && user?.id) {
      executeSemanticSearch(searchQuery, user.id);
    }
  };

  const handleAnalyzeResults = () => {
    if (searchQuery.trim() && semanticSearchResults.length > 0) {
      setMetaReflectionRequest({
        userQuery: searchQuery,
        relevantMemories: semanticSearchResults,
      });
    }
  };

  const renderMemoryItem = (result: SemanticSearchResult) => {
    const handleResultClick = async () => {
      // First, try to find the conversation in the already loaded list
      let targetConversation = conversations.find(c => c.id === result.conversation_id);

      // If not found, fetch it directly
      if (!targetConversation) {
        try {
          // TODO: Add a loading state for the specific item being clicked
          const fetchedConvo = await fetchConversationById(result.conversation_id);
          if (fetchedConvo) {
            targetConversation = fetchedConvo as Conversation;
          }
        } catch (error) {
          console.error(`Failed to fetch conversation ${result.conversation_id}`, error);
          // Optionally, show a toast notification to the user
          return;
        }
      }
      
      if (targetConversation) {
        setSelectedConversation(targetConversation);
      } else {
        console.warn(`Conversation with ID ${result.conversation_id} could not be found or fetched.`);
      }
    };

    return (
      <div 
        key={result.id} 
        className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer shadow-lg"
        onClick={handleResultClick}
      >
      <div className="flex justify-between items-center text-xs text-white/60 mb-2">
        <span className={`font-semibold ${result.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
          {result.role === 'user' ? 'You' : 'Pulpa'}
        </span>
        <span>{new Date(result.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <p className="text-white/90 text-base leading-relaxed">{result.content}</p>
      {result.relevance != null && (
        <p className="text-sm text-purple-400 self-end mt-2">
          Relevance: {(result.relevance * 100).toFixed(0)}%
        </p>
      )}
      </div>
    );
  };

  const renderContent = () => {
    // 1. Detailed conversation view
    if (selectedConversation) {
      return (
        <div>
          <button 
            onClick={() => setSelectedConversation(null)} 
            className="mb-6 flex items-center text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to list
          </button>
          <div className="space-y-4">
            {selectedConversation.messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`p-4 rounded-xl backdrop-blur-sm border ${
                  msg.role === 'user' 
                    ? 'bg-blue-500/20 border-blue-400/30' 
                    : 'bg-white/10 border-white/20'
                }`}
              >
                <p className="text-white/95 leading-relaxed">{msg.text}</p>
                <span className="text-xs text-white/50 mt-2 block">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 2. Analysis view: loading
    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
          <p className="text-white/70">Analyzing reflections...</p>
        </div>
      );
    }

    // 3. Analysis view: error
    if (analysisError) {
      return (
        <div className="flex flex-col gap-4 text-center">
          <h3 className="text-lg font-semibold text-red-400">Analysis Error</h3>
          <p className="text-white/80 bg-red-500/20 border border-red-400/30 p-4 rounded-xl">{analysisError}</p>
          <button
            onClick={clearAnalysis}
            className="mt-2 self-center bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium py-2 px-6 rounded-full transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      );
    }

    // 4. Analysis view: success
    if (analysisResult) {
      return (
        <div className="flex flex-col gap-6">
          <h3 className="text-lg font-semibold text-white/95">Analysis Result</h3>
          <div className="prose prose-invert max-w-none text-white/90 whitespace-pre-wrap bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm">
            <p className="leading-relaxed">{analysisResult}</p>
          </div>
          <button
            onClick={clearAnalysis}
            className="mt-4 w-full max-w-xs mx-auto flex justify-center py-3 px-6 border border-white/20 rounded-full shadow-sm text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm"
          >
            Back to Search
          </button>
        </div>
      );
    }

    // 5. Default view: search interfaces
    return (
      <div>
        <div className="mb-6 relative flex items-center">
          <input
            type="search"
            placeholder="Search for relevant reflections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearchClick();
              }
            }}
            className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm"
          />
          <button
            onClick={handleSearchClick}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 h-full text-white/60 rounded-r-full hover:text-white hover:bg-primary/50 transition-colors"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </div>

        {isSearching && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-purple-400" size={32} />
          </div>
        )}

        {!isSearching && semanticSearchResults.length > 0 && (
          <div className="space-y-4 mb-8">
            {semanticSearchResults.map(renderMemoryItem)}
            <button
              onClick={handleAnalyzeResults}
              disabled={semanticSearchResults.length === 0}
              className="w-full flex justify-center py-3 px-6 border border-green-400/30 rounded-full shadow-sm text-sm font-medium text-white bg-green-500/20 hover:bg-green-500/30 transition-all duration-200 disabled:bg-green-400/10 disabled:cursor-wait backdrop-blur-sm"
            >
              Analyze these reflections
            </button>
          </div>
        )}

        <hr className="border-white/20 my-8" />

        <div>
          <div className="mb-6">
            <input
              type="search"
              placeholder="Or search by keyword in all conversations..."
              value={keywordSearchTerm}
              onChange={(e) => setKeywordSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-full text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary backdrop-blur-sm"
            />
          </div>
          <div>
            {isLoadingConversations ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="animate-spin text-purple-400" size={48} />
              </div>
            ) : conversations.length === 0 && keywordSearchTerm ? (
              <p className="text-center text-white/60 py-12">No reflections found for "{keywordSearchTerm}".</p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-white/60 py-12">Your saved reflections will appear here.</p>
            ) : (
              <div className="space-y-4">
                {conversations.map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => setSelectedConversation(convo)}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-all duration-200 shadow-lg"
                  >
                    <p className="text-sm text-white/80 mb-2">
                      Reflection from {new Date(convo.created_at).toLocaleString()}
                    </p>
                    {convo.summary && (
                      <p className="text-xs text-white/60 leading-relaxed">{convo.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const title = selectedConversation
    ? `Reflection from ${new Date(selectedConversation.created_at).toLocaleString()}`
    : "Memory Lane";

  return (
    <ModalPanel title={title} onClose={onClose}>
      {renderContent()}
    </ModalPanel>
  );
};

export default MemoryLane;