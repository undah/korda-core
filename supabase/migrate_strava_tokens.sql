create table if not exists strava_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  athlete_id bigint not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    bigint not null,
  athlete_data  jsonb,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id)
);

alter table strava_tokens enable row level security;

create policy "Users can manage own strava tokens"
  on strava_tokens for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
