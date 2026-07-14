import { supabase } from "@/integrations/supabase/client";

export type AssistantState = 
  | 'welcome' 
  | 'category_select'
  | 'awaiting_query' 
  | 'suggested_kb' 
  | 'escalating' 
  | 'escalated'
  | 'closed';

export interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user' | 'system' | 'admin';
  text: string;
  created_at: Date;
  attachments?: any[];
}

export interface KBArticle {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  trigger_phrases: string[];
  confidence_weight: number;
  suggested_response: string;
  troubleshooting_steps: string;
}

export interface AIRule {
  id: string;
  rule_name: string;
  trigger_type: 'keyword' | 'category' | 'fallback' | 'decision_tree';
  conditions: {
    keywords?: string[];
    category?: string;
    parent_node?: string;
  };
  response_text: string;
  action_type: 'respond' | 'escalate' | 'ask_followup';
  confidence_score: number;
}

// Tokenize and clean text for matching
export function tokenize(text: string): string[] {
  const stopwords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent', 'as', 'at', 
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could', 
    'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 
    'had', 'hadnt', 'has', 'hasnt', 'have', 'havent', 'having', 'he', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 
    'isnt', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 
    'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she', 'should', 
    'shouldnt', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 
    'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'were', 
    'werent', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'wont', 'would', 'you', 'your', 'yours'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.trim().length > 0 && !stopwords.has(word));
}

// Compute confidence score between user query and KB article
export function calculateConfidence(query: string, article: KBArticle): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  let keywordMatches = 0;
  const articleKeywords = article.keywords.map(k => k.toLowerCase());

  queryTokens.forEach(token => {
    if (articleKeywords.some(keyword => keyword.includes(token) || token.includes(keyword))) {
      keywordMatches++;
    }
  });

  // Calculate percentage of matching keywords
  const keywordScore = articleKeywords.length > 0 
    ? (keywordMatches / articleKeywords.length) * 0.5 
    : 0;

  // Check trigger phrase substring matching
  let phraseMatches = 0;
  const lowerQuery = query.toLowerCase();
  article.trigger_phrases.forEach(phrase => {
    const lowerPhrase = phrase.toLowerCase();
    if (lowerQuery.includes(lowerPhrase) || lowerPhrase.includes(lowerQuery)) {
      phraseMatches++;
    }
  });

  const phraseScore = article.trigger_phrases.length > 0 
    ? (phraseMatches / article.trigger_phrases.length) * 0.5 
    : 0;

  // Total score multiplied by confidence weight
  const totalScore = (keywordScore + phraseScore) * (article.confidence_weight || 1.0);
  return Math.min(1.0, totalScore);
}

// Find matching KB article based on confidence
export async function matchKBArticle(query: string, category?: string): Promise<{ article: KBArticle | null; score: number }> {
  try {
    let queryBuilder = supabase.from('support_kb_articles').select('*').eq('status', 'active');
    if (category) {
      // Prioritize same category if available
    }

    const { data: articles } = await queryBuilder;
    if (!articles || articles.length === 0) {
      return { article: null, score: 0 };
    }

    let bestArticle: KBArticle | null = null;
    let highestScore = 0;

    articles.forEach((art: any) => {
      const score = calculateConfidence(query, art);
      if (score > highestScore) {
        highestScore = score;
        bestArticle = art;
      }
    });

    return { article: bestArticle, score: highestScore };
  } catch (err) {
    console.error('Error matching KB Article:', err);
    return { article: null, score: 0 };
  }
}

// Match direct AI rules
export async function matchAIRules(query: string): Promise<{ rule: AIRule | null; response: string }> {
  try {
    const { data: rules } = await supabase.from('support_ai_rules').select('*').eq('status', 'active');
    if (!rules || rules.length === 0) {
      return { rule: null, response: '' };
    }

    const queryTokens = tokenize(query);
    let bestRule: AIRule | null = null;
    let bestMatchCount = 0;

    rules.forEach((rule: any) => {
      if (rule.trigger_type === 'keyword' && rule.conditions?.keywords) {
        const ruleKeywords = rule.conditions.keywords.map((k: string) => k.toLowerCase());
        let matches = 0;
        queryTokens.forEach(token => {
          if (ruleKeywords.includes(token)) {
            matches++;
          }
        });

        if (matches > 0 && matches > bestMatchCount) {
          bestMatchCount = matches;
          bestRule = rule;
        }
      }
    });

    if (bestRule) {
      return { rule: bestRule, response: (bestRule as AIRule).response_text };
    }

    return { rule: null, response: '' };
  } catch (err) {
    console.error('Error matching AI rules:', err);
    return { rule: null, response: '' };
  }
}

// Decision tree definitions
export interface DecisionTreeNode {
  question: string;
  options: { label: string; nextState: AssistantState; response?: string; nextNode?: string }[];
}

export const DECISION_TREE: Record<string, DecisionTreeNode> = {
  root: {
    question: "What category does your issue fall under?",
    options: [
      { label: "Login / Registration", nextState: 'category_select', nextNode: 'login_issues' },
      { label: "Tokens & Payments", nextState: 'category_select', nextNode: 'payment_issues' },
      { label: "Courses & Streaming", nextState: 'category_select', nextNode: 'course_issues' },
      { label: "Exam & Grading", nextState: 'category_select', nextNode: 'exam_issues' },
      { label: "Something else", nextState: 'awaiting_query' }
    ]
  },
  login_issues: {
    question: "What seems to be the trouble with your account?",
    options: [
      { label: "Password reset", nextState: 'awaiting_query', response: "Let me check our knowledge base for password resetting steps. Try typing 'forgot password' or describe your issue." },
      { label: "Verification mail delay", nextState: 'awaiting_query', response: "Verification emails sometimes get blocked by filters. Please search for 'verification link' or tell me details." },
      { label: "Account blocked", nextState: 'awaiting_query', response: "If your account is blocked by an admin, please type 'account suspended' or details so I can match articles or escalate." }
    ]
  },
  payment_issues: {
    question: "How can I help you with tokens or billing?",
    options: [
      { label: "Token request delay", nextState: 'awaiting_query', response: "I can check the token approval process. Try typing 'token request pending' to match details." },
      { label: "Failed payment", nextState: 'awaiting_query', response: "If your transaction failed but money was deducted, describe it or type 'payment refund'." },
      { label: "Price inquiry", nextState: 'awaiting_query', response: "For pricing questions, check our packages or ask me 'subscription plans'." }
    ]
  },
  course_issues: {
    question: "What issue are you facing with courses?",
    options: [
      { label: "Video playback buffering", nextState: 'awaiting_query', response: "For buffering and loading issues, type 'video not loading' or describe the browser/error." },
      { label: "Purchased course missing", nextState: 'awaiting_query', response: "If a course you bought is not in your library, please describe it or type 'purchased course not showing'." },
      { label: "Certificate generation", nextState: 'awaiting_query', response: "If you completed a course but can't download your certificate, search for 'certificate issue' or ask me details." }
    ]
  },
  exam_issues: {
    question: "Tell me about your test or assessment issue:",
    options: [
      { label: "Submit button blocked", nextState: 'awaiting_query', response: "If you cannot submit your assessment, describe it or type 'exam submit failed'." },
      { label: "Timer ran out", nextState: 'awaiting_query', response: "If your session ended abruptly, please explain the issue or search 'timer expired'." },
      { label: "Disputing test score", nextState: 'awaiting_query', response: "If you feel your grading is incorrect, describe it or type 'grading dispute' for help." }
    ]
  }
};
