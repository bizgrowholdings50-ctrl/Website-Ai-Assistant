export interface SiteConfig {
  site_id: string;
  domain: string;
  persona_name: string;
  persona_voice: string;
  welcome_message: string;
  knowledge_base: string;
  allowed_actions: string[];
  restricted_actions: string[];
  escalation_email: string;
  max_actions_per_session: number;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
}

export interface SessionMessage {
  role: 'user' | 'agent';
  type: string;
  text: string;
  ts: number;
}

export interface SessionRecord {
  session_id: string;
  user_id: string;
  messages: SessionMessage[];
  metadata: {
    duration_seconds: number;
    message_count: number;
  };
  updated_at: number;
}

export interface SiteStats {
  sessions_total: number;
  messages_text: number;
  actions_executed: number;
  audio_frames: number;
  screenshots: number;
  negotiations: number;
}
