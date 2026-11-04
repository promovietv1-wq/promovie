-- PromoVie | Cadastro administrativo. Sem dados clínicos.
-- Executar no banco D1 remoto somente após criar e associar a base.
CREATE TABLE IF NOT EXISTS pv_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pv_sessions_exp ON pv_admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS pv_admin_login_attempts (
  actor_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pv_beneficiarios (
  id TEXT PRIMARY KEY,
  cpf_index TEXT NOT NULL UNIQUE,
  cpf_hint TEXT NOT NULL,
  dados_criptografados TEXT NOT NULL,
  situacao TEXT NOT NULL DEFAULT 'rascunho'
    CHECK(situacao IN ('rascunho','enviado','ativo','arquivado')),
  situacao_anterior TEXT,
  plano TEXT NOT NULL DEFAULT '345',
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  enviado_em TEXT,
  arquivado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_pv_beneficiarios_situacao ON pv_beneficiarios(situacao);

CREATE TABLE IF NOT EXISTS pv_historico (
  id TEXT PRIMARY KEY,
  beneficiario_id TEXT NOT NULL,
  evento TEXT NOT NULL,
  registrado_em TEXT NOT NULL,
  detalhes TEXT,
  FOREIGN KEY (beneficiario_id) REFERENCES pv_beneficiarios(id)
);
CREATE INDEX IF NOT EXISTS idx_pv_historico_ref ON pv_historico(beneficiario_id,registrado_em);
