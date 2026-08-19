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
      attendance: {
        Row: {
          arrival_time: string | null
          id: string
          member_id: string
          overridden: boolean
          rehearsal_id: string
          remark: string | null
          source: string
          status: Database["public"]["Enums"]["attendance_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          arrival_time?: string | null
          id?: string
          member_id: string
          overridden?: boolean
          rehearsal_id: string
          remark?: string | null
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          arrival_time?: string | null
          id?: string
          member_id?: string
          overridden?: boolean
          rehearsal_id?: string
          remark?: string | null
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_rehearsal_id_fkey"
            columns: ["rehearsal_id"]
            isOneToOne: false
            referencedRelation: "rehearsals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          body: string
          created_at: string
          id: string
          priority: string
          sender_id: string
          team_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          priority?: string
          sender_id: string
          team_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          priority?: string
          sender_id?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_message_stars: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          mentions: string[]
          reply_to_id: string | null
          sender_id: string
          team_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          mentions?: string[]
          reply_to_id?: string | null
          sender_id: string
          team_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          mentions?: string[]
          reply_to_id?: string | null
          sender_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_state: {
        Row: {
          last_read_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_item_assignees: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_assignees_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          allow_multiple: boolean
          checklist_id: string
          completed_at: string | null
          description: string
          id: string
          is_completed: boolean
          member_id: string | null
          notes: string | null
        }
        Insert: {
          allow_multiple?: boolean
          checklist_id: string
          completed_at?: string | null
          description: string
          id?: string
          is_completed?: boolean
          member_id?: string | null
          notes?: string | null
        }
        Update: {
          allow_multiple?: boolean
          checklist_id?: string
          completed_at?: string | null
          description?: string
          id?: string
          is_completed?: boolean
          member_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "weekly_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          edited_at: string | null
          highlight_color: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          mentions: string[]
          recipient_id: string
          reply_to_id: string | null
          sender_id: string
          team_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          edited_at?: string | null
          highlight_color?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          mentions?: string[]
          recipient_id: string
          reply_to_id?: string | null
          sender_id: string
          team_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          edited_at?: string | null
          highlight_color?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          mentions?: string[]
          recipient_id?: string
          reply_to_id?: string | null
          sender_id?: string
          team_id?: string
        }
        Relationships: []
      }
      dm_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_message_stars: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_read_state: {
        Row: {
          last_read_at: string
          peer_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          peer_id: string
          team_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          peer_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      due_payments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          recurrence: Database["public"]["Enums"]["payment_recurrence"]
          reminder_days_before: number[]
          reminders_enabled: boolean
          team_id: string
          title: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
          reminder_days_before?: number[]
          reminders_enabled?: boolean
          team_id: string
          title: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
          reminder_days_before?: number[]
          reminders_enabled?: boolean
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          team_id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          team_id: string
          token: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          team_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          created_at: string
          id: string
          team_id: string
          template: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          template: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          template?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          dismissed_at: string | null
          id: string
          is_read: boolean
          link: string | null
          priority: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          priority?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          priority?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount_paid: number
          id: string
          is_paid: boolean
          is_partial: boolean
          member_id: string
          notes: string | null
          paid_at: string | null
          payment_id: string
          proof_url: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_paid?: number
          id?: string
          is_paid?: boolean
          is_partial?: boolean
          member_id: string
          notes?: string | null
          paid_at?: string | null
          payment_id: string
          proof_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_paid?: number
          id?: string
          is_paid?: boolean
          is_partial?: boolean
          member_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_id?: string
          proof_url?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "due_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_chain_assignments: {
        Row: {
          chain_id: string
          completed: boolean
          created_at: string
          id: string
          member_id: string
          scheduled_time: string | null
        }
        Insert: {
          chain_id: string
          completed?: boolean
          created_at?: string
          id?: string
          member_id: string
          scheduled_time?: string | null
        }
        Update: {
          chain_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          member_id?: string
          scheduled_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayer_chain_assignments_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "prayer_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_chain_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_chains: {
        Row: {
          answered: boolean
          created_at: string
          days_of_week: number[]
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          name: string
          priority: number
          recurrence: Database["public"]["Enums"]["prayer_recurrence"]
          start_date: string
          start_time: string | null
          team_id: string
          type: Database["public"]["Enums"]["prayer_type"]
        }
        Insert: {
          answered?: boolean
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          name: string
          priority?: number
          recurrence?: Database["public"]["Enums"]["prayer_recurrence"]
          start_date: string
          start_time?: string | null
          team_id: string
          type?: Database["public"]["Enums"]["prayer_type"]
        }
        Update: {
          answered?: boolean
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          name?: string
          priority?: number
          recurrence?: Database["public"]["Enums"]["prayer_recurrence"]
          start_date?: string
          start_time?: string | null
          team_id?: string
          type?: Database["public"]["Enums"]["prayer_type"]
        }
        Relationships: [
          {
            foreignKeyName: "prayer_chains_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_leader_schedule: {
        Row: {
          created_at: string
          day_of_week: number | null
          end_time: string | null
          focus: string | null
          id: string
          member_id: string
          notes: string | null
          scheduled_date: string | null
          start_time: string | null
          team_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          focus?: string | null
          id?: string
          member_id: string
          notes?: string | null
          scheduled_date?: string | null
          start_time?: string | null
          team_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          end_time?: string | null
          focus?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          scheduled_date?: string | null
          start_time?: string | null
          team_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      prayer_requests: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_anonymous: boolean
          lead_note: string | null
          member_id: string
          status: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          lead_note?: string | null
          member_id: string
          status?: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_anonymous?: boolean
          lead_note?: string | null
          member_id?: string
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      probation_scores: {
        Row: {
          created_at: string
          id: string
          member_id: string
          note: string | null
          recorded_by: string | null
          score: number
          target_key: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          note?: string | null
          recorded_by?: string | null
          score: number
          target_key: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          note?: string | null
          recorded_by?: string | null
          score?: number
          target_key?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "probation_scores_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probation_scores_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probation_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_pages: string[]
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          is_admin: boolean
          phone: string | null
          probation_started_at: string | null
          probation_targets: Json | null
          read_receipts: boolean
          role: Database["public"]["Enums"]["app_role"]
          specialization: string | null
          suspended_until: string | null
          suspension_reason: string | null
          team_id: string | null
        }
        Insert: {
          admin_pages?: string[]
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          is_admin?: boolean
          phone?: string | null
          probation_started_at?: string | null
          probation_targets?: Json | null
          read_receipts?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          specialization?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          team_id?: string | null
        }
        Update: {
          admin_pages?: string[]
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_admin?: boolean
          phone?: string | null
          probation_started_at?: string | null
          probation_targets?: Json | null
          read_receipts?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          specialization?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          team_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          team_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          team_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rehearsals: {
        Row: {
          agenda: string | null
          created_at: string
          date: string
          end_time: string | null
          id: string
          late_after: string | null
          location: string | null
          notes: string | null
          priority: number
          start_time: string
          team_id: string
          title: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          late_after?: string | null
          location?: string | null
          notes?: string | null
          priority?: number
          start_time: string
          team_id: string
          title: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          late_after?: string | null
          location?: string | null
          notes?: string | null
          priority?: number
          start_time?: string
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rehearsals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      service_attendance: {
        Row: {
          arrival_time: string | null
          event_id: string
          id: string
          marked_at: string
          marked_by: string | null
          member_id: string
          notes: string | null
          overridden: boolean
          remark: string | null
          source: string
          status: Database["public"]["Enums"]["punctuality_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          arrival_time?: string | null
          event_id: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          member_id: string
          notes?: string | null
          overridden?: boolean
          remark?: string | null
          source?: string
          status?: Database["public"]["Enums"]["punctuality_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          arrival_time?: string | null
          event_id?: string
          id?: string
          marked_at?: string
          marked_by?: string | null
          member_id?: string
          notes?: string | null
          overridden?: boolean
          remark?: string | null
          source?: string
          status?: Database["public"]["Enums"]["punctuality_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "service_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_attendance_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_events: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          kind: Database["public"]["Enums"]["service_event_kind"]
          late_after: string | null
          location: string | null
          notes: string | null
          priority: number
          start_time: string | null
          team_id: string
          title: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_event_kind"]
          late_after?: string | null
          location?: string | null
          notes?: string | null
          priority?: number
          start_time?: string | null
          team_id: string
          title: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["service_event_kind"]
          late_after?: string | null
          location?: string | null
          notes?: string | null
          priority?: number
          start_time?: string | null
          team_id?: string
          title?: string
        }
        Relationships: []
      }
      song_assignments: {
        Row: {
          id: string
          is_lead: boolean
          member_id: string
          note: string | null
          song_id: string
          status: Database["public"]["Enums"]["song_status"]
        }
        Insert: {
          id?: string
          is_lead?: boolean
          member_id: string
          note?: string | null
          song_id: string
          status?: Database["public"]["Enums"]["song_status"]
        }
        Update: {
          id?: string
          is_lead?: boolean
          member_id?: string
          note?: string | null
          song_id?: string
          status?: Database["public"]["Enums"]["song_status"]
        }
        Relationships: [
          {
            foreignKeyName: "song_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "song_assignments_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          created_at: string
          id: string
          practice_notes: string | null
          song_key: string | null
          target_readiness_date: string | null
          team_id: string
          title: string
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          practice_notes?: string | null
          song_key?: string | null
          target_readiness_date?: string | null
          team_id: string
          title: string
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          practice_notes?: string | null
          song_key?: string | null
          target_readiness_date?: string | null
          team_id?: string
          title?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          access_code: string
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          name: string
          team_lead_id: string
        }
        Insert: {
          access_code: string
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          name: string
          team_lead_id: string
        }
        Update: {
          access_code?: string
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          name?: string
          team_lead_id?: string
        }
        Relationships: []
      }
      uniform_events: {
        Row: {
          created_at: string
          date: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          team_id: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uniform_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      uniform_readiness: {
        Row: {
          event_id: string
          id: string
          member_id: string
          status: Database["public"]["Enums"]["uniform_status"]
        }
        Insert: {
          event_id: string
          id?: string
          member_id: string
          status?: Database["public"]["Enums"]["uniform_status"]
        }
        Update: {
          event_id?: string
          id?: string
          member_id?: string
          status?: Database["public"]["Enums"]["uniform_status"]
        }
        Relationships: [
          {
            foreignKeyName: "uniform_readiness_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "uniform_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uniform_readiness_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checklists: {
        Row: {
          created_at: string
          id: string
          priority: number
          status_options: Json
          team_id: string
          title: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          priority?: number
          status_options?: Json
          team_id: string
          title: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          priority?: number
          status_options?: Json
          team_id?: string
          title?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checklists_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dm_pair_allowed: {
        Args: { _a: string; _b: string; _team: string }
        Returns: boolean
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      has_admin_page: {
        Args: { _page: string; _user_id: string }
        Returns: boolean
      }
      is_team_lead: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "team_lead" | "member"
      attendance_status: "present" | "absent" | "excused" | "late"
      payment_recurrence: "one_time" | "daily" | "weekly" | "monthly"
      prayer_recurrence:
        | "none"
        | "daily"
        | "weekly_mon"
        | "weekly_tue"
        | "weekly_wed"
        | "weekly_thu"
        | "weekly_fri"
        | "weekly_sat"
        | "weekly_sun"
      prayer_type: "continuous" | "scheduled"
      punctuality_status:
        | "on_time"
        | "late"
        | "very_late"
        | "absent"
        | "excused"
      service_event_kind: "rehearsal" | "service" | "event"
      song_status: "not_started" | "learning" | "ready" | "perfect"
      uniform_status: "ready" | "pending" | "not_ready" | "na"
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
      app_role: ["team_lead", "member"],
      attendance_status: ["present", "absent", "excused", "late"],
      payment_recurrence: ["one_time", "daily", "weekly", "monthly"],
      prayer_recurrence: [
        "none",
        "daily",
        "weekly_mon",
        "weekly_tue",
        "weekly_wed",
        "weekly_thu",
        "weekly_fri",
        "weekly_sat",
        "weekly_sun",
      ],
      prayer_type: ["continuous", "scheduled"],
      punctuality_status: ["on_time", "late", "very_late", "absent", "excused"],
      service_event_kind: ["rehearsal", "service", "event"],
      song_status: ["not_started", "learning", "ready", "perfect"],
      uniform_status: ["ready", "pending", "not_ready", "na"],
    },
  },
} as const
