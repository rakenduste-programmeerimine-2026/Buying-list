/**
 * Supabase'i andmebaasi tüübid.
 *
 * Fail on kirjutatud README andmemudeli ja supabase/sql/02_rls_auth.sql järgi samas vormingus, mida
 * `supabase gen types typescript` toodab. Kui skeem muutub, genereeri uuesti:
 *
 *   npx supabase gen types typescript --project-id <projekti-id> > types/database.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          /** Omanik (auth.users.id). Täidetakse andmebaasis: default auth.uid(). */
          user_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          is_needed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          is_needed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          is_needed?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

/** Tabeli rea tüüp, nt `Tables<"stores">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
/** Lisamise tüüp, nt `TablesInsert<"products">`. */
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
/** Muutmise tüüp, nt `TablesUpdate<"products">`. */
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];

export type Store = Tables<"stores">;
export type Product = Tables<"products">;
