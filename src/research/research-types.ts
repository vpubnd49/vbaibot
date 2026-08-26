export type ResearchSource =
  | "wikipedia"
  | "arxiv"
  | "semantic_scholar"
  | "crossref"
  | "pubmed"
  | "github"
  | "stackoverflow"
  | "hacker_news";

export type PublicationStatus =
  | "preprint"
  | "published"
  | "peer_review_evidence_found"
  | "unknown";

export type ResearchResult = {
  source: ResearchSource;
  title: string;
  url: string;
  summary: string;
  authors?: string[];
  publishedAt?: string;
  updatedAt?: string;
  identifiers?: {
    doi?: string;
    arxivId?: string;
    pmid?: string;
    githubFullName?: string;
    stackoverflowQuestionId?: string;
    hackerNewsObjectId?: string;
  };
  metrics?: {
    citations?: number;
    stars?: number;
    forks?: number;
    score?: number;
    comments?: number;
  };
  publicationStatus: PublicationStatus;
  license?: string;
  retrievedAt: string;
};

export type KnowledgeResearchQuery = {
  query: string;
  source?: "auto" | "wikipedia" | "arxiv" | "semantic_scholar" | "crossref" | "pubmed";
  mode?: "auto" | "keyword" | "identifier";
  limit?: number;
  language?: "auto" | "vi" | "en";
};

export type DeveloperResearchQuery = {
  query: string;
  source?: "auto" | "github" | "stackoverflow" | "hacker_news";
  kind?: "auto" | "repository" | "issue" | "discussion" | "question" | "story";
  limit?: number;
};
