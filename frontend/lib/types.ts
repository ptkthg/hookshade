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

export interface CurrentUser { id: number; name: string; email: string; role: string; }

export interface AdminUser {
  id: number; name: string; email: string; role: string; status: string;
  created_at: string; last_login_at: string | null;
}

export interface Rule {
  id: number;
  name: string;
  description: string;
  category: string;
  severity: string;
  condition: Record<string, unknown>;
  status: string;            // active | inactive | deleted
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RuleChange {
  id: number;
  version: number;
  action: string;            // create | update | activate | deactivate | delete
  severity_snapshot: string;
  justification: string;
  changed_by: number | null;
  changed_at: string;
}

export interface RuleTestResult {
  fired: boolean;
  evidence: string;
  severity: string;
  score_delta: number;
  current_score: number;
  predicted_score: number;
  current_severity: string;
  predicted_severity: string;
}

export interface RuleInput {
  name: string;
  description: string;
  category: string;
  severity: string;
  condition: Record<string, unknown>;
  justification: string;
}
