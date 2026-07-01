export interface IOC { type: string; value_defanged: string; value_hash: string; }
export interface Finding {
  category: string; severity: string; title: string; description: string; weight_contribution: number;
}
export interface Recommendation { priority: string; action_type: string; description: string; }
export interface AnalysisSummary {
  id: number; source_type: string; severity: string; risk_score: number;
  confidence: string; summary: string; created_at: string;
}
export interface AnalysisDetail extends AnalysisSummary {
  parsed_headers: Record<string, string>;
  iocs: IOC[]; findings: Finding[]; recommendations: Recommendation[];
}
