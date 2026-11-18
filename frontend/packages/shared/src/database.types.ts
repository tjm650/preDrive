export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      absences: {
        Row: {
          child_id: string;
          created_at: string;
          date: string;
          id: string;
          reported_by: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          date: string;
          id?: string;
          reported_by: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          date?: string;
          id?: string;
          reported_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'absences_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'absences_reported_by_fkey';
            columns: ['reported_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      app_settings: {
        Row: {
          school_id: string;
          updated_at: string;
          usd_to_zig_rate: number;
        };
        Insert: {
          school_id: string;
          updated_at?: string;
          usd_to_zig_rate: number;
        };
        Update: {
          school_id?: string;
          updated_at?: string;
          usd_to_zig_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'app_settings_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: true;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          school_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          school_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_log_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      authorized_pickups: {
        Row: {
          child_id: string;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          pin_hash: string;
          relationship: string;
          updated_at: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          pin_hash: string;
          relationship: string;
          updated_at?: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          pin_hash?: string;
          relationship?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'authorized_pickups_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
        ];
      };
      bus_live: {
        Row: {
          heading: number | null;
          lat: number;
          lng: number;
          speed: number | null;
          trip_id: string;
          updated_at: string;
        };
        Insert: {
          heading?: number | null;
          lat: number;
          lng: number;
          speed?: number | null;
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          heading?: number | null;
          lat?: number;
          lng?: number;
          speed?: number | null;
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bus_live_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: true;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      buses: {
        Row: {
          active: boolean;
          capacity: number;
          created_at: string;
          driver_name: string | null;
          id: string;
          make: string | null;
          model: string | null;
          registration: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          capacity: number;
          created_at?: string;
          driver_name?: string | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          registration: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          driver_name?: string | null;
          id?: string;
          make?: string | null;
          model?: string | null;
          registration?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buses_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      children: {
        Row: {
          allergies: string | null;
          avatar_key: string | null;
          class_name: string | null;
          created_at: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          first_name: string;
          home_radius_m: number;
          home_stop_id: string | null;
          id: string;
          medical_notes: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          allergies?: string | null;
          avatar_key?: string | null;
          class_name?: string | null;
          created_at?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name: string;
          home_radius_m?: number;
          home_stop_id?: string | null;
          id?: string;
          medical_notes?: string | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          allergies?: string | null;
          avatar_key?: string | null;
          class_name?: string | null;
          created_at?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name?: string;
          home_radius_m?: number;
          home_stop_id?: string | null;
          id?: string;
          medical_notes?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'children_home_stop_fk';
            columns: ['home_stop_id'];
            isOneToOne: false;
            referencedRelation: 'stops';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'children_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      demo_requests: {
        Row: {
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          message: string | null;
          phone: string | null;
          school_name: string;
        };
        Insert: {
          contact_name: string;
          created_at?: string;
          email: string;
          id?: string;
          message?: string | null;
          phone?: string | null;
          school_name: string;
        };
        Update: {
          contact_name?: string;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string | null;
          phone?: string | null;
          school_name?: string;
        };
        Relationships: [];
      };
      guardianships: {
        Row: {
          child_id: string;
          created_at: string;
          guardian_id: string;
          id: string;
          relationship: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          guardian_id: string;
          id?: string;
          relationship: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          guardian_id?: string;
          id?: string;
          relationship?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'guardianships_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'guardianships_guardian_id_fkey';
            columns: ['guardian_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      incidents: {
        Row: {
          child_id: string | null;
          created_at: string;
          description: string;
          id: string;
          reported_by: string;
          school_id: string;
          severity: Database['public']['Enums']['notification_priority'];
          status: Database['public']['Enums']['incident_status'];
          title: string;
          trip_id: string | null;
          updated_at: string;
        };
        Insert: {
          child_id?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          reported_by: string;
          school_id: string;
          severity?: Database['public']['Enums']['notification_priority'];
          status?: Database['public']['Enums']['incident_status'];
          title: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          child_id?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          reported_by?: string;
          school_id?: string;
          severity?: Database['public']['Enums']['notification_priority'];
          status?: Database['public']['Enums']['incident_status'];
          title?: string;
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'incidents_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_reported_by_fkey';
            columns: ['reported_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      invoices: {
        Row: {
          amount_usd: number;
          created_at: string;
          currency: string;
          due_date: string;
          guardian_id: string | null;
          id: string;
          school_id: string;
          status: Database['public']['Enums']['invoice_status'];
          updated_at: string;
        };
        Insert: {
          amount_usd: number;
          created_at?: string;
          currency?: string;
          due_date: string;
          guardian_id?: string | null;
          id?: string;
          school_id: string;
          status?: Database['public']['Enums']['invoice_status'];
          updated_at?: string;
        };
        Update: {
          amount_usd?: number;
          created_at?: string;
          currency?: string;
          due_date?: string;
          guardian_id?: string | null;
          id?: string;
          school_id?: string;
          status?: Database['public']['Enums']['invoice_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_guardian_id_fkey';
            columns: ['guardian_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invoices_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      location_history: {
        Row: {
          id: string;
          lat: number;
          lng: number;
          recorded_at: string;
          speed: number | null;
          trip_id: string;
        };
        Insert: {
          id?: string;
          lat: number;
          lng: number;
          recorded_at?: string;
          speed?: number | null;
          trip_id: string;
        };
        Update: {
          id?: string;
          lat?: number;
          lng?: number;
          recorded_at?: string;
          speed?: number | null;
          trip_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_history_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          thread_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'threads';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          acknowledged_at: string | null;
          body_key: string;
          created_at: string;
          id: string;
          params: Json;
          priority: Database['public']['Enums']['notification_priority'];
          read_at: string | null;
          school_id: string;
          title_key: string;
          type: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          body_key: string;
          created_at?: string;
          id?: string;
          params?: Json;
          priority?: Database['public']['Enums']['notification_priority'];
          read_at?: string | null;
          school_id: string;
          title_key: string;
          type: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          body_key?: string;
          created_at?: string;
          id?: string;
          params?: Json;
          priority?: Database['public']['Enums']['notification_priority'];
          read_at?: string | null;
          school_id?: string;
          title_key?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          invoice_id: string;
          paid_at: string | null;
          provider: string | null;
          provider_reference: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          id?: string;
          invoice_id: string;
          paid_at?: string | null;
          provider?: string | null;
          provider_reference?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id?: string;
          paid_at?: string | null;
          provider?: string | null;
          provider_reference?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          expo_push_token: string | null;
          full_name: string;
          id: string;
          language: string;
          phone: string | null;
          role: Database['public']['Enums']['user_role'];
          school_id: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          expo_push_token?: string | null;
          full_name: string;
          id: string;
          language?: string;
          phone?: string | null;
          role: Database['public']['Enums']['user_role'];
          school_id?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          expo_push_token?: string | null;
          full_name?: string;
          id?: string;
          language?: string;
          phone?: string | null;
          role?: Database['public']['Enums']['user_role'];
          school_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      push_receipts: {
        Row: {
          checked_at: string | null;
          created_at: string;
          error_code: string | null;
          expo_ticket_id: string;
          id: string;
          notification_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          checked_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          expo_ticket_id: string;
          id?: string;
          notification_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          checked_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          expo_ticket_id?: string;
          id?: string;
          notification_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_receipts_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'push_receipts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      route_children: {
        Row: {
          child_id: string;
          created_at: string;
          id: string;
          route_id: string;
          stop_id: string | null;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          id?: string;
          route_id: string;
          stop_id?: string | null;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          id?: string;
          route_id?: string;
          stop_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'route_children_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'route_children_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'route_children_stop_id_fkey';
            columns: ['stop_id'];
            isOneToOne: false;
            referencedRelation: 'stops';
            referencedColumns: ['id'];
          },
        ];
      };
      routes: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          polyline: Json;
          school_id: string;
          type: Database['public']['Enums']['route_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          polyline?: Json;
          school_id: string;
          type: Database['public']['Enums']['route_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          polyline?: Json;
          school_id?: string;
          type?: Database['public']['Enums']['route_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'routes_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      schools: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stops: {
        Row: {
          created_at: string;
          id: string;
          lat: number;
          lng: number;
          name: string;
          position: number;
          route_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lat: number;
          lng: number;
          name: string;
          position: number;
          route_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lat?: number;
          lng?: number;
          name?: string;
          position?: number;
          route_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stops_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          id: string;
          plan: string;
          renews_at: string | null;
          school_id: string;
          status: Database['public']['Enums']['subscription_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          plan: string;
          renews_at?: string | null;
          school_id: string;
          status?: Database['public']['Enums']['subscription_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          plan?: string;
          renews_at?: string | null;
          school_id?: string;
          status?: Database['public']['Enums']['subscription_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: true;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      thread_members: {
        Row: {
          created_at: string;
          id: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'thread_members_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'threads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'thread_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      threads: {
        Row: {
          created_at: string;
          id: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'threads_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      trip_events: {
        Row: {
          child_id: string | null;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          recorded_by: string;
          trip_id: string;
          type: Database['public']['Enums']['trip_event_type'];
        };
        Insert: {
          child_id?: string | null;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          recorded_by: string;
          trip_id: string;
          type: Database['public']['Enums']['trip_event_type'];
        };
        Update: {
          child_id?: string | null;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          recorded_by?: string;
          trip_id?: string;
          type?: Database['public']['Enums']['trip_event_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'trip_events_child_id_fkey';
            columns: ['child_id'];
            isOneToOne: false;
            referencedRelation: 'children';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_events_recorded_by_fkey';
            columns: ['recorded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trip_events_trip_id_fkey';
            columns: ['trip_id'];
            isOneToOne: false;
            referencedRelation: 'trips';
            referencedColumns: ['id'];
          },
        ];
      };
      trips: {
        Row: {
          bus_id: string;
          created_at: string;
          ended_at: string | null;
          id: string;
          route_id: string;
          started_at: string | null;
          status: Database['public']['Enums']['trip_status'];
          supervisor_id: string;
          updated_at: string;
        };
        Insert: {
          bus_id: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          route_id: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          supervisor_id: string;
          updated_at?: string;
        };
        Update: {
          bus_id?: string;
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          route_id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['trip_status'];
          supervisor_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'trips_bus_id_fkey';
            columns: ['bus_id'];
            isOneToOne: false;
            referencedRelation: 'buses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'trips_supervisor_id_fkey';
            columns: ['supervisor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      renotify_unaccounted_children: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      verify_pickup_pin: {
        Args: { child_id: string; pickup_id: string; pin: string };
        Returns: boolean;
      };
    };
    Enums: {
      incident_status: 'open' | 'investigating' | 'resolved' | 'closed';
      invoice_status: 'draft' | 'pending' | 'paid' | 'overdue' | 'void';
      notification_priority: 'low' | 'normal' | 'high' | 'critical';
      route_type: 'pickup' | 'dropoff';
      subscription_status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
      trip_event_type:
        | 'boarded'
        | 'arrived_school'
        | 'dropped_home'
        | 'absent'
        | 'sos'
        | 'delay'
        | 'handover_rejected';
      trip_status: 'scheduled' | 'active' | 'completed' | 'cancelled';
      user_role: 'parent' | 'supervisor' | 'school_admin' | 'platform_owner';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      incident_status: ['open', 'investigating', 'resolved', 'closed'],
      invoice_status: ['draft', 'pending', 'paid', 'overdue', 'void'],
      notification_priority: ['low', 'normal', 'high', 'critical'],
      route_type: ['pickup', 'dropoff'],
      subscription_status: ['trialing', 'active', 'past_due', 'cancelled', 'expired'],
      trip_event_type: [
        'boarded',
        'arrived_school',
        'dropped_home',
        'absent',
        'sos',
        'delay',
        'handover_rejected',
      ],
      trip_status: ['scheduled', 'active', 'completed', 'cancelled'],
      user_role: ['parent', 'supervisor', 'school_admin', 'platform_owner'],
    },
  },
} as const;
