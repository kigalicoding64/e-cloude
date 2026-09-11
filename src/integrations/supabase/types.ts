export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          org_id: string | null
          target_id: string | null
          target_name: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_name?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_name?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_deployment_events: {
        Row: {
          created_at: string
          deployment_id: string
          id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string
          deployment_id: string
          id?: string
          level?: string
          message: string
        }
        Update: {
          created_at?: string
          deployment_id?: string
          id?: string
          level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_deployment_events_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "ai_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_deployments: {
        Row: {
          container_id: string | null
          created_at: string
          error: string | null
          gpu_util: number | null
          host: string | null
          id: string
          memory_used_mb: number | null
          model_id: string
          orchestrator_id: string | null
          started_at: string | null
          status: string
          stopped_at: string | null
          tokens_per_sec: number | null
          total_tokens: number
          updated_at: string
          version_id: string | null
        }
        Insert: {
          container_id?: string | null
          created_at?: string
          error?: string | null
          gpu_util?: number | null
          host?: string | null
          id?: string
          memory_used_mb?: number | null
          model_id: string
          orchestrator_id?: string | null
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          tokens_per_sec?: number | null
          total_tokens?: number
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          container_id?: string | null
          created_at?: string
          error?: string | null
          gpu_util?: number | null
          host?: string | null
          id?: string
          memory_used_mb?: number | null
          model_id?: string
          orchestrator_id?: string | null
          started_at?: string | null
          status?: string
          stopped_at?: string | null
          tokens_per_sec?: number | null
          total_tokens?: number
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_deployments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_deployments_orchestrator_id_fkey"
            columns: ["orchestrator_id"]
            isOneToOne: false
            referencedRelation: "ai_orchestrators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_deployments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "ai_model_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_gateway_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          model_id: string | null
          name: string
          owner_id: string
          prefix: string
          quota_reset_at: string
          quota_tokens_month: number
          rate_limit_per_min: number
          revoked_at: string | null
          tokens_used_month: number
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          model_id?: string | null
          name: string
          owner_id: string
          prefix: string
          quota_reset_at?: string
          quota_tokens_month?: number
          rate_limit_per_min?: number
          revoked_at?: string | null
          tokens_used_month?: number
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          model_id?: string | null
          name?: string
          owner_id?: string
          prefix?: string
          quota_reset_at?: string
          quota_tokens_month?: number
          rate_limit_per_min?: number
          revoked_at?: string | null
          tokens_used_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_gateway_keys_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_gateway_requests: {
        Row: {
          created_at: string
          deployment_id: string | null
          error: string | null
          id: number
          key_id: string | null
          latency_ms: number | null
          model_id: string | null
          status: number
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          created_at?: string
          deployment_id?: string | null
          error?: string | null
          id?: number
          key_id?: string | null
          latency_ms?: number | null
          model_id?: string | null
          status?: number
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          created_at?: string
          deployment_id?: string | null
          error?: string | null
          id?: number
          key_id?: string | null
          latency_ms?: number | null
          model_id?: string | null
          status?: number
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_gateway_requests_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "ai_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_gateway_requests_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "ai_gateway_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_gateway_requests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_metrics: {
        Row: {
          deployment_id: string
          gpu_util: number | null
          id: number
          measured_at: string
          memory_used_mb: number | null
          tokens_per_sec: number | null
          vram_used_mb: number | null
        }
        Insert: {
          deployment_id: string
          gpu_util?: number | null
          id?: number
          measured_at?: string
          memory_used_mb?: number | null
          tokens_per_sec?: number | null
          vram_used_mb?: number | null
        }
        Update: {
          deployment_id?: string
          gpu_util?: number | null
          id?: number
          measured_at?: string
          memory_used_mb?: number | null
          tokens_per_sec?: number | null
          vram_used_mb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_metrics_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "ai_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_versions: {
        Row: {
          commit_sha: string | null
          created_at: string
          created_by: string | null
          deployment_config: Json
          git_ref: string
          id: string
          is_active: boolean
          model_id: string
          notes: string | null
          source_repo: string | null
        }
        Insert: {
          commit_sha?: string | null
          created_at?: string
          created_by?: string | null
          deployment_config?: Json
          git_ref: string
          id?: string
          is_active?: boolean
          model_id: string
          notes?: string | null
          source_repo?: string | null
        }
        Update: {
          commit_sha?: string | null
          created_at?: string
          created_by?: string | null
          deployment_config?: Json
          git_ref?: string
          id?: string
          is_active?: boolean
          model_id?: string
          notes?: string | null
          source_repo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_models: {
        Row: {
          created_at: string
          description: string | null
          endpoint_path: string | null
          framework: string | null
          gpu_type: string | null
          id: string
          memory_mb: number | null
          name: string
          owner_id: string
          slug: string
          source_ref: string | null
          source_repo: string | null
          status: string
          task: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          endpoint_path?: string | null
          framework?: string | null
          gpu_type?: string | null
          id?: string
          memory_mb?: number | null
          name: string
          owner_id: string
          slug: string
          source_ref?: string | null
          source_repo?: string | null
          status?: string
          task?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          endpoint_path?: string | null
          framework?: string | null
          gpu_type?: string | null
          id?: string
          memory_mb?: number | null
          name?: string
          owner_id?: string
          slug?: string
          source_ref?: string | null
          source_repo?: string | null
          status?: string
          task?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      ai_orchestrators: {
        Row: {
          agent_token: string | null
          base_url: string
          created_at: string
          gpu_type: string | null
          id: string
          last_heartbeat_at: string | null
          name: string
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_token?: string | null
          base_url: string
          created_at?: string
          gpu_type?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_token?: string | null
          base_url?: string
          created_at?: string
          gpu_type?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_idempotency_records: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string
          request_fingerprint: string | null
          response: Json | null
          state: string
          status: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key: string
          request_fingerprint?: string | null
          response?: Json | null
          state?: string
          status?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string
          request_fingerprint?: string | null
          response?: Json | null
          state?: string
          status?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_records_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          sources: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          sources?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          sources?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deployment_verifications: {
        Row: {
          created_at: string
          id: string
          missing_bindings: string[]
          passed: boolean
          results: Json
          trigger_source: string
        }
        Insert: {
          created_at?: string
          id?: string
          missing_bindings?: string[]
          passed?: boolean
          results?: Json
          trigger_source?: string
        }
        Update: {
          created_at?: string
          id?: string
          missing_bindings?: string[]
          passed?: boolean
          results?: Json
          trigger_source?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          is_favorite: boolean
          is_trashed: boolean
          mime_type: string | null
          name: string
          org_id: string | null
          password_hash: string | null
          pin_hash: string | null
          size: number
          storage_path: string
          trashed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          is_trashed?: boolean
          mime_type?: string | null
          name: string
          org_id?: string | null
          password_hash?: string | null
          pin_hash?: string | null
          size?: number
          storage_path: string
          trashed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          is_trashed?: boolean
          mime_type?: string | null
          name?: string
          org_id?: string | null
          password_hash?: string | null
          pin_hash?: string | null
          size?: number
          storage_path?: string
          trashed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string | null
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id?: string | null
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string | null
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          storage_quota_gb: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          storage_quota_gb?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          storage_quota_gb?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          storage_quota: number
          storage_used: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          storage_quota?: number
          storage_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      sensitive_action_grants: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          scope: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          file_id: string
          id: string
          password_hash: string | null
          permission: Database["public"]["Enums"]["share_permission"]
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          file_id: string
          id?: string
          password_hash?: string | null
          permission?: Database["public"]["Enums"]["share_permission"]
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          file_id?: string
          id?: string
          password_hash?: string | null
          permission?: Database["public"]["Enums"]["share_permission"]
          token?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_sessions: {
        Row: {
          api_key_id: string | null
          chunk_size: number
          created_at: string
          expires_at: string
          file_id: string | null
          filename: string
          folder_id: string | null
          id: string
          mime_type: string | null
          password_hash: string | null
          status: string
          storage_prefix: string
          total_chunks: number
          total_size: number
          updated_at: string
          uploaded_chunks: number[]
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          chunk_size: number
          created_at?: string
          expires_at?: string
          file_id?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          password_hash?: string | null
          status?: string
          storage_prefix: string
          total_chunks: number
          total_size: number
          updated_at?: string
          uploaded_chunks?: number[]
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          chunk_size?: number
          created_at?: string
          expires_at?: string
          file_id?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          password_hash?: string | null
          status?: string
          storage_prefix?: string
          total_chunks?: number
          total_size?: number
          updated_at?: string
          uploaded_chunks?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_sessions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_sessions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_sessions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passkeys: {
        Row: {
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_type: string | null
          id: string
          last_used_at: string | null
          name: string
          public_key: string
          transports: string[]
          user_id: string
        }
        Insert: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_type?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          public_key: string
          transports?: string[]
          user_id: string
        }
        Update: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_type?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          public_key?: string
          transports?: string[]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          app_pin_enabled: boolean
          app_pin_hash: string | null
          backup_codes_hashed: string[]
          created_at: string
          require_2fa_for_sensitive: boolean
          totp_enabled: boolean
          totp_pending_secret: string | null
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_pin_enabled?: boolean
          app_pin_hash?: string | null
          backup_codes_hashed?: string[]
          created_at?: string
          require_2fa_for_sensitive?: boolean
          totp_enabled?: boolean
          totp_pending_secret?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_pin_enabled?: boolean
          app_pin_hash?: string | null
          backup_codes_hashed?: string[]
          created_at?: string
          require_2fa_for_sensitive?: boolean
          totp_enabled?: boolean
          totp_pending_secret?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sensitive_grant: {
        Args: { _scope: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      share_permission: "view" | "download" | "edit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      share_permission: ["view", "download", "edit"],
    },
  },
} as const
