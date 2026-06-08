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
      comments: {
        Row: {
          body: string
          course_id: string | null
          created_at: string
          id: string
          test_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          course_id?: string | null
          created_at?: string
          id?: string
          test_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          test_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string
          description: string
          difficulty: string
          duration_min: number
          id: string
          instructor_bio: string
          instructor_name: string
          price: number
          thumbnail_url: string
          tier: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          difficulty?: string
          duration_min?: number
          id?: string
          instructor_bio?: string
          instructor_name?: string
          price?: number
          thumbnail_url?: string
          tier?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          difficulty?: string
          duration_min?: number
          id?: string
          instructor_bio?: string
          instructor_name?: string
          price?: number
          thumbnail_url?: string
          tier?: string
          title?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          plan: string
          status: string
          subscription_id: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          plan?: string
          status?: string
          subscription_id?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          status?: string
          subscription_id?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          college: string
          created_at: string
          email: string
          full_name: string
          id: string
          membership_status: string
          subscription_expiry: string | null
          tokens: number
        }
        Insert: {
          blocked?: boolean
          college?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          membership_status?: string
          subscription_expiry?: string | null
          tokens?: number
        }
        Update: {
          blocked?: boolean
          college?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          membership_status?: string
          subscription_expiry?: string | null
          tokens?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          test_id: string | null
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          test_id?: string | null
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          test_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          course_ids: string[]
          created_at: string
          description: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          test_ids: string[]
          token_price: number
          updated_at: string
        }
        Insert: {
          course_ids?: string[]
          created_at?: string
          description?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name: string
          test_ids?: string[]
          token_price?: number
          updated_at?: string
        }
        Update: {
          course_ids?: string[]
          created_at?: string
          description?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          test_ids?: string[]
          token_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          status: string
          subcategory: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          status?: string
          subcategory?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          subcategory?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "rankings_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      test_answers: {
        Row: {
          attempt_id: string
          id: string
          question_id: string
          selected_option: string | null
          written_answer: string | null
        }
        Insert: {
          attempt_id: string
          id?: string
          question_id: string
          selected_option?: string | null
          written_answer?: string | null
        }
        Update: {
          attempt_id?: string
          id?: string
          question_id?: string
          selected_option?: string | null
          written_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          feedback: string | null
          id: string
          is_reviewed: boolean
          published_at: string | null
          score: number
          started_at: string
          status: string
          submitted_at: string | null
          test_id: string
          total: number
          user_id: string
        }
        Insert: {
          feedback?: string | null
          id?: string
          is_reviewed?: boolean
          published_at?: string | null
          score?: number
          started_at?: string
          status?: string
          submitted_at?: string | null
          test_id: string
          total?: number
          user_id: string
        }
        Update: {
          feedback?: string | null
          id?: string
          is_reviewed?: boolean
          published_at?: string | null
          score?: number
          started_at?: string
          status?: string
          submitted_at?: string | null
          test_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_attempts_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "rankings_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          correct_option: string | null
          created_at: string
          explanation: string
          id: string
          marks: number
          max_words: number | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          position: number
          question: string
          question_type: string
          test_id: string
        }
        Insert: {
          correct_option?: string | null
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          max_words?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          position?: number
          question: string
          question_type?: string
          test_id: string
        }
        Update: {
          correct_option?: string | null
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          max_words?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          position?: number
          question?: string
          question_type?: string
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      test_reviews: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          notes: string
          question_id: string | null
          reviewer_id: string
          score: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          notes?: string
          question_id?: string | null
          reviewer_id: string
          score?: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          notes?: string
          question_id?: string | null
          reviewer_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_reviews_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_reviews_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_reviews_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          category: string
          created_at: string
          description: string
          duration_min: number
          id: string
          instructions: string
          price: number
          test_type: string
          tier: Database["public"]["Enums"]["test_tier"]
          title: string
          total_marks: number
          word_limit: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          instructions?: string
          price?: number
          test_type?: string
          tier?: Database["public"]["Enums"]["test_tier"]
          title: string
          total_marks?: number
          word_limit?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          instructions?: string
          price?: number
          test_type?: string
          tier?: Database["public"]["Enums"]["test_tier"]
          title?: string
          total_marks?: number
          word_limit?: number
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_replies_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "rankings_view"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      token_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          message: string
          screenshot_url: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          message?: string
          screenshot_url?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          message?: string
          screenshot_url?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_requests_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_requests_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "rankings_view"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          course_id: string | null
          created_at: string
          description: string
          duration_sec: number
          id: string
          position: number
          storage_path: string | null
          thumbnail_url: string
          title: string
          video_url: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string
          duration_sec?: number
          id?: string
          position?: number
          storage_path?: string | null
          thumbnail_url?: string
          title: string
          video_url?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string
          duration_sec?: number
          id?: string
          position?: number
          storage_path?: string | null
          thumbnail_url?: string
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      rankings_view: {
        Row: {
          attempts_count: number | null
          avg_percentage: number | null
          college: string | null
          full_name: string | null
          tests_taken: number | null
          total_score: number | null
          user_id: string | null
        }
        Relationships: []
      }
      test_questions_secure: {
        Row: {
          id: string | null
          marks: number | null
          max_words: number | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          position: number | null
          question: string | null
          question_type: string | null
          test_id: string | null
        }
        Insert: {
          id?: string | null
          marks?: number | null
          max_words?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          position?: number | null
          question?: string | null
          question_type?: string | null
          test_id?: string | null
        }
        Update: {
          id?: string | null
          marks?: number | null
          max_words?: number | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          position?: number | null
          question?: string | null
          question_type?: string | null
          test_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_test_review: { Args: { _attempt_id: string }; Returns: Json }
      has_active_subscription_for_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      has_active_subscription_for_test: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
      }
      has_course_access: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_test_access: {
        Args: { _test_id: string; _user_id: string }
        Returns: boolean
      }
      publish_attempt: {
        Args: {
          _attempt_id: string
          _feedback: string
          _score: number
          _total: number
        }
        Returns: undefined
      }
      purchase_subscription: {
        Args: { _subscription_id: string }
        Returns: Json
      }
      purchase_with_tokens: {
        Args: { _course_id: string; _test_id: string }
        Returns: Json
      }
      start_fresh_attempt: { Args: { _test_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "student"
      test_tier: "free" | "paid" | "premium"
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
      app_role: ["admin", "student"],
      test_tier: ["free", "paid", "premium"],
    },
  },
} as const
