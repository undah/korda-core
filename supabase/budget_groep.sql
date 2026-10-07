-- supabase/budget_groep.sql — needs / wants / saving per pot (the 50/30/20 split).
-- Run after budget_gedeeld.sql. Safe to run twice.

alter table public.budget_pots add column if not exists groep text
  check (groep in ('nodig', 'wil', 'sparen'));

-- A first guess for existing pots, from their name; only where nothing is set.
-- Anything it can't place stays empty and the app asks.
update public.budget_pots set groep = 'sparen'
  where groep is null and name ~* '(spaar|sparen|aflos|lening|schuld|beleg|buffer|pensioen)';
update public.budget_pots set groep = 'nodig'
  where groep is null and (
    kind = 'vast'
    or name ~* '(hypotheek|huur|boodschap|vervoer|benzine|tank|auto|ov\b|zorg|verzeker|energie|gas|water|internet|telefoon|gemeente|belasting|kinderopvang|school|apotheek|huis)'
  );
update public.budget_pots set groep = 'wil'
  where groep is null and name ~* '(uit eten|eten|restaurant|kleding|kleren|cadeau|hobby|vakantie|uitje|sport|gym|fitness|streaming|abonnement|games|leuk|shoppen|feest|beauty|kapper)';
