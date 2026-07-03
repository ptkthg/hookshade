export interface IOC { type: string; value_defanged: string; value_hash: string; }
export interface Finding {
  category: string; severity: string; title: string; description: string; weight_contribution: number;
  rule_id?: string; evidence?: string;
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
export interface AuditEntry {
  id: number; action: string; actor: string | null; actor_id: number | null;
  analysis_id: number | null; detail: string; created_at: string;
}
export interface AuditPage { items: AuditEntry[]; total: number; limit: number; offset: number; }
