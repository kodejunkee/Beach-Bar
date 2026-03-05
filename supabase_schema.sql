-- ==========================================
-- Master Schema: Beach Bar App
-- ==========================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles & Auth
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  exp INTEGER DEFAULT 0 NOT NULL,
  gold INTEGER DEFAULT 0 NOT NULL,
  diamonds INTEGER DEFAULT 0 NOT NULL,
  rp INTEGER DEFAULT 0,
  current_rank TEXT DEFAULT 'Bronze V',
  peak_rank TEXT DEFAULT 'Bronze V',
  highest_rp INTEGER DEFAULT 0,
  ranked_wins INTEGER DEFAULT 0,
  ranked_losses INTEGER DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." 
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own username." ON public.profiles;
CREATE POLICY "Users can update their own username." 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', 'Player'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Economy & Customization (Shop)
CREATE TABLE IF NOT EXISTS public.shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'avatar_frame'
    cost_type TEXT NOT NULL CHECK (cost_type IN ('gold', 'diamonds')),
    cost_amount INTEGER NOT NULL DEFAULT 0,
    asset_url TEXT NOT NULL
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop items are viewable by everyone." ON public.shop_items;
CREATE POLICY "Shop items are viewable by everyone." ON public.shop_items FOR SELECT USING (true);

-- Add equipped_frame to profiles if not already there
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_frame UUID REFERENCES public.shop_items(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, item_id)
);

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inventory." ON public.user_inventory;
CREATE POLICY "Users can view own inventory." ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION purchase_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost_type TEXT;
    v_cost_amount INTEGER;
    v_user_gold INTEGER;
    v_user_diamonds INTEGER;
    v_already_owns BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN '{"success": false, "error": "Not authenticated"}'::jsonb;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = v_user_id AND item_id = p_item_id) INTO v_already_owns;
    IF v_already_owns THEN RETURN '{"success": false, "error": "Item already owned"}'::jsonb; END IF;

    SELECT cost_type, cost_amount INTO v_cost_type, v_cost_amount FROM public.shop_items WHERE id = p_item_id;
    IF NOT FOUND THEN RETURN '{"success": false, "error": "Item not found"}'::jsonb; END IF;

    SELECT gold, diamonds INTO v_user_gold, v_user_diamonds FROM public.profiles WHERE id = v_user_id;

    IF v_cost_type = 'gold' AND v_user_gold < v_cost_amount THEN
        RETURN '{"success": false, "error": "Not enough gold"}'::jsonb;
    ELSIF v_cost_type = 'diamonds' AND v_user_diamonds < v_cost_amount THEN
        RETURN '{"success": false, "error": "Not enough diamonds"}'::jsonb;
    END IF;

    IF v_cost_type = 'gold' THEN
        UPDATE public.profiles SET gold = gold - v_cost_amount WHERE id = v_user_id;
    ELSE
        UPDATE public.profiles SET diamonds = diamonds - v_cost_amount WHERE id = v_user_id;
    END IF;

    INSERT INTO public.user_inventory (user_id, item_id) VALUES (v_user_id, p_item_id);
    RETURN '{"success": true}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION equip_frame(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_owns BOOLEAN;
    v_item_type TEXT;
BEGIN
    IF v_user_id IS NULL THEN RETURN '{"success": false, "error": "Not authenticated"}'::jsonb; END IF;

    IF p_item_id IS NULL THEN
        UPDATE public.profiles SET equipped_frame = NULL WHERE id = v_user_id;
        RETURN '{"success": true}'::jsonb;
    END IF;

    SELECT type INTO v_item_type FROM public.shop_items WHERE id = p_item_id;
    IF v_item_type != 'avatar_frame' THEN RETURN '{"success": false, "error": "Item is not an avatar frame"}'::jsonb; END IF;

    SELECT EXISTS (SELECT 1 FROM public.user_inventory WHERE user_id = v_user_id AND item_id = p_item_id) INTO v_owns;
    IF NOT v_owns THEN RETURN '{"success": false, "error": "You do not own this item"}'::jsonb; END IF;

    UPDATE public.profiles SET equipped_frame = p_item_id WHERE id = v_user_id;
    RETURN '{"success": true}'::jsonb;
END;
$$;

