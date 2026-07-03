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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
          revoked_at: string | null
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
          revoked_at?: string | null
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
          revoked_at?: string | null
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
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
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
          user_id?: string
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
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
