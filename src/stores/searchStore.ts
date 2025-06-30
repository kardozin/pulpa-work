import { create } from 'zustand';
import { supabase } from '../supabaseClient';
import { SemanticSearchResult, MetaReflectionRequest } from '../types';

// Type for the raw data from the semantic search function
interface SemanticSearchResponseItem {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'model';
  created_at: string;
  similarity: number;
}

// Type for the raw data from the keyword search (memories table)
interface MemoryRecord {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'model';
  created_at: string;
}

interface SearchState {
  searchQuery: string;
  isSearching: boolean;
  semanticSearchResults: SemanticSearchResult[];
  keywordSearchResults: SemanticSearchResult[];

  // Meta-reflection state
  metaReflectionRequest: MetaReflectionRequest | null;
  isAnalyzing: boolean;
  analysisResult: string | null;
  analysisError: string | null;

  // Actions
  setSearchQuery: (query: string) => void;
  executeSemanticSearch: (query: string, userId: string) => Promise<void>;
  executeKeywordSearch: (query: string, userId: string) => Promise<void>;
  clearSearchResults: () => void;

  // Meta-reflection actions
  setMetaReflectionRequest: (request: MetaReflectionRequest | null) => void;
  startAnalysis: () => void;
  setAnalysisSuccess: (result: string) => void;
  setAnalysisError: (error: string) => void;
  clearAnalysis: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  isSearching: false,
  semanticSearchResults: [],
  keywordSearchResults: [],
  metaReflectionRequest: null,
  isAnalyzing: false,
  analysisResult: null,
  analysisError: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  executeSemanticSearch: async (localQuery, userId) => {
    if (!localQuery.trim() || !userId) return;

    set({ isSearching: true, semanticSearchResults: [] });
    try {
      const { data, error } = await supabase.functions.invoke('semantic-search', {
        body: { query: localQuery },
      });

      if (error) throw new Error(error.message);

      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      const resultsArray = Array.isArray(parsedData) ? parsedData : (parsedData?.matches || []);

      if (!Array.isArray(resultsArray)) {
        console.error('Semantic search did not return an array:', resultsArray);
        throw new TypeError('Expected an array from semantic search, but received something else.');
      }

      const adaptedData: SemanticSearchResult[] = resultsArray.map((item: SemanticSearchResponseItem) => ({
        id: item.id,
        conversation_id: item.conversation_id,
        content: item.content,
        role: item.role,
        created_at: item.created_at,
        relevance: item.similarity,
      }));

      set({ semanticSearchResults: adaptedData, isSearching: false });
    } catch (error) {
      console.error('Error during semantic search:', error);
      set({ semanticSearchResults: [], isSearching: false });
    }
  },

  executeKeywordSearch: async (localQuery, userId) => {
    if (!localQuery.trim() || !userId) return;

    set({ isSearching: true, keywordSearchResults: [] });
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('id, conversation_id, content, role, created_at')
        .eq('user_id', userId)
        .textSearch('content', localQuery, { type: 'websearch', config: 'english' });

      if (error) throw error;

      const results: SemanticSearchResult[] = (data || []).map((item: MemoryRecord) => ({
        id: item.id,
        conversation_id: item.conversation_id,
        content: item.content,
        role: item.role,
        created_at: item.created_at,
        relevance: 0, // Keyword search doesn't provide a relevance score
      }));

      set({ keywordSearchResults: results, isSearching: false });
    } catch (error) {
      console.error('Error during keyword search:', error);
      set({ keywordSearchResults: [], isSearching: false });
    }
  },

  clearSearchResults: () => set({ semanticSearchResults: [], keywordSearchResults: [] }),

  // --- Meta-Reflection Actions ---
  setMetaReflectionRequest: (request) => set({ metaReflectionRequest: request }),

  startAnalysis: () => set({
    isAnalyzing: true,
    analysisResult: null,
    analysisError: null
  }),

  setAnalysisSuccess: (result) => set({
    isAnalyzing: false,
    analysisResult: result
  }),

  setAnalysisError: (error) => set({
    isAnalyzing: false,
    analysisError: error
  }),

  clearAnalysis: () => set({
    isAnalyzing: false,
    analysisResult: null,
    analysisError: null,
    metaReflectionRequest: null
  }),
}));