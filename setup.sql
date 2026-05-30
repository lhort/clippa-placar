-- Clippa Scoreboard — Supabase Setup
-- Execute no SQL Editor do seu projeto Supabase

-- Tabela principal de estado do placar
create table if not exists placar (
  sala_id integer primary key,
  state jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Inicializa as 4 quadras
insert into placar (sala_id, state) values
  (1, '{}'), (2, '{}'), (3, '{}'), (4, '{}')
on conflict do nothing;

-- Tabela de eventos da botoeira física
create table if not exists button_events (
  id bigserial primary key,
  sala_id integer not null,
  event text not null, -- 'score_a' | 'score_b' | 'undo' | 'reset'
  created_at timestamptz default now()
);

-- Habilitar realtime nas duas tabelas
alter publication supabase_realtime add table placar;
alter publication supabase_realtime add table button_events;

-- RLS: permitir leitura e escrita anônima (ajuste conforme sua necessidade)
alter table placar enable row level security;
alter table button_events enable row level security;

create policy "Leitura pública" on placar for select using (true);
create policy "Escrita pública" on placar for update using (true);

create policy "Leitura pública" on button_events for select using (true);
create policy "Inserção pública" on button_events for insert with check (true);
