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
      alert_recipients: {
        Row: {
          acknowledged_at: string | null
          alert_id: string
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          id: string
          last_delivery_error: string | null
          recipient_user_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_id: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          id?: string
          last_delivery_error?: string | null
          recipient_user_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_id?: string
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          id?: string
          last_delivery_error?: string | null
          recipient_user_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_recipients_alert_school_fkey"
            columns: ["alert_id", "school_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "alert_recipients_membership_fkey"
            columns: ["school_id", "recipient_user_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "user_id"]
          },
          {
            foreignKeyName: "alert_recipients_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          id: string
          message: string
          next_escalation_at: string | null
          repeat_until_acknowledged: boolean
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          source_id: string | null
          source_type: string
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          id?: string
          message: string
          next_escalation_at?: string | null
          repeat_until_acknowledged?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          id?: string
          message?: string
          next_escalation_at?: string | null
          repeat_until_acknowledged?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          source_id?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      approved_collectors: {
        Row: {
          active: boolean
          child_id: string
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          phone: string
          pin_failed_attempts: number
          pin_hash: string
          pin_locked_until: string | null
          relationship: Database["public"]["Enums"]["collector_relationship"]
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          child_id: string
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          phone: string
          pin_failed_attempts?: number
          pin_hash: string
          pin_locked_until?: string | null
          relationship: Database["public"]["Enums"]["collector_relationship"]
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          child_id?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          phone?: string
          pin_failed_attempts?: number
          pin_hash?: string
          pin_locked_until?: string | null
          relationship?: Database["public"]["Enums"]["collector_relationship"]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approved_collectors_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "approved_collectors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approved_collectors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          id: number
          metadata: Json
          occurred_at: string
          outcome: string
          request_id: string | null
          school_id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          outcome?: string
          request_id?: string | null
          school_id: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          id?: never
          metadata?: Json
          occurred_at?: string
          outcome?: string
          request_id?: string | null
          school_id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
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
      bank_transfer_submissions: {
        Row: {
          bank: Database["public"]["Enums"]["payment_method"]
          bank_reference: string
          created_at: string
          depositor_name: string
          id: string
          payment_id: string
          proof_storage_path: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["bank_transfer_status"]
          updated_at: string
        }
        Insert: {
          bank: Database["public"]["Enums"]["payment_method"]
          bank_reference: string
          created_at?: string
          depositor_name: string
          id?: string
          payment_id: string
          proof_storage_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["bank_transfer_status"]
          updated_at?: string
        }
        Update: {
          bank?: Database["public"]["Enums"]["payment_method"]
          bank_reference?: string
          created_at?: string
          depositor_name?: string
          id?: string
          payment_id?: string
          proof_storage_path?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["bank_transfer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfer_submissions_payment_school_fkey"
            columns: ["payment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "bank_transfer_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfer_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          message: string
          published_at: string | null
          school_id: string
          status: string
          target_roles: Database["public"]["Enums"]["user_role"][]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          message: string
          published_at?: string | null
          school_id: string
          status?: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          message?: string
          published_at?: string | null
          school_id?: string
          status?: string
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_position_history: {
        Row: {
          accuracy_meters: number | null
          bus_id: string
          heading_degrees: number | null
          id: number
          location: unknown
          received_at: string
          recorded_at: string
          school_id: string
          speed_kph: number | null
          trip_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          bus_id: string
          heading_degrees?: number | null
          id?: never
          location: unknown
          received_at?: string
          recorded_at: string
          school_id: string
          speed_kph?: number | null
          trip_id: string
        }
        Update: {
          accuracy_meters?: number | null
          bus_id?: string
          heading_degrees?: number | null
          id?: never
          location?: unknown
          received_at?: string
          recorded_at?: string
          school_id?: string
          speed_kph?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_position_history_bus_school_fkey"
            columns: ["bus_id", "school_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "bus_position_history_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_position_history_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      bus_positions: {
        Row: {
          accuracy_meters: number | null
          bus_id: string
          heading_degrees: number | null
          location: unknown
          received_at: string
          recorded_at: string
          school_id: string
          speed_kph: number | null
          trip_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          bus_id: string
          heading_degrees?: number | null
          location: unknown
          received_at?: string
          recorded_at: string
          school_id: string
          speed_kph?: number | null
          trip_id: string
        }
        Update: {
          accuracy_meters?: number | null
          bus_id?: string
          heading_degrees?: number | null
          location?: unknown
          received_at?: string
          recorded_at?: string
          school_id?: string
          speed_kph?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_positions_bus_school_fkey"
            columns: ["bus_id", "school_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "bus_positions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_positions_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      buses: {
        Row: {
          active_device_id: string | null
          capacity: number
          created_at: string
          id: string
          make: string
          model: string
          registration_number: string
          school_id: string
          status: Database["public"]["Enums"]["bus_status"]
          updated_at: string
        }
        Insert: {
          active_device_id?: string | null
          capacity: number
          created_at?: string
          id?: string
          make: string
          model: string
          registration_number: string
          school_id: string
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Update: {
          active_device_id?: string | null
          capacity?: number
          created_at?: string
          id?: string
          make?: string
          model?: string
          registration_number?: string
          school_id?: string
          status?: Database["public"]["Enums"]["bus_status"]
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
          class_group_id: string
          created_at: string
          date_of_birth: string
          first_name: string
          id: string
          last_name: string
          profile_image_path: string | null
          school_id: string
          status: Database["public"]["Enums"]["child_status"]
          updated_at: string
        }
        Insert: {
          class_group_id: string
          created_at?: string
          date_of_birth: string
          first_name: string
          id?: string
          last_name: string
          profile_image_path?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["child_status"]
          updated_at?: string
        }
        Update: {
          class_group_id?: string
          created_at?: string
          date_of_birth?: string
          first_name?: string
          id?: string
          last_name?: string
          profile_image_path?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["child_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_class_group_school_fkey"
            columns: ["class_group_id", "school_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id", "school_id"]
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
      class_groups: {
        Row: {
          active: boolean
          age_range_label: string
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_range_label: string
          created_at?: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_range_label?: string
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          captured_at: string
          captured_by: string
          child_id: string | null
          created_at: string
          effective_at: string
          evidence: Json
          id: string
          policy_version: string
          purpose: string
          school_id: string
          status: string
          subject_user_id: string | null
        }
        Insert: {
          captured_at?: string
          captured_by: string
          child_id?: string | null
          created_at?: string
          effective_at?: string
          evidence?: Json
          id?: string
          policy_version: string
          purpose: string
          school_id: string
          status: string
          subject_user_id?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string
          child_id?: string | null
          created_at?: string
          effective_at?: string
          evidence?: Json
          id?: string
          policy_version?: string
          purpose?: string
          school_id?: string
          status?: string
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "consent_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_minor: number
          applied_at: string | null
          created_at: string
          credit_note_number: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          invoice_id: string
          issued_at: string | null
          issued_by: string | null
          reason: string
          school_id: string
          status: Database["public"]["Enums"]["credit_note_status"]
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_minor: number
          applied_at?: string | null
          created_at?: string
          credit_note_number: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          invoice_id: string
          issued_at?: string | null
          issued_by?: string | null
          reason: string
          school_id: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_minor?: number
          applied_at?: string | null
          created_at?: string
          credit_note_number?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          invoice_id?: string
          issued_at?: string | null
          issued_by?: string | null
          reason?: string
          school_id?: string
          status?: Database["public"]["Enums"]["credit_note_status"]
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_invoice_school_fkey"
            columns: ["invoice_id", "school_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      delay_reports: {
        Row: {
          created_at: string
          description: string | null
          estimated_delay_minutes: number | null
          id: string
          reason: Database["public"]["Enums"]["delay_reason"]
          reported_at: string
          reported_by: string
          school_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_delay_minutes?: number | null
          id?: string
          reason: Database["public"]["Enums"]["delay_reason"]
          reported_at?: string
          reported_by: string
          school_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_delay_minutes?: number | null
          id?: string
          reason?: Database["public"]["Enums"]["delay_reason"]
          reported_at?: string
          reported_by?: string
          school_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_reports_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          child_id: string | null
          completed_at: string | null
          created_at: string
          decision_note: string | null
          id: string
          reason: string | null
          request_type: string
          requested_at: string
          requested_by: string
          retention_hold: boolean
          retention_hold_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          subject_user_id: string | null
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string | null
          request_type: string
          requested_at?: string
          requested_by: string
          retention_hold?: boolean
          retention_hold_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          subject_user_id?: string | null
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          completed_at?: string | null
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string | null
          request_type?: string
          requested_at?: string
          requested_by?: string
          retention_hold?: boolean
          retention_hold_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          subject_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "deletion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          active: boolean
          created_at: string
          device_label: string | null
          id: string
          last_seen_at: string
          platform: string
          provider: string
          push_token: string
          revoked_at: string | null
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          provider?: string
          push_token: string
          revoked_at?: string | null
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_label?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          provider?: string
          push_token?: string
          revoked_at?: string | null
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_membership_fkey"
            columns: ["school_id", "user_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "user_id"]
          },
          {
            foreignKeyName: "device_tokens_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_items: {
        Row: {
          active: boolean
          amount_minor: number
          billing_period: string
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string | null
          effective_from: string | null
          effective_until: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_minor: number
          billing_period?: string
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_minor?: number
          billing_period?: string
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string | null
          effective_from?: string | null
          effective_until?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_children: {
        Row: {
          active: boolean
          child_id: string
          created_at: string
          guardian_user_id: string
          id: string
          primary_contact: boolean
          relationship: Database["public"]["Enums"]["collector_relationship"]
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          child_id: string
          created_at?: string
          guardian_user_id: string
          id?: string
          primary_contact?: boolean
          relationship: Database["public"]["Enums"]["collector_relationship"]
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          child_id?: string
          created_at?: string
          guardian_user_id?: string
          id?: string
          primary_contact?: boolean
          relationship?: Database["public"]["Enums"]["collector_relationship"]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_children_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "guardian_children_guardian_membership_fkey"
            columns: ["school_id", "guardian_user_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "user_id"]
          },
          {
            foreignKeyName: "guardian_children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          occurred_at: string
          reported_by: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
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
          occurred_at: string
          reported_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          severity: Database["public"]["Enums"]["incident_severity"]
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
          occurred_at?: string
          reported_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          severity?: Database["public"]["Enums"]["incident_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_resolved_by_fkey"
            columns: ["resolved_by"]
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
            foreignKeyName: "incidents_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          fee_item_id: string | null
          id: string
          invoice_id: string
          line_total_minor: number
          quantity: number
          school_id: string
          unit_amount_minor: number
        }
        Insert: {
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          description: string
          fee_item_id?: string | null
          id?: string
          invoice_id: string
          line_total_minor: number
          quantity?: number
          school_id: string
          unit_amount_minor: number
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          description?: string
          fee_item_id?: string | null
          id?: string
          invoice_id?: string
          line_total_minor?: number
          quantity?: number
          school_id?: string
          unit_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_fee_item_school_fkey"
            columns: ["fee_item_id", "school_id"]
            isOneToOne: false
            referencedRelation: "fee_items"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_school_fkey"
            columns: ["invoice_id", "school_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "invoice_lines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_minor: number
          child_id: string
          created_at: string
          created_by: string | null
          credit_minor: number
          currency: Database["public"]["Enums"]["currency_code"]
          due_date: string
          guardian_user_id: string
          id: string
          invoice_number: string
          issued_at: string | null
          notes: string | null
          paid_at: string | null
          paid_minor: number
          school_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor: number
          total_minor: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          balance_minor?: number
          child_id: string
          created_at?: string
          created_by?: string | null
          credit_minor?: number
          currency: Database["public"]["Enums"]["currency_code"]
          due_date: string
          guardian_user_id: string
          id?: string
          invoice_number: string
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_minor?: number
          school_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          balance_minor?: number
          child_id?: string
          created_at?: string
          created_by?: string | null
          credit_minor?: number
          currency?: Database["public"]["Enums"]["currency_code"]
          due_date?: string
          guardian_user_id?: string
          id?: string
          invoice_number?: string
          issued_at?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_minor?: number
          school_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_minor?: number
          total_minor?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_guardian_membership_fkey"
            columns: ["school_id", "guardian_user_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "user_id"]
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
      payment_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          id: string
          payment_id: string
          provider: string
          provider_reference: string | null
          request_reference: string | null
          school_id: string
          started_at: string
          status: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          payment_id: string
          provider: string
          provider_reference?: string | null
          request_reference?: string | null
          school_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          payment_id?: string
          provider?: string
          provider_reference?: string | null
          request_reference?: string | null
          school_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["payment_attempt_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_payment_school_fkey"
            columns: ["payment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "payment_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          cancelled_at: string | null
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency_code"]
          exchange_rate_snapshot: number | null
          failed_at: string | null
          id: string
          idempotency_key: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          provider: string
          provider_reference: string | null
          reference: string | null
          refunded_at: string | null
          request_hash: string
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          succeeded_at: string | null
          updated_at: string
        }
        Insert: {
          amount_minor: number
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          currency: Database["public"]["Enums"]["currency_code"]
          exchange_rate_snapshot?: number | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          provider?: string
          provider_reference?: string | null
          reference?: string | null
          refunded_at?: string | null
          request_hash: string
          school_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          exchange_rate_snapshot?: number | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          provider?: string
          provider_reference?: string | null
          reference?: string | null
          refunded_at?: string | null
          request_hash?: string
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          succeeded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_school_fkey"
            columns: ["invoice_id", "school_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          language: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          language?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          language?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          action: string
          expires_at: string
          id: number
          occurred_at: string
          school_id: string | null
          subject_hash: string
        }
        Insert: {
          action: string
          expires_at: string
          id?: never
          occurred_at?: string
          school_id?: string | null
          subject_hash: string
        }
        Update: {
          action?: string
          expires_at?: string
          id?: never
          occurred_at?: string
          school_id?: string | null
          subject_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          document_storage_path: string | null
          id: string
          issued_at: string
          payment_id: string
          receipt_number: string
          school_id: string
        }
        Insert: {
          created_at?: string
          document_storage_path?: string | null
          id?: string
          issued_at?: string
          payment_id: string
          receipt_number: string
          school_id: string
        }
        Update: {
          created_at?: string
          document_storage_path?: string | null
          id?: string
          issued_at?: string
          payment_id?: string
          receipt_number?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_payment_school_fkey"
            columns: ["payment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "receipts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          payment_id: string
          provider_reference: string | null
          reason: string
          requested_at: string
          requested_by: string
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          payment_id: string
          provider_reference?: string | null
          reason: string
          requested_at?: string
          requested_by: string
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          payment_id?: string
          provider_reference?: string | null
          reason?: string
          requested_at?: string
          requested_by?: string
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_school_fkey"
            columns: ["payment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "refunds_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      route_schedules: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          departure_time: string
          direction: Database["public"]["Enums"]["trip_direction"]
          effective_from: string
          effective_until: string | null
          id: string
          route_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week: number[]
          departure_time: string
          direction: Database["public"]["Enums"]["trip_direction"]
          effective_from: string
          effective_until?: string | null
          id?: string
          route_id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          departure_time?: string
          direction?: Database["public"]["Enums"]["trip_direction"]
          effective_from?: string
          effective_until?: string | null
          id?: string
          route_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_schedules_route_school_fkey"
            columns: ["route_id", "school_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "route_schedules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          active: boolean
          address: string
          created_at: string
          id: string
          location: unknown
          name: string
          pickup_radius_meters: number
          route_id: string
          school_id: string
          stop_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          created_at?: string
          id?: string
          location?: unknown
          name: string
          pickup_radius_meters?: number
          route_id: string
          school_id: string
          stop_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          id?: string
          location?: unknown
          name?: string
          pickup_radius_meters?: number
          route_id?: string
          school_id?: string
          stop_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_school_fkey"
            columns: ["route_id", "school_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "route_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string
          created_at: string
          id: string
          indicative_zig_per_usd: number
          is_demo: boolean
          name: string
          status: Database["public"]["Enums"]["school_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          indicative_zig_per_usd: number
          is_demo?: boolean
          name: string
          status?: Database["public"]["Enums"]["school_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          indicative_zig_per_usd?: number
          is_demo?: boolean
          name?: string
          status?: Database["public"]["Enums"]["school_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          school_id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          school_id: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          school_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_progress: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          details: Json
          id: string
          school_id: string
          started_at: string | null
          status: string
          step_key: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          details?: Json
          id?: string
          school_id: string
          started_at?: string | null
          status?: string
          step_key: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          details?: Json
          id?: string
          school_id?: string
          started_at?: string | null
          status?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_progress_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setup_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_events: {
        Row: {
          alert_id: string | null
          created_at: string
          id: string
          raised_at: string
          raised_by: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          trip_id: string | null
        }
        Insert: {
          alert_id?: string | null
          created_at?: string
          id?: string
          raised_at?: string
          raised_by: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          trip_id?: string | null
        }
        Update: {
          alert_id?: string | null
          created_at?: string
          id?: string
          raised_at?: string
          raised_by?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_alert_school_fkey"
            columns: ["alert_id", "school_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "sos_events_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_events_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_events_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_membership_fkey"
            columns: ["school_id", "user_id", "role"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "user_id", "role"]
          },
        ]
      }
      transport_routes: {
        Row: {
          assigned_bus_id: string | null
          code: string
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          name: string
          school_id: string
          status: Database["public"]["Enums"]["route_status"]
          updated_at: string
        }
        Insert: {
          assigned_bus_id?: string | null
          code: string
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          name: string
          school_id: string
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
        }
        Update: {
          assigned_bus_id?: string | null
          code?: string
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          name?: string
          school_id?: string
          status?: Database["public"]["Enums"]["route_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_assigned_bus_school_fkey"
            columns: ["assigned_bus_id", "school_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "transport_routes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_children: {
        Row: {
          boarded_at: string | null
          child_id: string
          created_at: string
          handed_over_at: string | null
          id: string
          idempotency_key: string
          last_event_at: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["trip_child_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          boarded_at?: string | null
          child_id: string
          created_at?: string
          handed_over_at?: string | null
          id?: string
          idempotency_key: string
          last_event_at?: string | null
          recorded_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["trip_child_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          boarded_at?: string | null
          child_id?: string
          created_at?: string
          handed_over_at?: string | null
          id?: string
          idempotency_key?: string
          last_event_at?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["trip_child_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_children_child_school_fkey"
            columns: ["child_id", "school_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "trip_children_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_children_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      trip_events: {
        Row: {
          actor_user_id: string | null
          event_data: Json
          event_type: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          received_at: string
          school_id: string
          trip_child_id: string | null
          trip_id: string
        }
        Insert: {
          actor_user_id?: string | null
          event_data?: Json
          event_type: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          received_at?: string
          school_id: string
          trip_child_id?: string | null
          trip_id: string
        }
        Update: {
          actor_user_id?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          received_at?: string
          school_id?: string
          trip_child_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_child_school_trip_fkey"
            columns: ["trip_child_id", "school_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_children"
            referencedColumns: ["id", "school_id", "trip_id"]
          },
          {
            foreignKeyName: "trip_events_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          direction: Database["public"]["Enums"]["trip_direction"]
          driver_id: string
          ended_at: string | null
          ended_by: string | null
          generation_key: string | null
          id: string
          route_id: string
          schedule_id: string | null
          scheduled_at: string
          school_id: string
          service_date: string
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["trip_status"]
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          bus_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["trip_direction"]
          driver_id: string
          ended_at?: string | null
          ended_by?: string | null
          generation_key?: string | null
          id?: string
          route_id: string
          schedule_id?: string | null
          scheduled_at: string
          school_id: string
          service_date: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          bus_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["trip_direction"]
          driver_id?: string
          ended_at?: string | null
          ended_by?: string | null
          generation_key?: string | null
          id?: string
          route_id?: string
          schedule_id?: string | null
          scheduled_at?: string
          school_id?: string
          service_date?: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_school_fkey"
            columns: ["bus_id", "school_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "trips_driver_school_fkey"
            columns: ["driver_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "trips_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_school_fkey"
            columns: ["route_id", "school_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "trips_schedule_school_fkey"
            columns: ["schedule_id", "school_id"]
            isOneToOne: false
            referencedRelation: "route_schedules"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "trips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_supervisor_school_fkey"
            columns: ["supervisor_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      vehicle_checks: {
        Row: {
          bus_id: string
          checked_at: string
          checked_by: string
          created_at: string
          id: string
          items: Json
          safe_to_operate: boolean
          school_id: string
          trip_id: string | null
        }
        Insert: {
          bus_id: string
          checked_at: string
          checked_by: string
          created_at?: string
          id?: string
          items: Json
          safe_to_operate: boolean
          school_id: string
          trip_id?: string | null
        }
        Update: {
          bus_id?: string
          checked_at?: string
          checked_by?: string
          created_at?: string
          id?: string
          items?: Json
          safe_to_operate?: boolean
          school_id?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_bus_school_fkey"
            columns: ["bus_id", "school_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "vehicle_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_trip_school_fkey"
            columns: ["trip_id", "school_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempt_count: number
          event_type: string
          id: string
          last_error_code: string | null
          payload: Json
          payload_sha256: string
          processed_at: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          received_at: string
          school_id: string | null
          signature_verified: boolean
        }
        Insert: {
          attempt_count?: number
          event_type: string
          id?: string
          last_error_code?: string | null
          payload: Json
          payload_sha256: string
          processed_at?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          received_at?: string
          school_id?: string | null
          signature_verified?: boolean
        }
        Update: {
          attempt_count?: number
          event_type?: string
          id?: string
          last_error_code?: string | null
          payload?: Json
          payload_sha256?: string
          processed_at?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          received_at?: string
          school_id?: string | null
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      analytics_attendance_daily: {
        Row: {
          absent_count: number | null
          boarded_count: number | null
          handed_over_count: number | null
          manifest_count: number | null
          pending_count: number | null
          school_id: string | null
          service_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_delay_reasons: {
        Row: {
          average_estimated_delay_minutes: number | null
          reason: Database["public"]["Enums"]["delay_reason"] | null
          report_count: number | null
          report_day: string | null
          school_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delay_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_fee_collection_trend: {
        Row: {
          collected_minor_units: number | null
          collection_month: string | null
          currency: Database["public"]["Enums"]["currency_code"] | null
          school_id: string | null
          successful_payment_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_incidents_by_type: {
        Row: {
          incident_count: number | null
          incident_day: string | null
          school_id: string | null
          severity: Database["public"]["Enums"]["incident_severity"] | null
          status: Database["public"]["Enums"]["incident_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_trip_duration_daily: {
        Row: {
          average_duration_minutes: number | null
          completed_trip_count: number | null
          longest_duration_minutes: number | null
          school_id: string | null
          service_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alert_severity: "info" | "warning" | "urgent"
      alert_status: "open" | "acknowledged" | "resolved"
      bank_transfer_status: "pending" | "verified" | "rejected"
      bus_status: "active" | "maintenance" | "inactive"
      child_status: "active" | "inactive" | "withdrawn"
      collector_relationship:
        | "parent"
        | "guardian"
        | "relative"
        | "authorised_caregiver"
        | "other"
      credit_note_status: "draft" | "issued" | "applied" | "void"
      currency_code: "USD" | "ZiG"
      delay_reason:
        | "traffic"
        | "vehicle_issue"
        | "road_closure"
        | "weather"
        | "other"
      incident_severity: "low" | "medium" | "high" | "critical"
      incident_status: "open" | "investigating" | "resolved"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "void"
      payment_attempt_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
      payment_method: "ecocash" | "cbz_transfer" | "cabs_transfer" | "card"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
      refund_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
      route_status: "active" | "inactive"
      school_status: "pending" | "active" | "suspended"
      trip_child_status: "pending" | "on_board" | "absent" | "handed_over"
      trip_direction: "to_school" | "from_school"
      trip_status:
        | "scheduled"
        | "active"
        | "completed"
        | "cancelled"
        | "attention_required"
      user_role:
        | "school_admin"
        | "guardian"
        | "supervisor"
        | "driver"
        | "teacher"
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
      alert_severity: ["info", "warning", "urgent"],
      alert_status: ["open", "acknowledged", "resolved"],
      bank_transfer_status: ["pending", "verified", "rejected"],
      bus_status: ["active", "maintenance", "inactive"],
      child_status: ["active", "inactive", "withdrawn"],
      collector_relationship: [
        "parent",
        "guardian",
        "relative",
        "authorised_caregiver",
        "other",
      ],
      credit_note_status: ["draft", "issued", "applied", "void"],
      currency_code: ["USD", "ZiG"],
      delay_reason: [
        "traffic",
        "vehicle_issue",
        "road_closure",
        "weather",
        "other",
      ],
      incident_severity: ["low", "medium", "high", "critical"],
      incident_status: ["open", "investigating", "resolved"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "void",
      ],
      payment_attempt_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
      ],
      payment_method: ["ecocash", "cbz_transfer", "cabs_transfer", "card"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      refund_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
      ],
      route_status: ["active", "inactive"],
      school_status: ["pending", "active", "suspended"],
      trip_child_status: ["pending", "on_board", "absent", "handed_over"],
      trip_direction: ["to_school", "from_school"],
      trip_status: [
        "scheduled",
        "active",
        "completed",
        "cancelled",
        "attention_required",
      ],
      user_role: [
        "school_admin",
        "guardian",
        "supervisor",
        "driver",
        "teacher",
      ],
    },
  },
} as const
