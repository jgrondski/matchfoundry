import { newDb, DataType } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function setupTestDb() {
  const mem = newDb();

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  mem.public.registerFunction({
    name: 'trim',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (str: string) => (str ? str.trim() : str),
  });

  mem.public.registerFunction({
    name: 'lower',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (str: string) => (str ? str.toLowerCase() : str),
  });

  mem.public.none(`
    CREATE TABLE players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      display_name TEXT,
      nickname TEXT,
      twitch_username TEXT,
      twitch_id TEXT UNIQUE,
      country TEXT,
      avatar_type TEXT NOT NULL DEFAULT 'flag',
      avatar_url TEXT,
      avatar_thumbnail_url TEXT,
      personal_best INTEGER NOT NULL DEFAULT 0,
      playstyle TEXT,
      notes TEXT,
      is_disqualified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX players_name_lower_idx ON players (lower(trim(name)));

    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_name TEXT,
      description TEXT,
      website TEXT,
      brand_color TEXT,
      theme_colors JSONB,
      tier_themes JSONB,
      branding JSONB,
      discord_webhook_url TEXT,
      default_rules JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    INSERT INTO organizations (id, name, slug, short_name, description, brand_color)
    VALUES 
      ('org_ctwc', 'Classic Tetris World Championship', 'ctwc', 'CTWC', 'The premier global esports tournament for Classic NES Tetris.', '#ffc905'),
      ('org_ctm', 'Classic Tetris Monthly', 'ctm', 'CTM', 'The world’s largest online monthly tournament series for Classic Tetris.', '#38bdf8');

    CREATE TABLE tournaments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      qual_format TEXT NOT NULL,
      qual_average_count INTEGER,
      points_config JSONB,
      qual_mode TEXT NOT NULL DEFAULT 'HYBRID',
      qual_window_minutes INTEGER NOT NULL DEFAULT 90,
      custom_auth_words JSONB,
      quals_closed BOOLEAN NOT NULL DEFAULT false,
      online_quals_open BOOLEAN NOT NULL DEFAULT false,
      is_verified BOOLEAN NOT NULL DEFAULT false,
      admin_pin_encrypted TEXT,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE bracket_tiers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      priority_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL DEFAULT '',
      bracket_type TEXT NOT NULL,
      flat_width INTEGER,
      num_players INTEGER NOT NULL,
      primary_color TEXT NOT NULL DEFAULT '#FFD700',
      secondary_color TEXT NOT NULL DEFAULT '#000000',
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE tournament_players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      tier_id UUID REFERENCES bracket_tiers(id) ON DELETE SET NULL,
      seed INTEGER,
      quals_completed BOOLEAN NOT NULL DEFAULT false,
      is_disqualified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE qualifier_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
      score INTEGER NOT NULL,
      submission_source TEXT NOT NULL DEFAULT 'IN_PERSON',
      auth_word TEXT,
      twitch_vod_url TEXT,
      submitted_twitch_id TEXT,
      submitted_twitch_username TEXT,
      identity_status TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      timer_log JSONB,
      judge_notes TEXT,
      player_notes TEXT,
      verified_by TEXT,
      verified_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE matches (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      tier_id UUID NOT NULL REFERENCES bracket_tiers(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      match_number INTEGER,
      stage TEXT,
      round_identifier TEXT,
      player1_id UUID REFERENCES players(id) ON DELETE SET NULL,
      player2_id UUID REFERENCES players(id) ON DELETE SET NULL,
      winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
      loser_id UUID REFERENCES players(id) ON DELETE SET NULL,
      best_of INTEGER NOT NULL DEFAULT 3,
      is_forfeit BOOLEAN NOT NULL DEFAULT false,
      is_complete BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      game_number INTEGER NOT NULL,
      player1_score INTEGER NOT NULL DEFAULT 0,
      player2_score INTEGER NOT NULL DEFAULT 0,
      winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
      loser_id UUID REFERENCES players(id) ON DELETE SET NULL,
      is_intentional_topout BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT now()
    );

    CREATE TABLE system_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT now()
    );
  `);

  const pgAdapter = mem.adapters.createPg();
  const pool = new pgAdapter.Pool();

  function wrapQuery(target: any) {
    const origQuery = target.query.bind(target);
    target.query = (queryTextOrConfig: any, ...args: any[]) => {
      let isRowModeArray = false;
      if (queryTextOrConfig && typeof queryTextOrConfig === 'object') {
        if (queryTextOrConfig.rowMode === 'array') {
          isRowModeArray = true;
          delete queryTextOrConfig.rowMode;
        }
        delete queryTextOrConfig.types;
      }

      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;

      const transformRes = (res: any) => {
        if (!res) return res;
        if (isRowModeArray && Array.isArray(res.rows)) {
          if (res.rows.length > 0 && !Array.isArray(res.rows[0])) {
            const hasFields = Array.isArray(res.fields) && res.fields.length > 0;
            const fieldNames = hasFields
              ? res.fields.map((f: any) => f.name)
              : Object.keys(res.rows[0]);
            const mappedRows = res.rows.map((row: any) =>
              Array.isArray(row) ? row : fieldNames.map((name: string) => row[name])
            );
            return {
              ...res,
              rows: mappedRows,
              fields: hasFields ? res.fields : fieldNames.map((name: string) => ({ name })),
            };
          }
        }
        return res;
      };

      if (callback) {
        return (origQuery as any)(queryTextOrConfig, ...args, (err: any, res: any) => {
          if (!err) transformRes(res);
          callback(err, res);
        });
      }

      const result = (origQuery as any)(queryTextOrConfig, ...args);
      if (result && typeof result.then === 'function') {
        return result.then((res: any) => transformRes(res));
      }
      return transformRes(result);
    };
  }

  wrapQuery(pool);
  const origConnect = pool.connect.bind(pool);
  pool.connect = async (...args: any[]) => {
    const client = await (origConnect as any)(...args);
    wrapQuery(client);
    return client;
  };

  const db = drizzle(pool, { schema });
  return { db, mem, pool };
}
