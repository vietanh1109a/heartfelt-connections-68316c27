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
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cookie_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cookie_stock: {
        Row: {
          cookie_data: string
          id: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cookie_data: string
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cookie_data?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ctv_listing_items: {
        Row: {
          content: string
          created_at: string
          ctv_user_id: string
          expiry_date: string | null
          id: string
          is_sold: boolean
          listing_id: string
          sold_at: string | null
          sold_to: string | null
        }
        Insert: {
          content: string
          created_at?: string
          ctv_user_id: string
          expiry_date?: string | null
          id?: string
          is_sold?: boolean
          listing_id: string
          sold_at?: string | null
          sold_to?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          ctv_user_id?: string
          expiry_date?: string | null
          id?: string
          is_sold?: boolean
          listing_id?: string
          sold_at?: string | null
          sold_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctv_listing_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ctv_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ctv_listings: {
        Row: {
          category: string
          created_at: string
          ctv_user_id: string
          description: string | null
          id: string
          price: number
          refund_count: number
          status: string
          thumbnail_url: string | null
          title: string
          total_sold: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          ctv_user_id: string
          description?: string | null
          id?: string
          price: number
          refund_count?: number
          status?: string
          thumbnail_url?: string | null
          title: string
          total_sold?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          ctv_user_id?: string
          description?: string | null
          id?: string
          price?: number
          refund_count?: number
          status?: string
          thumbnail_url?: string | null
          title?: string
          total_sold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctv_listings_ctv_user_id_fkey"
            columns: ["ctv_user_id"]
            isOneToOne: false
            referencedRelation: "ctv_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ctv_orders: {
        Row: {
          buyer_id: string
          created_at: string
          ctv_earning: number
          ctv_user_id: string
          earnings_released: boolean
          id: string
          listing_id: string
          listing_item_id: string | null
          platform_fee: number
          price: number
          release_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          ctv_earning?: number
          ctv_user_id: string
          earnings_released?: boolean
          id?: string
          listing_id: string
          listing_item_id?: string | null
          platform_fee?: number
          price: number
          release_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          ctv_earning?: number
          ctv_user_id?: string
          earnings_released?: boolean
          id?: string
          listing_id?: string
          listing_item_id?: string | null
          platform_fee?: number
          price?: number
          release_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctv_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "ctv_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctv_orders_listing_item_id_fkey"
            columns: ["listing_item_id"]
            isOneToOne: false
            referencedRelation: "ctv_listing_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ctv_payout_requests: {
        Row: {
          amount: number
          bank_account: string
          bank_holder: string
          bank_name: string
          created_at: string
          ctv_user_id: string
          id: string
          note: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account: string
          bank_holder: string
          bank_name: string
          created_at?: string
          ctv_user_id: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account?: string
          bank_holder?: string
          bank_name?: string
          created_at?: string
          ctv_user_id?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctv_payout_requests_ctv_user_id_fkey"
            columns: ["ctv_user_id"]
            isOneToOne: false
            referencedRelation: "ctv_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ctv_profiles: {
        Row: {
          available_balance: number
          bank_account: string | null
          bank_holder: string | null
          bank_name: string | null
          commission_rate: number
          contact_info: string | null
          created_at: string
          display_name: string
          id: string
          pending_balance: number
          refund_count: number
          status: string
          total_orders: number
          total_sales: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          commission_rate?: number
          contact_info?: string | null
          created_at?: string
          display_name: string
          id?: string
          pending_balance?: number
          refund_count?: number
          status?: string
          total_orders?: number
          total_sales?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          commission_rate?: number
          contact_info?: string | null
          created_at?: string
          display_name?: string
          id?: string
          pending_balance?: number
          refund_count?: number
          status?: string
          total_orders?: number
          total_sales?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ctv_registrations: {
        Row: {
          bank_info: string | null
          contact_info: string
          created_at: string
          display_name: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_info?: string | null
          contact_info: string
          created_at?: string
          display_name: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_info?: string | null
          contact_info?: string
          created_at?: string
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          deposit_code: string
          expires_at: string | null
          id: string
          paid_at: string | null
          sepay_tx_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          deposit_code: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          sepay_tx_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          deposit_code?: string
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          sepay_tx_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moderator_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          tab: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          tab: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          tab?: string
          updated_at?: string
        }
        Relationships: []
      }
      netflix_accounts: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          is_assigned: boolean
          password: string
          plan_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          is_assigned?: boolean
          password: string
          plan_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          is_assigned?: boolean
          password?: string
          plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "netflix_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "netflix_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      netflix_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_months: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_months: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
        }
        Relationships: []
      }
      plan_purchases: {
        Row: {
          account_id: string | null
          amount_paid: number
          created_at: string
          id: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_paid: number
          created_at?: string
          id?: string
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_paid?: number
          created_at?: string
          id?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_purchases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "netflix_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "netflix_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      product_items: {
        Row: {
          content: string
          created_at: string
          id: string
          is_sold: boolean
          product_id: string
          sold_at: string | null
          sold_to: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_sold?: boolean
          product_id: string
          sold_at?: string | null
          sold_to?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_sold?: boolean
          product_id?: string
          sold_at?: string | null
          sold_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          product_id: string
          product_item_id: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          product_id: string
          product_item_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          product_id?: string
          product_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_purchases_product_item_id_fkey"
            columns: ["product_item_id"]
            isOneToOne: false
            referencedRelation: "product_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          original_price: number | null
          price: number
          sold_count: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          original_price?: number | null
          price?: number
          sold_count?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          original_price?: number | null
          price?: number
          sold_count?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          bonus_balance: number
          bonus_expires_at: string | null
          created_at: string
          display_name: string | null
          free_views_left: number
          id: string
          is_verified: boolean
          switch_count: number
          switch_reset_at: string | null
          updated_at: string
          user_id: string
          vip_expires_at: string | null
          vip_views_left: number
        }
        Insert: {
          balance?: number
          bonus_balance?: number
          bonus_expires_at?: string | null
          created_at?: string
          display_name?: string | null
          free_views_left?: number
          id?: string
          is_verified?: boolean
          switch_count?: number
          switch_reset_at?: string | null
          updated_at?: string
          user_id: string
          vip_expires_at?: string | null
          vip_views_left?: number
        }
        Update: {
          balance?: number
          bonus_balance?: number
          bonus_expires_at?: string | null
          created_at?: string
          display_name?: string | null
          free_views_left?: number
          id?: string
          is_verified?: boolean
          switch_count?: number
          switch_reset_at?: string | null
          updated_at?: string
          user_id?: string
          vip_expires_at?: string | null
          vip_views_left?: number
        }
        Relationships: []
      }
      referral_logs: {
        Row: {
          bonus_amount: number
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          memo: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          memo?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          memo?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_at: string
          banned_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          reason: string
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_cookie_assignment: {
        Row: {
          assigned_at: string
          cookie_id: string
          id: string
          slot: number
          user_id: string
        }
        Insert: {
          assigned_at?: string
          cookie_id: string
          id?: string
          slot?: number
          user_id: string
        }
        Update: {
          assigned_at?: string
          cookie_id?: string
          id?: string
          slot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cookie_assignment_cookie_id_fkey"
            columns: ["cookie_id"]
            isOneToOne: false
            referencedRelation: "cookie_stock"
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
      vip_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      vip_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
          vip_expires_at: string
          vip_plan_id: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          vip_expires_at: string
          vip_plan_id?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          vip_expires_at?: string
          vip_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_purchases_vip_plan_id_fkey"
            columns: ["vip_plan_id"]
            isOneToOne: false
            referencedRelation: "vip_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payload: Json | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payload?: Json | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payload?: Json | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { delta: number; target_user_id: string }
        Returns: number
      }
      assign_cookies_to_user: {
        Args: { desired_count: number; target_user_id: string }
        Returns: undefined
      }
      expire_bonus_if_needed: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      get_effective_balance: {
        Args: { target_user_id: string }
        Returns: number
      }
      get_netflix_stock_by_plan: {
        Args: never
        Returns: {
          count: number
          plan_id: string
        }[]
      }
      get_netflix_stock_count: { Args: never; Returns: number }
      get_user_id_by_email: { Args: { lookup_email: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_balance: {
        Args: { delta: number; target_user_id: string }
        Returns: undefined
      }
      increment_bonus_balance: {
        Args: { delta: number; expires_at?: string; target_user_id: string }
        Returns: undefined
      }
      is_owner_profile: { Args: { profile_user_id: string }; Returns: boolean }
      user_has_sufficient_balance: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      transaction_type: "deposit" | "usage"
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
      app_role: ["admin", "moderator", "user"],
      transaction_type: ["deposit", "usage"],
    },
  },
} as const