-- Seed Shop Items
INSERT INTO public.shop_items (name, type, cost_type, cost_amount, asset_url)
VALUES 
    ('Golden Frame', 'avatar_frame', 'gold', 50, '🟨'),
    ('Diamond Frame', 'avatar_frame', 'diamonds', 10, '💎'),
    ('Fire Frame', 'avatar_frame', 'gold', 150, '🔥'),
    ('Ocean Frame', 'avatar_frame', 'gold', 100, '🌊')
ON CONFLICT DO NOTHING;


-- 3. Social (Friendships)
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, friend_id),
    CONSTRAINT different_users CHECK (user_id <> friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE OR REPLACE FUNCTION public.send_friend_request(target_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sender_id UUID := auth.uid();
    target_id UUID;
    existing_status TEXT;
BEGIN
    SELECT id INTO target_id FROM public.profiles WHERE username = target_username;
    IF target_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
    IF target_id = sender_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot add yourself'); END IF;

    SELECT status INTO existing_status FROM public.friendships 
    WHERE (user_id = sender_id AND friend_id = target_id) OR (user_id = target_id AND friend_id = sender_id);

    IF existing_status IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Friendship already exists or pending: ' || existing_status);
    END IF;

    INSERT INTO public.friendships (user_id, friend_id, status) VALUES (sender_id, target_id, 'pending');
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_friend_request(request_id UUID, action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_uid UUID := auth.uid();
    request_record RECORD;
BEGIN
    SELECT * INTO request_record FROM public.friendships WHERE id = request_id AND friend_id = current_uid AND status = 'pending';
    IF request_record IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Request not found or not authorized'); END IF;

    IF action = 'accepted' THEN
        UPDATE public.friendships SET status = 'accepted' WHERE id = request_id;
        RETURN jsonb_build_object('success', true);
    ELSIF action = 'declined' THEN
        DELETE FROM public.friendships WHERE id = request_id;
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
    END IF;
END;
$$;


-- 4. Progression (Monthly Pass & Quests)
CREATE TABLE IF NOT EXISTS public.monthly_pass_levels (
    level INTEGER PRIMARY KEY,
    exp_required INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    reward_amount INTEGER DEFAULT 0,
    reward_item_id UUID REFERENCES public.shop_items(id)
);

CREATE TABLE IF NOT EXISTS public.daily_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    objective_type TEXT NOT NULL,
    objective_count INTEGER NOT NULL,
    exp_reward INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_quest_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    quest_id UUID REFERENCES public.daily_quests(id) ON DELETE CASCADE NOT NULL,
    current_count INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, quest_id)
);

CREATE TABLE IF NOT EXISTS public.user_monthly_pass (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_exp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    last_claimed_level INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.monthly_pass_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_pass ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Monthly pass levels are viewable by everyone" ON public.monthly_pass_levels;
CREATE POLICY "Monthly pass levels are viewable by everyone" ON public.monthly_pass_levels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Daily quests are viewable by everyone" ON public.daily_quests;
CREATE POLICY "Daily quests are viewable by everyone" ON public.daily_quests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own quest progress" ON public.user_quest_progress;
CREATE POLICY "Users can view their own quest progress" ON public.user_quest_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own monthly pass" ON public.user_monthly_pass;
CREATE POLICY "Users can view their own monthly pass" ON public.user_monthly_pass FOR SELECT USING (auth.uid() = user_id);

-- Seed Data
INSERT INTO public.monthly_pass_levels (level, exp_required, reward_type, reward_amount)
VALUES (1, 0, 'gold', 100), (2, 500, 'diamonds', 5), (3, 1000, 'gold', 250), (4, 1500, 'diamonds', 10), (5, 2000, 'gold', 500)
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_quests (name, description, objective_type, objective_count, exp_reward)
VALUES 
    ('First Splash', 'Play 1 match in any mode', 'play_game', 1, 100),
    ('Master Mixer', 'Win 1 match of Beach Bar', 'win_game', 1, 200),
    ('Big Spender', 'Spend 50 Gold in the Shop', 'spend_gold', 50, 150)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_pass_reward(target_level INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_uid UUID := auth.uid();
    pass_record RECORD;
    level_record RECORD;
BEGIN
    SELECT * INTO pass_record FROM public.user_monthly_pass WHERE user_id = current_uid;
    IF pass_record IS NULL THEN INSERT INTO public.user_monthly_pass (user_id) VALUES (current_uid) RETURNING * INTO pass_record; END IF;

    IF target_level > pass_record.current_level THEN RETURN jsonb_build_object('success', false, 'error', 'Level not reached yet'); END IF;
    IF target_level <= pass_record.last_claimed_level THEN RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed'); END IF;

    SELECT * INTO level_record FROM public.monthly_pass_levels WHERE level = target_level;
    IF level_record IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Level data not found'); END IF;

    IF level_record.reward_type = 'gold' THEN UPDATE public.profiles SET gold = gold + level_record.reward_amount WHERE id = current_uid;
    ELSIF level_record.reward_type = 'diamonds' THEN UPDATE public.profiles SET diamonds = diamonds + level_record.reward_amount WHERE id = current_uid;
    ELSIF level_record.reward_type = 'item' THEN INSERT INTO public.user_inventory (user_id, item_id) VALUES (current_uid, level_record.reward_item_id) ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.user_monthly_pass SET last_claimed_level = target_level WHERE user_id = current_uid;
    RETURN jsonb_build_object('success', true);
END;
$$;


-- 5. Competitive & Ranked
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_season_idx ON public.seasons (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.season_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
    final_rp INTEGER NOT NULL,
    final_rank TEXT NOT NULL,
    peak_rank TEXT NOT NULL,
    ranked_wins INTEGER NOT NULL,
    ranked_losses INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, season_id)
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seasons are viewable by everyone." ON public.seasons;
CREATE POLICY "Seasons are viewable by everyone." ON public.seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "History viewable by everyone." ON public.season_history;
CREATE POLICY "History viewable by everyone." ON public.season_history FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION get_rank_from_rp(rp_val INTEGER)
RETURNS TEXT AS $$
DECLARE
    sub_tier TEXT;
    remainder INTEGER;
BEGIN
    IF rp_val < 500 THEN
        remainder := rp_val % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'Bronze ' || sub_tier;
    ELSIF rp_val < 1000 THEN
        remainder := (rp_val - 500) % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'Silver ' || sub_tier;
    ELSIF rp_val < 1500 THEN
        remainder := (rp_val - 1000) % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'Gold ' || sub_tier;
    ELSIF rp_val < 2000 THEN
        remainder := (rp_val - 1500) % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'Platinum ' || sub_tier;
    ELSIF rp_val < 2500 THEN
        remainder := (rp_val - 2000) % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'Diamond ' || sub_tier;
    ELSIF rp_val < 3000 THEN
        remainder := (rp_val - 2500) % 500;
        sub_tier := CASE 
            WHEN remainder < 100 THEN 'V'
            WHEN remainder < 200 THEN 'IV'
            WHEN remainder < 300 THEN 'III'
            WHEN remainder < 400 THEN 'II'
            ELSE 'I'
        END;
        RETURN 'GrandMaster ' || sub_tier;
    ELSE
        RETURN 'Legendary';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION end_season_and_reset(new_season_name TEXT) 
RETURNS jsonb AS $$
DECLARE
    current_season_id UUID;
    rec RECORD;
    new_rp INTEGER;
    new_rank TEXT;
BEGIN
    SELECT id INTO current_season_id FROM public.seasons WHERE is_active = true LIMIT 1;
    IF current_season_id IS NOT NULL THEN
        INSERT INTO public.season_history (user_id, season_id, final_rp, final_rank, peak_rank, ranked_wins, ranked_losses)
        SELECT id, current_season_id, rp, current_rank, peak_rank, ranked_wins, ranked_losses FROM public.profiles;
        UPDATE public.seasons SET is_active = false, end_date = NOW() WHERE id = current_season_id;
    END IF;

    INSERT INTO public.seasons (name, is_active) VALUES (new_season_name, true);

    FOR rec IN SELECT id, rp FROM public.profiles LOOP
        IF rec.rp >= 2000 THEN new_rp := 1000;
        ELSIF rec.rp >= 1000 THEN new_rp := 500;
        ELSE new_rp := 0;
        END IF;

        new_rank := get_rank_from_rp(new_rp);
        UPDATE public.profiles SET rp = new_rp, current_rank = new_rank, ranked_wins = 0, ranked_losses = 0 WHERE id = rec.id;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Season ended, archived, and soft reset applied.');
END;
$$ LANGUAGE plpgsql;

INSERT INTO public.seasons (name, is_active) VALUES ('Pre-Season', true) ON CONFLICT DO NOTHING;
