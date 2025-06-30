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
        className="bg-white bg-opacity-5 p-4 rounded-lg border border-white border-opacity-10 flex flex-col gap-2 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={handleResultClick}
      >
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span className={`font-semibold ${result.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
          {result.role === 'user' ? 'You' : 'Pulpa'}
        </span>
        <span>{new Date(result.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <p className="text-slate-200 text-base mt-2">{result.content}</p>
      {result.relevance != null && (
        <p className="text-sm text-purple-400 self-end">
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
          <button onClick={() => setSelectedConversation(null)} className="mb-4 flex items-center text-slate-300 hover:text-white">
            <ArrowLeft size={18} className="mr-2" />
            Back to list
          </button>
          <div className="space-y-4">
            {selectedConversation.messages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-900/50' : 'bg-slate-700/50'}`}>
                <p>{msg.text}</p>
                <span className="text-xs text-gray-400 mt-1 block">{new Date(msg.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 2. Analysis view: loading
    if (isAnalyzing) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="mt-4 text-gray-400">Analyzing reflections...</p>
        </div>
      );
    }

    // 3. Analysis view: error
    if (analysisError) {
      return (
        <div className="flex flex-col gap-4 text-center">
          <h3 className="text-lg font-semibold text-red-400">Analysis Error</h3>
          <p className="text-gray-300 bg-red-900/50 p-4 rounded-lg">{analysisError}</p>
          <button
            onClick={clearAnalysis}
            className="mt-2 self-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      );
    }

    // 4. Analysis view: success
    if (analysisResult) {
      return (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white">Analysis Result</h3>
          <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-wrap bg-white/5 p-4 rounded-lg">
            <p>{analysisResult}</p>
          </div>
          <button
            onClick={clearAnalysis}
            className="mt-4 w-full max-w-xs mx-auto flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Search
          </button>
        </div>
      );
    }

    // 5. Default view: search interfaces
    return (
      <div>
        <div className="mb-4 relative flex items-center">
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
            className="form-input pl-4 pr-12 py-3"
          />
          <button
            onClick={handleSearchClick}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 h-full text-gray-400 rounded-r-lg hover:text-white hover:bg-indigo-600/50 transition-colors"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </div>

        {isSearching && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="animate-spin text-purple-400" size={32} />
          </div>
        )}

        {!isSearching && semanticSearchResults.length > 0 && (
          <div className="space-y-4">
            {semanticSearchResults.map(renderMemoryItem)}
            <button
              onClick={handleAnalyzeResults}
              disabled={semanticSearchResults.length === 0}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400 disabled:cursor-wait"
            >
              Analyze these reflections
            </button>
          </div>
        )}

        <hr className="border-slate-600 my-6" />

        <div>
          <div className="mb-4">
            <input
              type="search"
              placeholder="Or search by keyword in all conversations..."
              value={keywordSearchTerm}
              onChange={(e) => setKeywordSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
          <div>
            {isLoadingConversations ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="animate-spin text-purple-400" size={48} />
              </div>
            ) : conversations.length === 0 && keywordSearchTerm ? (
              <p className="text-center text-gray-400 py-10">No reflections found for \"{keywordSearchTerm}\".</p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Your saved reflections will appear here.</p>
            ) : (
              <div className="space-y-4">
                {conversations.map((convo) => (
                  <div
                    key={convo.id}
                    onClick={() => setSelectedConversation(convo)}
                    className="bg-white/5 p-4 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <p className="text-sm text-gray-300">Reflection from {new Date(convo.created_at).toLocaleString()}</p>
                    {convo.summary && <p className="text-xs text-gray-500 mt-1">{convo.summary}</p>}
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
