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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_audit_log: {
        Row: {
          action_id: string
          action_name: string | null
          changes: Json | null
          created_at: string
          id: string
          operation: string
          record_id: string | null
          table_name: string
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action_id: string
          action_name?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          operation: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action_id?: string
          action_name?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          operation?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_audit_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          expected_revenue: number
          gross_profit: number
          id: string
          margin_percent: number
          name: string
          paid_count: number
          pending_count: number
          previous_status: Database["public"]["Enums"]["action_status"] | null
          quota_count: number
          quota_value: number
          real_paid: number
          start_date: string | null
          status: Database["public"]["Enums"]["action_status"]
          tax_percent: number
          total_cost: number
          total_operational: number
          total_prizes: number
          total_taxes: number
          updated_at: string
          winners_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_revenue?: number
          gross_profit?: number
          id?: string
          margin_percent?: number
          name: string
          paid_count?: number
          pending_count?: number
          previous_status?: Database["public"]["Enums"]["action_status"] | null
          quota_count?: number
          quota_value?: number
          real_paid?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tax_percent?: number
          total_cost?: number
          total_operational?: number
          total_prizes?: number
          total_taxes?: number
          updated_at?: string
          winners_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_revenue?: number
          gross_profit?: number
          id?: string
          margin_percent?: number
          name?: string
          paid_count?: number
          pending_count?: number
          previous_status?: Database["public"]["Enums"]["action_status"] | null
          quota_count?: number
          quota_value?: number
          real_paid?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          tax_percent?: number
          total_cost?: number
          total_operational?: number
          total_prizes?: number
          total_taxes?: number
          updated_at?: string
          winners_count?: number
        }
        Relationships: []
      }
      cost_type_configs: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      costs: {
        Row: {
          action_id: string
          category: Database["public"]["Enums"]["cost_category"]
          cost_type_config_id: string | null
          created_at: string
          description: string
          id: string
          quantity: number
          unit_value: number
          updated_at: string
          value: number
        }
        Insert: {
          action_id: string
          category: Database["public"]["Enums"]["cost_category"]
          cost_type_config_id?: string | null
          created_at?: string
          description: string
          id?: string
          quantity?: number
          unit_value?: number
          updated_at?: string
          value?: number
        }
        Update: {
          action_id?: string
          category?: Database["public"]["Enums"]["cost_category"]
          cost_type_config_id?: string | null
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          unit_value?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "costs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_cost_type_config_id_fkey"
            columns: ["cost_type_config_id"]
            isOneToOne: false
            referencedRelation: "cost_type_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          action_id: string
          created_at: string
          file_name: string | null
          file_type: string
          id: string
          total_duplicates: number
          total_found: number
          total_imported: number
          total_invalid: number
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action_id: string
          created_at?: string
          file_name?: string | null
          file_type: string
          id?: string
          total_duplicates?: number
          total_found?: number
          total_imported?: number
          total_invalid?: number
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action_id?: string
          created_at?: string
          file_name?: string | null
          file_type?: string
          id?: string
          total_duplicates?: number
          total_found?: number
          total_imported?: number
          total_invalid?: number
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          description: string | null
          id: string
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      pix_batches: {
        Row: {
          action_id: string
          created_at: string
          filename: string | null
          generated_at: string
          generated_by: string | null
          id: string
          total_value: number
          winner_count: number
        }
        Insert: {
          action_id: string
          created_at?: string
          filename?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          total_value?: number
          winner_count?: number
        }
        Update: {
          action_id?: string
          created_at?: string
          filename?: string | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          total_value?: number
          winner_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_batches_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_type_configs: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      prizes: {
        Row: {
          action_id: string
          created_at: string
          description: string | null
          id: string
          item_status: string
          prize_type_config_id: string | null
          quantity: number
          title: string
          total_value: number
          type: Database["public"]["Enums"]["prize_type"]
          unit_value: number
          updated_at: string
        }
        Insert: {
          action_id: string
          created_at?: string
          description?: string | null
          id?: string
          item_status?: string
          prize_type_config_id?: string | null
          quantity?: number
          title: string
          total_value?: number
          type: Database["public"]["Enums"]["prize_type"]
          unit_value?: number
          updated_at?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          description?: string | null
          id?: string
          item_status?: string
          prize_type_config_id?: string | null
          quantity?: number
          title?: string
          total_value?: number
          type?: Database["public"]["Enums"]["prize_type"]
          unit_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prizes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prizes_prize_type_config_id_fkey"
            columns: ["prize_type_config_id"]
            isOneToOne: false
            referencedRelation: "prize_type_configs"
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
          phone: string | null
          signature: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          signature?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          signature?: string | null
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      winners: {
        Row: {
          action_id: string
          batch_id: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          full_name: string | null
          id: string
          last_outbound_at: string | null
          last_pix_error: string | null
          last_pix_request_at: string | null
          last_pix_requested_by: string | null
          name: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          phone: string | null
          pix_holder_doc: string | null
          pix_holder_name: string | null
          pix_key: string | null
          pix_observation: string | null
          pix_registered_at: string | null
          pix_registered_by: string | null
          pix_type: Database["public"]["Enums"]["pix_type"] | null
          pix_validated_at: string | null
          pix_validated_by: string | null
          prize_datetime: string | null
          prize_title: string
          prize_type: Database["public"]["Enums"]["prize_type"]
          receipt_attached_at: string | null
          receipt_attached_by: string | null
          receipt_filename: string | null
          receipt_sent_at: string | null
          receipt_url: string | null
          receipt_version: number
          status: Database["public"]["Enums"]["winner_status"]
          ultima_interacao_whatsapp: string | null
          updated_at: string
          value: number
        }
        Insert: {
          action_id: string
          batch_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id?: string
          last_outbound_at?: string | null
          last_pix_error?: string | null
          last_pix_request_at?: string | null
          last_pix_requested_by?: string | null
          name: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone?: string | null
          pix_holder_doc?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_observation?: string | null
          pix_registered_at?: string | null
          pix_registered_by?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          pix_validated_at?: string | null
          pix_validated_by?: string | null
          prize_datetime?: string | null
          prize_title: string
          prize_type: Database["public"]["Enums"]["prize_type"]
          receipt_attached_at?: string | null
          receipt_attached_by?: string | null
          receipt_filename?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          receipt_version?: number
          status?: Database["public"]["Enums"]["winner_status"]
          ultima_interacao_whatsapp?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          action_id?: string
          batch_id?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          full_name?: string | null
          id?: string
          last_outbound_at?: string | null
          last_pix_error?: string | null
          last_pix_request_at?: string | null
          last_pix_requested_by?: string | null
          name?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          phone?: string | null
          pix_holder_doc?: string | null
          pix_holder_name?: string | null
          pix_key?: string | null
          pix_observation?: string | null
          pix_registered_at?: string | null
          pix_registered_by?: string | null
          pix_type?: Database["public"]["Enums"]["pix_type"] | null
          pix_validated_at?: string | null
          pix_validated_by?: string | null
          prize_datetime?: string | null
          prize_title?: string
          prize_type?: Database["public"]["Enums"]["prize_type"]
          receipt_attached_at?: string | null
          receipt_attached_by?: string | null
          receipt_filename?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          receipt_version?: number
          status?: Database["public"]["Enums"]["winner_status"]
          ultima_interacao_whatsapp?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "winners_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "winners_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "pix_batches"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin: { Args: never; Returns: boolean }
      is_authenticated_user: { Args: never; Returns: boolean }
    }
    Enums: {
      action_status:
        | "planning"
        | "active"
        | "completed"
        | "cancelled"
        | "archived"
      app_role: "admin" | "support"
      cost_category:
        | "marketing"
        | "delivery"
        | "taxes"
        | "legalization"
        | "other"
      payment_method: "lote_pix" | "manual"
      pix_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      prize_type:
        | "main"
        | "instant"
        | "spin"
        | "quota"
        | "blessed_hour"
        | "bonus"
      winner_status:
        | "imported"
        | "pix_requested"
        | "awaiting_pix"
        | "pix_received"
        | "ready_to_pay"
        | "sent_to_batch"
        | "awaiting_receipt"
        | "paid"
        | "receipt_sent"
        | "pix_refused"
        | "receipt_attached"
        | "numero_inexistente"
        | "cliente_nao_responde"
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
      action_status: [
        "planning",
        "active",
        "completed",
        "cancelled",
        "archived",
      ],
      app_role: ["admin", "support"],
      cost_category: [
        "marketing",
        "delivery",
        "taxes",
        "legalization",
        "other",
      ],
      payment_method: ["lote_pix", "manual"],
      pix_type: ["cpf", "cnpj", "email", "phone", "random"],
      prize_type: ["main", "instant", "spin", "quota", "blessed_hour", "bonus"],
      winner_status: [
        "imported",
        "pix_requested",
        "awaiting_pix",
        "pix_received",
        "ready_to_pay",
        "sent_to_batch",
        "awaiting_receipt",
        "paid",
        "receipt_sent",
        "pix_refused",
        "receipt_attached",
        "numero_inexistente",
        "cliente_nao_responde",
      ],
    },
  },
} as const
