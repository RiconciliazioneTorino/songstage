/**
 * Generated from the live database schema — do not edit by hand.
 *
 *   npm run db:types
 *
 * Requires SUPABASE_DB_URL in app/.env.local. Re-run it after adding a
 * migration, otherwise the client types drift from what the database
 * actually accepts.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      arrangements: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          notation_data: NonNullable<Json>;
          scope: Database["public"]["Enums"]["variation_scope"];
          scope_band_id: string | null;
          scope_church_id: string | null;
          scope_user_id: string | null;
          song_id: string;
          type: Database["public"]["Enums"]["arrangement_type"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          notation_data: NonNullable<Json>;
          scope: Database["public"]["Enums"]["variation_scope"];
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
          song_id: string;
          type: Database["public"]["Enums"]["arrangement_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          notation_data?: NonNullable<Json>;
          scope?: Database["public"]["Enums"]["variation_scope"];
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
          song_id?: string;
          type?: Database["public"]["Enums"]["arrangement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "arrangements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "arrangements_scope_band_id_fkey";
            columns: ["scope_band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "arrangements_scope_church_id_fkey";
            columns: ["scope_church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "arrangements_scope_user_id_fkey";
            columns: ["scope_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "arrangements_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      audio_attachments: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["audio_kind"];
          metadata: NonNullable<Json>;
          song_id: string | null;
          storage_path: string | null;
          url: string | null;
          variation_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["audio_kind"];
          metadata?: NonNullable<Json>;
          song_id?: string | null;
          storage_path?: string | null;
          url?: string | null;
          variation_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["audio_kind"];
          metadata?: NonNullable<Json>;
          song_id?: string | null;
          storage_path?: string | null;
          url?: string | null;
          variation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audio_attachments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_attachments_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audio_attachments_variation_id_fkey";
            columns: ["variation_id"];
            isOneToOne: false;
            referencedRelation: "song_variations";
            referencedColumns: ["id"];
          },
        ];
      };
      band_members: {
        Row: {
          band_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          band_id: string;
          user_id: string;
        };
        Update: {
          band_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "band_members_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "band_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      bands: {
        Row: {
          church_id: string;
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          church_id: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          church_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bands_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
        ];
      };
      chord_definitions: {
        Row: {
          chord_name: string;
          created_at: string;
          created_by: string | null;
          fingering_data: NonNullable<Json>;
          id: string;
          instrument: Database["public"]["Enums"]["instrument"];
          is_default: boolean;
          scope: Database["public"]["Enums"]["variation_scope"] | null;
          scope_band_id: string | null;
          scope_church_id: string | null;
          scope_user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          chord_name: string;
          created_at?: string;
          created_by?: string | null;
          fingering_data: NonNullable<Json>;
          id?: string;
          instrument: Database["public"]["Enums"]["instrument"];
          is_default?: boolean;
          scope?: Database["public"]["Enums"]["variation_scope"] | null;
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
        };
        Update: {
          chord_name?: string;
          created_at?: string;
          created_by?: string | null;
          fingering_data?: NonNullable<Json>;
          id?: string;
          instrument?: Database["public"]["Enums"]["instrument"];
          is_default?: boolean;
          scope?: Database["public"]["Enums"]["variation_scope"] | null;
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chord_definitions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chord_definitions_scope_band_id_fkey";
            columns: ["scope_band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chord_definitions_scope_church_id_fkey";
            columns: ["scope_church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chord_definitions_scope_user_id_fkey";
            columns: ["scope_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      church_invitations: {
        Row: {
          church_id: string;
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          role: Database["public"]["Enums"]["church_role"];
        };
        ComputedFields: never;
        Insert: {
          church_id: string;
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: string;
          role?: Database["public"]["Enums"]["church_role"];
        };
        Update: {
          church_id?: string;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          role?: Database["public"]["Enums"]["church_role"];
        };
        Relationships: [
          {
            foreignKeyName: "church_invitations_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "church_invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      church_members: {
        Row: {
          church_id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["church_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          church_id: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["church_role"];
          user_id: string;
        };
        Update: {
          church_id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["church_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "church_members_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "church_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      churches: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "churches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      projection_sessions: {
        Row: {
          current_set_item_id: string | null;
          ended_at: string | null;
          font_scale: number;
          id: string;
          master_user_id: string;
          scroll_percent: number;
          set_id: string;
          show_chords: boolean;
          started_at: string;
          transpose_override: number | null;
        };
        ComputedFields: never;
        Insert: {
          current_set_item_id?: string | null;
          ended_at?: string | null;
          font_scale?: number;
          id?: string;
          master_user_id: string;
          scroll_percent?: number;
          set_id: string;
          show_chords?: boolean;
          started_at?: string;
          transpose_override?: number | null;
        };
        Update: {
          current_set_item_id?: string | null;
          ended_at?: string | null;
          font_scale?: number;
          id?: string;
          master_user_id?: string;
          scroll_percent?: number;
          set_id?: string;
          show_chords?: boolean;
          started_at?: string;
          transpose_override?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "projection_sessions_current_set_item_id_fkey";
            columns: ["current_set_item_id"];
            isOneToOne: false;
            referencedRelation: "set_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projection_sessions_master_user_id_fkey";
            columns: ["master_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projection_sessions_set_id_fkey";
            columns: ["set_id"];
            isOneToOne: false;
            referencedRelation: "sets";
            referencedColumns: ["id"];
          },
        ];
      };
      set_band_shares: {
        Row: {
          band_id: string;
          permission: Database["public"]["Enums"]["set_permission"];
          set_id: string;
          shared_at: string;
        };
        ComputedFields: never;
        Insert: {
          band_id: string;
          permission?: Database["public"]["Enums"]["set_permission"];
          set_id: string;
          shared_at?: string;
        };
        Update: {
          band_id?: string;
          permission?: Database["public"]["Enums"]["set_permission"];
          set_id?: string;
          shared_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "set_band_shares_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_band_shares_set_id_fkey";
            columns: ["set_id"];
            isOneToOne: false;
            referencedRelation: "sets";
            referencedColumns: ["id"];
          },
        ];
      };
      set_items: {
        Row: {
          capo: number;
          id: string;
          performance_notes: string | null;
          position: number;
          set_id: string;
          song_id: string;
          transpose_semitones: number;
          variation_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          capo?: number;
          id?: string;
          performance_notes?: string | null;
          position: number;
          set_id: string;
          song_id: string;
          transpose_semitones?: number;
          variation_id?: string | null;
        };
        Update: {
          capo?: number;
          id?: string;
          performance_notes?: string | null;
          position?: number;
          set_id?: string;
          song_id?: string;
          transpose_semitones?: number;
          variation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "set_items_set_id_fkey";
            columns: ["set_id"];
            isOneToOne: false;
            referencedRelation: "sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_items_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_items_variation_id_fkey";
            columns: ["variation_id"];
            isOneToOne: false;
            referencedRelation: "song_variations";
            referencedColumns: ["id"];
          },
        ];
      };
      set_shares: {
        Row: {
          permission: Database["public"]["Enums"]["set_permission"];
          set_id: string;
          shared_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          permission?: Database["public"]["Enums"]["set_permission"];
          set_id: string;
          shared_at?: string;
          user_id: string;
        };
        Update: {
          permission?: Database["public"]["Enums"]["set_permission"];
          set_id?: string;
          shared_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "set_shares_set_id_fkey";
            columns: ["set_id"];
            isOneToOne: false;
            referencedRelation: "sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sets: {
        Row: {
          active_master_heartbeat_at: string | null;
          active_master_user_id: string | null;
          church_id: string;
          created_at: string;
          created_by: string;
          event_date: string | null;
          event_type: string | null;
          id: string;
          name: string;
          notes: string | null;
        };
        ComputedFields: never;
        Insert: {
          active_master_heartbeat_at?: string | null;
          active_master_user_id?: string | null;
          church_id: string;
          created_at?: string;
          created_by: string;
          event_date?: string | null;
          event_type?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
        };
        Update: {
          active_master_heartbeat_at?: string | null;
          active_master_user_id?: string | null;
          church_id?: string;
          created_at?: string;
          created_by?: string;
          event_date?: string | null;
          event_type?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sets_active_master_user_id_fkey";
            columns: ["active_master_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sets_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      song_variations: {
        Row: {
          body_onsong: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          parent_variation_id: string | null;
          scope: Database["public"]["Enums"]["variation_scope"];
          scope_band_id: string | null;
          scope_church_id: string | null;
          scope_user_id: string | null;
          song_id: string;
        };
        ComputedFields: never;
        Insert: {
          body_onsong: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          parent_variation_id?: string | null;
          scope: Database["public"]["Enums"]["variation_scope"];
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
          song_id: string;
        };
        Update: {
          body_onsong?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          parent_variation_id?: string | null;
          scope?: Database["public"]["Enums"]["variation_scope"];
          scope_band_id?: string | null;
          scope_church_id?: string | null;
          scope_user_id?: string | null;
          song_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_variations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_variations_parent_variation_id_fkey";
            columns: ["parent_variation_id"];
            isOneToOne: false;
            referencedRelation: "song_variations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_variations_scope_band_id_fkey";
            columns: ["scope_band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_variations_scope_church_id_fkey";
            columns: ["scope_church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_variations_scope_user_id_fkey";
            columns: ["scope_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_variations_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      song_versions: {
        Row: {
          body_onsong: string;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          song_id: string;
          version_number: number;
        };
        ComputedFields: never;
        Insert: {
          body_onsong: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          song_id: string;
          version_number: number;
        };
        Update: {
          body_onsong?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          song_id?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "song_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_versions_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      songs: {
        Row: {
          artist: string | null;
          ccli: string | null;
          church_id: string | null;
          created_at: string;
          created_by: string | null;
          current_version_id: string | null;
          default_tempo: number | null;
          id: string;
          language: string | null;
          original_key: string | null;
          parent_song_id: string | null;
          time_signature: string | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          artist?: string | null;
          ccli?: string | null;
          church_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          default_tempo?: number | null;
          id?: string;
          language?: string | null;
          original_key?: string | null;
          parent_song_id?: string | null;
          time_signature?: string | null;
          title: string;
        };
        Update: {
          artist?: string | null;
          ccli?: string | null;
          church_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          default_tempo?: number | null;
          id?: string;
          language?: string | null;
          original_key?: string | null;
          parent_song_id?: string | null;
          time_signature?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "songs_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "songs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "songs_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "song_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "songs_parent_song_id_fkey";
            columns: ["parent_song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          is_curator: boolean;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email: string;
          id: string;
          is_curator?: boolean;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          is_curator?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_see_user: { Args: { p_user_id: string }; Returns: boolean };
      can_write_set_shared: { Args: { p_set_id: string }; Returns: boolean };
      consume_church_invitations: { Args: { p_email: string; p_user_id: string }; Returns: number };
      create_church_with_admin: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          id: string;
          name: string;
          slug: string;
        }[];
      };
      find_shareable_user: { Args: { p_email: string; p_set_id: string }; Returns: string };
      has_church_role: {
        Args: { p_church_id: string; p_roles: Database["public"]["Enums"]["church_role"][] };
        Returns: boolean;
      };
      heartbeat_set_master: { Args: { p_set_id: string }; Returns: undefined };
      reorder_set_items: {
        Args: { p_item_ids: string[]; p_set_id: string };
        Returns: undefined;
      };
      invite_church_member: {
        Args: {
          p_church_id: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["church_role"];
        };
        Returns: {
          added: boolean;
          invited: boolean;
        }[];
      };
      is_band_member: { Args: { p_band_id: string }; Returns: boolean };
      is_church_member: { Args: { p_church_id: string }; Returns: boolean };
      is_curator: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_set_shared_with_me: { Args: { p_set_id: string }; Returns: boolean };
      release_set_master: { Args: { p_set_id: string }; Returns: undefined };
      search_users_for_church: {
        Args: { p_church_id: string; p_query: string };
        Returns: {
          display_name: string;
          email: string;
          id: string;
        }[];
      };
      set_owner_or_church_lead: { Args: { p_set_id: string }; Returns: boolean };
    };
    Enums: {
      arrangement_type: "intro" | "riff" | "bassline" | "solo" | "outro" | "turnaround";
      audio_kind: "mp3_upload" | "youtube" | "spotify" | "amazon" | "soundcloud" | "other";
      church_role: "admin" | "director" | "musico" | "lector";
      instrument: "guitar" | "piano" | "ukulele" | "bass" | "mandolin";
      set_permission: "read" | "read_write";
      variation_scope: "church" | "band" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      arrangement_type: ["intro", "riff", "bassline", "solo", "outro", "turnaround"],
      audio_kind: ["mp3_upload", "youtube", "spotify", "amazon", "soundcloud", "other"],
      church_role: ["admin", "director", "musico", "lector"],
      instrument: ["guitar", "piano", "ukulele", "bass", "mandolin"],
      set_permission: ["read", "read_write"],
      variation_scope: ["church", "band", "user"],
    },
  },
} as const;
