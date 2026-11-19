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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          child_id: string
          created_at: string
          date: string
          id: string
          reported_by: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          date: string
          id?: string
          reported_by?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          date?: string
          id?: string
          reported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          school_id: string
          updated_at: string
          usd_to_zig_rate: number
        }
        Insert: {
          school_id: string
          updated_at?: string
          usd_to_zig_rate: number
        }
        Update: {
          school_id?: string
          updated_at?: string
          usd_to_zig_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          school_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_pickups: {
        Row: {
          active: boolean
          child_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          pin_hash: string
          relationship: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          child_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          pin_hash: string
          relationship: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          child_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          pin_hash?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_pickups_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_live: {
        Row: {
          heading: number | null
          lat: number
          lng: number
          speed: number | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          heading?: number | null
          lat: number
          lng: number
          speed?: number | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          heading?: number | null
          lat?: number
          lng?: number
          speed?: number | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_live_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          active: boolean
          archived_at: string | null
          capacity: number
          created_at: string
          driver_name: string | null
          id: string
          make: string | null
          model: string | null
          registration: string
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          capacity: number
          created_at?: string
          driver_name?: string | null
          id?: string
          make?: string | null
          model?: string | null
          registration: string
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          capacity?: number
          created_at?: string
          driver_name?: string | null
          id?: string
          make?: string | null
          model?: string | null
          registration?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          allergies: string | null
          archived_at: string | null
          avatar_key: string | null
          class_name: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          home_radius_m: number
          home_stop_id: string | null
          id: string
          medical_notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          archived_at?: string | null
          avatar_key?: string | null
          class_name?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          home_radius_m?: number
          home_stop_id?: string | null
          id?: string
          medical_notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          archived_at?: string | null
          avatar_key?: string | null
          class_name?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          home_radius_m?: number
          home_stop_id?: string | null
          id?: string
          medical_notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_home_stop_fk"
            columns: ["home_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_requests: {
        Row: {
          children_count: number
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          phone: string | null
          school_name: string
          status: string
          website: string | null
        }
        Insert: {
          children_count?: number
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          school_name: string
          status?: string
          website?: string | null
        }
        Update: {
          children_count?: number
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          school_name?: string
          status?: string
          website?: string | null
        }
        Relationships: []
      }
      guardianships: {
        Row: {
          child_id: string
          created_at: string
          guardian_id: string
          id: string
          relationship: string
        }
        Insert: {
          child_id: string
          created_at?: string
          guardian_id: string
          id?: string
          relationship: string
        }
        Update: {
          child_id?: string
          created_at?: string
          guardian_id?: string
          id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardianships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardianships_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          child_id: string | null
          created_at: string
          description: string
          id: string
          reported_by: string | null
          school_id: string
          severity: Database["public"]["Enums"]["notification_priority"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          description: string
          id?: string
          reported_by?: string | null
          school_id: string
          severity?: Database["public"]["Enums"]["notification_priority"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          created_at?: string
          description?: string
          id?: string
          reported_by?: string | null
          school_id?: string
          severity?: Database["public"]["Enums"]["notification_priority"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_usd: number
          created_at: string
          currency: string
          due_date: string
          guardian_id: string | null
          id: string
          school_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          currency?: string
          due_date: string
          guardian_id?: string | null
          id?: string
          school_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          currency?: string
          due_date?: string
          guardian_id?: string | null
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      location_history: {
        Row: {
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged_at: string | null
          body_key: string
          created_at: string
          id: string
          params: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          school_id: string
          title_key: string
          type: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          body_key: string
          created_at?: string
          id?: string
          params?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          school_id: string
          title_key: string
          type: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          body_key?: string
          created_at?: string
          id?: string
          params?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          school_id?: string
          title_key?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          invited_user_id: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          invoice_id: string
          method: string
          paid_at: string | null
          provider: string | null
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          idempotency_key?: string | null
          invoice_id: string
          method?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string
          method?: string
          paid_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      paynow_transactions: {
        Row: {
          browser_url: string | null
          created_at: string
          merchant_reference: string
          payment_id: string
          paynow_reference: string | null
          poll_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          browser_url?: string | null
          created_at?: string
          merchant_reference: string
          payment_id: string
          paynow_reference?: string | null
          poll_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          browser_url?: string | null
          created_at?: string
          merchant_reference?: string
          payment_id?: string
          paynow_reference?: string | null
          poll_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paynow_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          expo_push_token: string | null
          full_name: string
          id: string
          language: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          expo_push_token?: string | null
          full_name: string
          id: string
          language?: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          expo_push_token?: string | null
          full_name?: string
          id?: string
          language?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_receipts: {
        Row: {
          checked_at: string | null
          created_at: string
          error_code: string | null
          expo_ticket_id: string
          id: string
          notification_id: string
          status: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          error_code?: string | null
          expo_ticket_id: string
          id?: string
          notification_id: string
          status?: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          error_code?: string | null
          expo_ticket_id?: string
          id?: string
          notification_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_receipts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_children: {
        Row: {
          child_id: string
          created_at: string
          id: string
          route_id: string
          stop_id: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          route_id: string
          stop_id?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          route_id?: string
          stop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_children_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_children_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          archived_at: string | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          field_check_notes: string | null
          field_checked_at: string | null
          field_checked_by: string | null
          geometry_source: string | null
          geometry_status: string
          geometry_verified_at: string | null
          id: string
          name: string
          polyline: Json
          school_id: string
          type: Database["public"]["Enums"]["route_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          field_check_notes?: string | null
          field_checked_at?: string | null
          field_checked_by?: string | null
          geometry_source?: string | null
          geometry_status?: string
          geometry_verified_at?: string | null
          id?: string
          name: string
          polyline?: Json
          school_id: string
          type: Database["public"]["Enums"]["route_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          field_check_notes?: string | null
          field_checked_at?: string | null
          field_checked_by?: string | null
          geometry_source?: string | null
          geometry_status?: string
          geometry_verified_at?: string | null
          id?: string
          name?: string
          polyline?: Json
          school_id?: string
          type?: Database["public"]["Enums"]["route_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_field_checked_by_fkey"
            columns: ["field_checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          invited_user_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          position: number
          route_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          position: number
          route_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          position?: number
          route_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan: string
          renews_at: string | null
          school_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan: string
          renews_at?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          renews_at?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_members: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          child_id: string | null
          client_recorded_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          lat: number | null
          lng: number | null
          metadata: Json
          recorded_by: string
          trip_id: string
          type: Database["public"]["Enums"]["trip_event_type"]
        }
        Insert: {
          child_id?: string | null
          client_recorded_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          recorded_by: string
          trip_id: string
          type: Database["public"]["Enums"]["trip_event_type"]
        }
        Update: {
          child_id?: string | null
          client_recorded_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json
          recorded_by?: string
          trip_id?: string
          type?: Database["public"]["Enums"]["trip_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string
          created_at: string
          ended_at: string | null
          id: string
          route_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          route_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          route_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_paynow_callback: {
        Args: {
          p_amount: number
          p_merchant_reference: string
          p_paynow_reference: string
          p_provider_status: string
        }
        Returns: string
      }
      check_stale_bus_locations: { Args: never; Returns: number }
      complete_trip: { Args: { p_trip_id: string }; Returns: Json }
      create_child_with_guardian: {
        Args: {
          p_class_name: string
          p_first_name: string
          p_guardian_id: string
          p_relationship: string
        }
        Returns: string
      }
      create_school_join_code: {
        Args: { p_expires_at?: string; p_max_uses?: number }
        Returns: string
      }
      end_trip: { Args: { p_trip_id: string }; Returns: Json }
      join_school_with_code: { Args: { p_code: string }; Returns: string }
      purge_old_location_history: { Args: never; Returns: number }
      record_manual_payment: {
        Args: {
          p_amount: number
          p_currency: string
          p_invoice_id: string
          p_provider_reference: string
        }
        Returns: string
      }
      record_trip_event: {
        Args: {
          p_child_id: string
          p_client_recorded_at?: string
          p_idempotency_key?: string
          p_lat?: number
          p_lng?: number
          p_metadata?: Json
          p_trip_id: string
          p_type: Database["public"]["Enums"]["trip_event_type"]
        }
        Returns: string
      }
      register_push_token: { Args: { p_token: string }; Returns: undefined }
      renotify_unaccounted_children: { Args: never; Returns: number }
      revoke_school_join_code: { Args: { p_code: string }; Returns: boolean }
      start_trip: { Args: { p_trip_id: string }; Returns: string }
      verify_pickup_handover: {
        Args: {
          p_child_id: string
          p_idempotency_key?: string
          p_lat?: number
          p_lng?: number
          p_pickup_id: string
          p_pin: string
          p_trip_id: string
        }
        Returns: Json
      }
      verify_pickup_pin: {
        Args: { child_id: string; pickup_id: string; pin: string }
        Returns: boolean
      }
      verify_route_field_check: {
        Args: { p_route_id: string }
        Returns: boolean
      }
    }
    Enums: {
      incident_status: "open" | "investigating" | "resolved" | "closed"
      invoice_status: "draft" | "pending" | "paid" | "overdue" | "void"
      notification_priority: "low" | "normal" | "high" | "critical"
      route_type: "pickup" | "dropoff"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      trip_event_type:
        | "boarded"
        | "arrived_school"
        | "dropped_home"
        | "absent"
        | "sos"
        | "delay"
        | "handover_rejected"
        | "handover_verified"
        | "child_missing"
      trip_status: "scheduled" | "active" | "completed" | "cancelled"
      user_role: "parent" | "supervisor" | "school_admin" | "platform_owner"
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
      incident_status: ["open", "investigating", "resolved", "closed"],
      invoice_status: ["draft", "pending", "paid", "overdue", "void"],
      notification_priority: ["low", "normal", "high", "critical"],
      route_type: ["pickup", "dropoff"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      trip_event_type: [
        "boarded",
        "arrived_school",
        "dropped_home",
        "absent",
        "sos",
        "delay",
        "handover_rejected",
        "handover_verified",
        "child_missing",
      ],
      trip_status: ["scheduled", "active", "completed", "cancelled"],
      user_role: ["parent", "supervisor", "school_admin", "platform_owner"],
    },
  },
} as const
